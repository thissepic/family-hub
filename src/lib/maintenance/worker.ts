import { Worker, type Job } from "bullmq";
import { getConnection } from "./queue";
import { db } from "@/lib/db";

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

async function handleDailyBackup() {
  const backupDir = process.env.BACKUP_DIR || "./backups";
  const retentionDays = parseInt(process.env.BACKUP_RETENTION_DAYS || "7", 10);
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    console.warn("[Maintenance] DATABASE_URL not set, skipping backup");
    return;
  }

  try {
    const { execSync } = await import("child_process");
    const { mkdirSync, existsSync } = await import("fs");

    if (!existsSync(backupDir)) {
      mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().split("T")[0];
    const dumpFile = `${backupDir}/familyhub_${timestamp}.sql.gz`;

    execSync(`pg_dump "${dbUrl}" | gzip > "${dumpFile}"`, {
      timeout: 120000,
    });

    // Prune old backups
    execSync(
      `find "${backupDir}" -name "familyhub_*.sql.gz" -mtime +${retentionDays} -delete`,
      { timeout: 10000 }
    );

    console.log(`[Maintenance] Backup created: ${dumpFile}`);
  } catch (err) {
    console.error("[Maintenance] Backup failed:", err);
    throw err;
  }
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
        case "daily-backup":
          return handleDailyBackup();
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
