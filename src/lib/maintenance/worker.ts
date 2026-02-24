import { Worker, type Job } from "bullmq";
import { getConnection } from "./queue";
import { db } from "@/lib/db";
import { createNotification } from "@/lib/notifications/create-notification";
import { sendPush } from "@/lib/notifications/push";
import { rrulestr } from "rrule";

async function handleCleanupNotifications() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const result = await db.notification.deleteMany({
    where: {
      createdAt: { lt: thirtyDaysAgo },
      read: true,
    },
  });

  console.log(`[Maintenance] Cleaned up ${result.count} old notifications`);
  return { cleaned: result.count };
}

async function handleWeeklyRecap() {
  const families = await db.family.findMany({
    include: { members: { select: { id: true, name: true } } },
  });

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  for (const family of families) {
    // Top XP earner this week
    const xpEvents = await db.xpEvent.groupBy({
      by: ["memberId"],
      where: {
        earnedAt: { gte: oneWeekAgo },
        member: { familyId: family.id },
      },
      _sum: { xpAmount: true },
      orderBy: { _sum: { xpAmount: "desc" } },
      take: 1,
    });

    // Most chores completed this week
    const choreCompletions = await db.choreInstance.groupBy({
      by: ["assignedMemberId"],
      where: {
        completedAt: { gte: oneWeekAgo },
        status: "DONE",
        chore: { familyId: family.id },
      },
      _count: true,
      orderBy: { _count: { assignedMemberId: "desc" } },
      take: 1,
    });

    // New achievements this week
    const newAchievements = await db.memberAchievement.findMany({
      where: {
        unlockedAt: { gte: oneWeekAgo },
        member: { familyId: family.id },
      },
      include: {
        achievement: { select: { name: true } },
        member: { select: { name: true } },
      },
    });

    // Longest current streak
    const topStreak = await db.memberXpProfile.findFirst({
      where: { member: { familyId: family.id } },
      orderBy: { currentStreak: "desc" },
      include: { member: { select: { name: true } } },
    });

    // Build recap message
    const parts: string[] = [];

    if (xpEvents[0]) {
      const member = family.members.find((m) => m.id === xpEvents[0].memberId);
      if (member) {
        parts.push(`Top XP: ${member.name} (${xpEvents[0]._sum.xpAmount ?? 0} XP)`);
      }
    }

    if (choreCompletions[0]) {
      const member = family.members.find((m) => m.id === choreCompletions[0].assignedMemberId);
      if (member) {
        parts.push(`Most chores: ${member.name} (${choreCompletions[0]._count})`);
      }
    }

    if (topStreak && topStreak.currentStreak > 0) {
      parts.push(`Longest streak: ${topStreak.member.name} (${topStreak.currentStreak} days)`);
    }

    if (newAchievements.length > 0) {
      parts.push(`New badges: ${newAchievements.map((a) => `${a.member.name} — ${a.achievement.name}`).join(", ")}`);
    }

    if (parts.length === 0) continue;

    const message = parts.join(" | ");

    // Check notification preferences and create notifications
    for (const member of family.members) {
      const preference = await db.notificationPreference.findUnique({
        where: { memberId_type: { memberId: member.id, type: "ADMIN_ANNOUNCEMENT" } },
      });

      if (preference?.muted) continue;

      await db.notification.create({
        data: {
          memberId: member.id,
          type: "ADMIN_ANNOUNCEMENT",
          title: "Weekly Recap",
          message,
          linkUrl: "/rewards",
        },
      });
    }

    // Create activity event
    if (family.members[0]) {
      await db.activityEvent.create({
        data: {
          familyId: family.id,
          memberId: family.members[0].id,
          type: "LEVEL_UP", // Reuse closest type
          description: `Weekly recap: ${message}`,
          sourceModule: "rewards",
        },
      });
    }
  }

  console.log(`[Maintenance] Weekly recap generated for ${families.length} families`);
}

async function handleCleanupExpiredTokens() {
  const now = new Date();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Delete expired tokens
  const expired = await db.emailToken.deleteMany({
    where: { expiresAt: { lt: now } },
  });

  // Delete used tokens older than 7 days
  const used = await db.emailToken.deleteMany({
    where: {
      usedAt: { not: null, lt: sevenDaysAgo },
    },
  });

  console.log(
    `[Maintenance] Token cleanup: ${expired.count} expired, ${used.count} old used tokens removed`
  );
  return { expired: expired.count, used: used.count };
}

async function handleDailyBackup() {
  const backupDir = process.env.BACKUP_DIR || "./backups";
  const retentionDays = parseInt(process.env.BACKUP_RETENTION_DAYS || "7", 10);
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    console.warn("[Maintenance] DATABASE_URL not set, skipping backup");
    return;
  }

  if (isNaN(retentionDays) || retentionDays < 1 || retentionDays > 365) {
    console.warn("[Maintenance] Invalid BACKUP_RETENTION_DAYS, using default 7");
  }
  const safeRetentionDays = isNaN(retentionDays) || retentionDays < 1 || retentionDays > 365 ? 7 : retentionDays;

  try {
    const { spawn } = await import("child_process");
    const { mkdirSync, existsSync, readdirSync, statSync, unlinkSync } = await import("fs");
    const { createWriteStream } = await import("fs");
    const { resolve } = await import("path");

    const resolvedBackupDir = resolve(backupDir);

    if (!existsSync(resolvedBackupDir)) {
      mkdirSync(resolvedBackupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().split("T")[0];
    const dumpFile = resolve(resolvedBackupDir, `familyhub_${timestamp}.sql.gz`);

    // Use spawn with argument arrays to prevent shell injection
    await new Promise<void>((resolvePromise, reject) => {
      const pgDump = spawn("pg_dump", [dbUrl], { stdio: ["ignore", "pipe", "pipe"] });
      const gzip = spawn("gzip", [], { stdio: ["pipe", "pipe", "pipe"] });

      pgDump.stdout.pipe(gzip.stdin);

      const output = createWriteStream(dumpFile);
      gzip.stdout.pipe(output);

      let pgError = "";
      let gzipError = "";
      pgDump.stderr.on("data", (data: Buffer) => { pgError += data.toString(); });
      gzip.stderr.on("data", (data: Buffer) => { gzipError += data.toString(); });

      const timeout = setTimeout(() => {
        pgDump.kill();
        gzip.kill();
        reject(new Error("Backup timed out after 120 seconds"));
      }, 120000);

      let exitCount = 0;
      const checkDone = (code: number | null, process: string) => {
        if (code !== 0 && code !== null) {
          clearTimeout(timeout);
          reject(new Error(`${process} exited with code ${code}: ${process === "pg_dump" ? pgError : gzipError}`));
          return;
        }
        exitCount++;
        if (exitCount === 2) {
          clearTimeout(timeout);
          output.end(() => resolvePromise());
        }
      };

      pgDump.on("close", (code) => checkDone(code, "pg_dump"));
      gzip.on("close", (code) => checkDone(code, "gzip"));
      pgDump.on("error", (err) => { clearTimeout(timeout); reject(err); });
      gzip.on("error", (err) => { clearTimeout(timeout); reject(err); });
    });

    // Prune old backups using pure Node.js (no shell commands)
    const cutoff = Date.now() - safeRetentionDays * 24 * 60 * 60 * 1000;
    const files = readdirSync(resolvedBackupDir);
    for (const file of files) {
      if (!file.startsWith("familyhub_") || !file.endsWith(".sql.gz")) continue;
      const filePath = resolve(resolvedBackupDir, file);
      const fileStat = statSync(filePath);
      if (fileStat.mtimeMs < cutoff) {
        unlinkSync(filePath);
        console.log(`[Maintenance] Pruned old backup: ${file}`);
      }
    }

    console.log(`[Maintenance] Backup created: ${dumpFile}`);
  } catch (err) {
    console.error("[Maintenance] Backup failed:", err instanceof Error ? err.message : "Unknown error");
    throw err;
  }
}

/**
 * Parse "HH:MM" string into { hours, minutes }.
 */
function parseHHMM(time: string): { hours: number; minutes: number } {
  const [h, m] = time.split(":").map(Number);
  return { hours: h, minutes: m };
}

/**
 * Check if a target time (HH:MM) falls within the 15-minute window ending at `now`.
 * Window: [now - 15min, now)
 */
function isInCurrentWindow(targetHHMM: string, now: Date): boolean {
  const { hours, minutes } = parseHHMM(targetHHMM);
  const target = new Date(now);
  target.setHours(hours, minutes, 0, 0);

  const windowStart = new Date(now.getTime() - 15 * 60 * 1000);
  return target >= windowStart && target < now;
}

/**
 * Subtract minutes from an HH:MM string, returning a new HH:MM string.
 * Clamps to 00:00 if result goes before midnight (does not wrap to previous day).
 */
function subtractMinutesFromHHMM(time: string, minutesToSubtract: number): string {
  const { hours, minutes } = parseHHMM(time);
  const totalMinutes = hours * 60 + minutes - minutesToSubtract;
  if (totalMinutes < 0) return "00:00";
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

async function handleChoreDeadlineReminders() {
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Find chore instances due today that are still pending
  const dueInstances = await db.choreInstance.findMany({
    where: {
      status: "PENDING",
      periodEnd: { gte: today, lt: tomorrow },
    },
    include: {
      chore: { select: { title: true, rotationPattern: true, dueTime: true } },
      assignedMember: { select: { id: true } },
      instanceAssignees: { select: { memberId: true } },
    },
  });

  let sent = 0;
  for (const instance of dueInstances) {
    const notifyTime = instance.chore.dueTime ?? "08:00";
    if (!isInCurrentWindow(notifyTime, now)) continue;

    // Deduplicate: check if deadline notification already sent today
    const sourceId = `deadline-${instance.id}`;
    const existing = await db.notification.findFirst({
      where: { sourceModule: "chores", sourceId, createdAt: { gte: today } },
    });
    if (existing) continue;

    // For group tasks, notify all assignees; otherwise notify the assigned member
    const memberIds =
      instance.chore.rotationPattern === "ALL_TOGETHER"
        ? instance.instanceAssignees.map((a) => a.memberId)
        : instance.assignedMember
          ? [instance.assignedMember.id]
          : [];

    for (const memberId of memberIds) {
      const notif = await createNotification(db, {
        memberId,
        type: "CHORE_DEADLINE",
        title: "Chore due today",
        message: `"${instance.chore.title}" is due today`,
        linkUrl: "/chores",
        sourceModule: "chores",
        sourceId,
      });
      if (notif) {
        sendPush(notif.memberId, {
          title: notif.title,
          message: notif.message,
          linkUrl: notif.linkUrl,
        }).catch(() => {});
        sent++;
      }
    }
  }

  console.log(`[Maintenance] Chore deadline reminders: ${sent} sent for ${dueInstances.length} instances`);
}

async function handleTaskDeadlineReminders() {
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  // Only tasks with a dueTime set
  const tasks = await db.task.findMany({
    where: {
      dueTime: { not: null },
    },
    include: {
      assignees: {
        include: { member: { select: { id: true } } },
      },
      completions: {
        where: { date: today },
      },
    },
  });

  let sent = 0;
  for (const task of tasks) {
    if (!task.dueTime) continue;
    // Check if task is active today (recurrence check)
    if (!isTaskActiveOnDateWorker(task, today)) continue;
    if (!isInCurrentWindow(task.dueTime, now)) continue;

    const sourceId = `deadline-task-${task.id}-${today.toISOString().split("T")[0]}`;
    const existing = await db.notification.findFirst({
      where: { sourceModule: "tasks", sourceId, createdAt: { gte: today } },
    });
    if (existing) continue;

    for (const assignee of task.assignees) {
      // Skip if already completed today by this member
      const completed = task.completions.some(
        (c) => c.memberId === assignee.member.id
      );
      if (completed) continue;

      const notif = await createNotification(db, {
        memberId: assignee.member.id,
        type: "CHORE_DEADLINE",
        title: "Task due today",
        message: `"${task.title}" is due at ${task.dueTime}`,
        linkUrl: "/tasks",
        sourceModule: "tasks",
        sourceId,
      });
      if (notif) {
        sendPush(notif.memberId, {
          title: notif.title,
          message: notif.message,
          linkUrl: notif.linkUrl,
        }).catch(() => {});
        sent++;
      }
    }
  }

  console.log(`[Maintenance] Task deadline reminders: ${sent} sent`);
}

async function handleEarlyReminders() {
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // --- Chore early reminders ---
  const choreInstances = await db.choreInstance.findMany({
    where: {
      status: "PENDING",
      periodEnd: { gte: today, lt: tomorrow },
      chore: {
        dueTime: { not: null },
        reminderMinutesBefore: { not: null },
      },
    },
    include: {
      chore: {
        select: {
          title: true,
          rotationPattern: true,
          dueTime: true,
          reminderMinutesBefore: true,
        },
      },
      assignedMember: { select: { id: true } },
      instanceAssignees: { select: { memberId: true } },
    },
  });

  let sent = 0;
  for (const instance of choreInstances) {
    const { dueTime, reminderMinutesBefore } = instance.chore;
    if (!dueTime || !reminderMinutesBefore) continue;

    const earlyTime = subtractMinutesFromHHMM(dueTime, reminderMinutesBefore);
    if (!isInCurrentWindow(earlyTime, now)) continue;

    const sourceId = `early-${instance.id}`;
    const existing = await db.notification.findFirst({
      where: { sourceModule: "chores", sourceId, createdAt: { gte: today } },
    });
    if (existing) continue;

    const memberIds =
      instance.chore.rotationPattern === "ALL_TOGETHER"
        ? instance.instanceAssignees.map((a) => a.memberId)
        : instance.assignedMember
          ? [instance.assignedMember.id]
          : [];

    for (const memberId of memberIds) {
      const notif = await createNotification(db, {
        memberId,
        type: "CHORE_DEADLINE",
        title: "Chore reminder",
        message: `"${instance.chore.title}" is due at ${dueTime}`,
        linkUrl: "/chores",
        sourceModule: "chores",
        sourceId,
      });
      if (notif) {
        sendPush(notif.memberId, {
          title: notif.title,
          message: notif.message,
          linkUrl: notif.linkUrl,
        }).catch(() => {});
        sent++;
      }
    }
  }

  // --- Task early reminders ---
  const tasks = await db.task.findMany({
    where: {
      dueTime: { not: null },
      reminderMinutesBefore: { not: null },
    },
    include: {
      assignees: {
        include: { member: { select: { id: true } } },
      },
      completions: {
        where: { date: today },
      },
    },
  });

  for (const task of tasks) {
    if (!task.dueTime || !task.reminderMinutesBefore) continue;
    if (!isTaskActiveOnDateWorker(task, today)) continue;

    const earlyTime = subtractMinutesFromHHMM(task.dueTime, task.reminderMinutesBefore);
    if (!isInCurrentWindow(earlyTime, now)) continue;

    const dateStr = today.toISOString().split("T")[0];
    const sourceId = `early-task-${task.id}-${dateStr}`;
    const existing = await db.notification.findFirst({
      where: { sourceModule: "tasks", sourceId, createdAt: { gte: today } },
    });
    if (existing) continue;

    for (const assignee of task.assignees) {
      const completed = task.completions.some(
        (c) => c.memberId === assignee.member.id
      );
      if (completed) continue;

      const notif = await createNotification(db, {
        memberId: assignee.member.id,
        type: "CHORE_DEADLINE",
        title: "Task reminder",
        message: `"${task.title}" is due at ${task.dueTime}`,
        linkUrl: "/tasks",
        sourceModule: "tasks",
        sourceId,
      });
      if (notif) {
        sendPush(notif.memberId, {
          title: notif.title,
          message: notif.message,
          linkUrl: notif.linkUrl,
        }).catch(() => {});
        sent++;
      }
    }
  }

  console.log(`[Maintenance] Early reminders: ${sent} sent`);
}

/**
 * Check if a task is active on a given date based on its recurrence rule.
 * Worker-local copy to avoid importing from tRPC router.
 */
function isTaskActiveOnDateWorker(
  task: { createdAt: Date; recurrenceRule: string | null },
  date: Date
): boolean {
  if (!task.recurrenceRule) return true;

  const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

  try {
    const rule = rrulestr(task.recurrenceRule, { dtstart: task.createdAt });
    const occurrences = rule.between(startOfDay, endOfDay, true);
    return occurrences.length > 0;
  } catch {
    return true;
  }
}

async function handleCalendarEventReminders() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Find non-recurring events starting today
  const todayEvents = await db.calendarEvent.findMany({
    where: {
      startAt: { gte: today, lt: tomorrow },
      recurrenceRule: null,
    },
    include: {
      assignees: { select: { memberId: true } },
    },
  });

  // Find recurring events that may have an instance today
  const recurringEvents = await db.calendarEvent.findMany({
    where: {
      recurrenceRule: { not: null },
      startAt: { lte: tomorrow },
    },
    include: {
      assignees: { select: { memberId: true } },
    },
  });

  const eventsToNotify = [...todayEvents];

  for (const event of recurringEvents) {
    if (!event.recurrenceRule) continue;
    try {
      const rule = rrulestr(event.recurrenceRule, { dtstart: event.startAt });
      const occurrences = rule.between(today, tomorrow, true);
      if (occurrences.length > 0) {
        eventsToNotify.push(event);
      }
    } catch {
      // Skip events with invalid recurrence rules
    }
  }

  let sent = 0;
  for (const event of eventsToNotify) {
    const timeStr = event.allDay
      ? "all day"
      : event.startAt.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });

    for (const assignee of event.assignees) {
      const notif = await createNotification(db, {
        memberId: assignee.memberId,
        type: "CALENDAR_REMINDER",
        title: "Event today",
        message: `"${event.title}" — ${timeStr}`,
        linkUrl: "/calendar",
      });
      if (notif) {
        sendPush(notif.memberId, {
          title: notif.title,
          message: notif.message,
          linkUrl: notif.linkUrl,
        }).catch(() => {});
        sent++;
      }
    }
  }

  console.log(`[Maintenance] Calendar reminders: ${sent} sent for ${eventsToNotify.length} events`);
}

export function createMaintenanceWorker(): Worker {
  const worker = new Worker(
    "maintenance",
    async (job: Job) => {
      switch (job.name) {
        case "cleanup-old-notifications":
          return handleCleanupNotifications();
        case "weekly-recap":
          return handleWeeklyRecap();
        case "cleanup-expired-tokens":
          return handleCleanupExpiredTokens();
        case "daily-backup":
          return handleDailyBackup();
        case "chore-deadline-reminders":
          return handleChoreDeadlineReminders();
        case "task-deadline-reminders":
          return handleTaskDeadlineReminders();
        case "early-reminders":
          return handleEarlyReminders();
        case "calendar-event-reminders":
          return handleCalendarEventReminders();
        default:
          console.warn(`[Maintenance] Unknown job: ${job.name}`);
      }
    },
    {
      connection: getConnection() as never,
      concurrency: 1,
    }
  );

  worker.on("failed", (job, err) => {
    console.error(`[Maintenance] Job ${job?.name} failed:`, err);
  });

  return worker;
}
