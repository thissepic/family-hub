import type { PrismaClient, XpSource } from "@prisma/client";
import { calculateLevel } from "./constants";
import { createNotification } from "@/lib/notifications/create-notification";
import { sendPush } from "@/lib/notifications/push";

type TxClient = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

interface AwardXpInput {
  memberId: string;
  familyId: string;
  xpAmount: number;
  source: XpSource;
  sourceId?: string;
  description: string;
}

interface PendingPush {
  memberId: string;
  title: string;
  message: string;
  linkUrl?: string | null;
}

interface AwardXpResult {
  xpAwarded: number;
  pointsAwarded: number;
  newLevel: number;
  leveledUp: boolean;
  achievementsUnlocked: string[];
  pendingPush: PendingPush[];
}

/**
 * Main XP awarding function. Called inside a transaction by task/chore routers.
 * Handles: streak multiplier, points calculation, XpEvent creation,
 * MemberXpProfile update, family goal contribution, achievement evaluation,
 * and level-up/achievement notifications.
 */
export async function awardXp(
  tx: TxClient,
  input: AwardXpInput
): Promise<AwardXpResult> {
  // 1. Fetch XP settings for the family
  const settings = await tx.xpSettings.findUnique({
    where: { familyId: input.familyId },
  });

  const pointsPerXpRatio = settings?.pointsPerXpRatio ?? 0.1;
  const streakMultipliers = (settings?.streakMultipliers ?? {
    "7": 1.5,
    "14": 2.0,
    "30": 3.0,
  }) as Record<string, number>;

  // 2. Update streak and get current streak value
  const currentStreak = await updateStreak(tx, input.memberId);

  // 3. Calculate streak multiplier
  const multiplier = calculateStreakMultiplier(currentStreak, streakMultipliers);

  // 4. Apply multiplier to XP
  const finalXp = Math.round(input.xpAmount * multiplier);
  const pointsAwarded = Math.round(finalXp * pointsPerXpRatio);

  // 5. Create XpEvent
  await tx.xpEvent.create({
    data: {
      memberId: input.memberId,
      xpAmount: finalXp,
      pointsAmount: pointsAwarded,
      source: input.source,
      sourceId: input.sourceId,
      multiplier,
      description: input.description,
    },
  });

  // 6. Get current profile to check for level-up
  const currentProfile = await tx.memberXpProfile.findUnique({
    where: { memberId: input.memberId },
  });
  const oldLevel = currentProfile?.level ?? 1;

  // 7. Update MemberXpProfile
  const updatedProfile = await tx.memberXpProfile.update({
    where: { memberId: input.memberId },
    data: {
      totalXp: { increment: finalXp },
      points: { increment: pointsAwarded },
    },
  });

  // 8. Recalculate level from new totalXp
  const levelInfo = calculateLevel(updatedProfile.totalXp);
  const leveledUp = levelInfo.level > oldLevel;

  if (levelInfo.level !== updatedProfile.level) {
    await tx.memberXpProfile.update({
      where: { memberId: input.memberId },
      data: { level: levelInfo.level },
    });
  }

  // 9. If leveled up, create a notification (push sent after transaction)
  const pendingPush: Array<{ memberId: string; title: string; message: string; linkUrl?: string | null }> = [];

  if (leveledUp) {
    const notif = await createNotification(tx, {
      memberId: input.memberId,
      type: "LEVEL_UP",
      title: `Level Up! You reached Level ${levelInfo.level}!`,
      message: `Congratulations! You are now a ${levelInfo.nameKey}.`,
      linkUrl: "/rewards",
    });

    if (notif) {
      pendingPush.push({ memberId: notif.memberId, title: notif.title, message: notif.message, linkUrl: notif.linkUrl });
    }

    await tx.activityEvent.create({
      data: {
        familyId: input.familyId,
        memberId: input.memberId,
        type: "LEVEL_UP",
        description: `Reached Level ${levelInfo.level}`,
        sourceModule: "rewards",
      },
    });
  }

  // 10. Contribute to family goal (collaborative mode)
  if (settings?.mode === "COLLABORATIVE") {
    const activeGoal = await tx.familyGoal.findFirst({
      where: { familyId: input.familyId, status: "ACTIVE" },
      orderBy: { startedAt: "desc" },
    });

    if (activeGoal) {
      const updated = await tx.familyGoal.update({
        where: { id: activeGoal.id },
        data: { currentXp: { increment: finalXp } },
      });

      if (updated.currentXp >= updated.targetXp) {
        await tx.familyGoal.update({
          where: { id: activeGoal.id },
          data: { status: "COMPLETED", completedAt: new Date() },
        });
      }
    }
  }

  // 11. Evaluate achievements
  const achievementsResult = await evaluateAchievements(tx, {
    memberId: input.memberId,
    familyId: input.familyId,
  });

  pendingPush.push(...achievementsResult.pendingPush);

  return {
    xpAwarded: finalXp,
    pointsAwarded,
    newLevel: levelInfo.level,
    leveledUp,
    achievementsUnlocked: achievementsResult.names,
    pendingPush,
  };
}

/**
 * Send all pending push notifications (call after transaction commits).
 */
export async function flushPendingPush(pushItems: PendingPush[]): Promise<void> {
  await Promise.allSettled(
    pushItems.map((item) =>
      sendPush(item.memberId, {
        title: item.title,
        message: item.message,
        linkUrl: item.linkUrl,
      })
    )
  );
}

/**
 * Remove XP when a completion is undone (e.g. task uncompleted).
 * Deletes XpEvent and recalculates MemberXpProfile.
 */
export async function removeXp(
  tx: TxClient,
  input: { memberId: string; source: XpSource; sourceId: string }
): Promise<void> {
  // Find the XP events to remove
  const events = await tx.xpEvent.findMany({
    where: {
      memberId: input.memberId,
      source: input.source,
      sourceId: input.sourceId,
    },
  });

  if (events.length === 0) return;

  const totalXpToRemove = events.reduce((sum, e) => sum + e.xpAmount, 0);
  const totalPointsToRemove = events.reduce(
    (sum, e) => sum + e.pointsAmount,
    0
  );

  // Delete the events
  await tx.xpEvent.deleteMany({
    where: {
      memberId: input.memberId,
      source: input.source,
      sourceId: input.sourceId,
    },
  });

  // Update profile (ensure non-negative)
  const profile = await tx.memberXpProfile.findUnique({
    where: { memberId: input.memberId },
  });

  if (profile) {
    const newTotalXp = Math.max(0, profile.totalXp - totalXpToRemove);
    const newPoints = Math.max(0, profile.points - totalPointsToRemove);
    const newLevelInfo = calculateLevel(newTotalXp);

    await tx.memberXpProfile.update({
      where: { memberId: input.memberId },
      data: {
        totalXp: newTotalXp,
        points: newPoints,
        level: newLevelInfo.level,
      },
    });
  }
}

/**
 * Calculate the highest applicable streak multiplier.
 */
export function calculateStreakMultiplier(
  currentStreak: number,
  streakMultipliers: Record<string, number>
): number {
  let multiplier = 1.0;

  const thresholds = Object.keys(streakMultipliers)
    .map(Number)
    .sort((a, b) => a - b);

  for (const threshold of thresholds) {
    if (currentStreak >= threshold) {
      multiplier = streakMultipliers[String(threshold)];
    }
  }

  return multiplier;
}

/**
 * Update streak for a member. Checks if they had any completion yesterday.
 * Returns the new current streak value.
 */
export async function updateStreak(
  tx: TxClient,
  memberId: string
): Promise<number> {
  const profile = await tx.memberXpProfile.findUnique({
    where: { memberId },
  });

  if (!profile) return 0;

  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const startOfYesterday = new Date(
    yesterday.getFullYear(),
    yesterday.getMonth(),
    yesterday.getDate()
  );
  const endOfYesterday = new Date(
    yesterday.getFullYear(),
    yesterday.getMonth(),
    yesterday.getDate(),
    23,
    59,
    59,
    999
  );

  // Check if there was any XP event yesterday (task or chore completion)
  const yesterdayEvent = await tx.xpEvent.findFirst({
    where: {
      memberId,
      source: { in: ["TASK_COMPLETION", "CHORE_COMPLETION"] },
      earnedAt: { gte: startOfYesterday, lte: endOfYesterday },
    },
  });

  // Also check if already had an event today (to avoid resetting mid-day)
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );
  const todayEvent = await tx.xpEvent.findFirst({
    where: {
      memberId,
      source: { in: ["TASK_COMPLETION", "CHORE_COMPLETION"] },
      earnedAt: { gte: startOfToday },
    },
  });

  let newStreak: number;

  if (yesterdayEvent || (todayEvent && profile.currentStreak > 0)) {
    // Continue or maintain streak
    newStreak = todayEvent ? profile.currentStreak : profile.currentStreak + 1;
  } else {
    // First completion today with no yesterday activity — start new streak
    newStreak = 1;
  }

  const longestStreak = Math.max(profile.longestStreak, newStreak);

  await tx.memberXpProfile.update({
    where: { memberId },
    data: {
      currentStreak: newStreak,
      longestStreak,
    },
  });

  return newStreak;
}

/**
 * Evaluate all enabled achievements for a member.
 * Returns names of newly unlocked achievements and pending push items.
 */
export async function evaluateAchievements(
  tx: TxClient,
  input: { memberId: string; familyId: string }
): Promise<{ names: string[]; pendingPush: PendingPush[] }> {
  const achievementPush: PendingPush[] = [];
  // Get all enabled achievements for the family
  const achievements = await tx.achievement.findMany({
    where: { familyId: input.familyId, enabled: true },
  });

  // Get already-unlocked achievement IDs
  const unlocked = await tx.memberAchievement.findMany({
    where: { memberId: input.memberId },
    select: { achievementId: true },
  });
  const unlockedIds = new Set(unlocked.map((u) => u.achievementId));

  // Get member stats
  const profile = await tx.memberXpProfile.findUnique({
    where: { memberId: input.memberId },
  });

  const taskCount = await tx.xpEvent.count({
    where: { memberId: input.memberId, source: "TASK_COMPLETION" },
  });

  const choreCount = await tx.xpEvent.count({
    where: { memberId: input.memberId, source: "CHORE_COMPLETION" },
  });

  const newlyUnlocked: string[] = [];

  for (const achievement of achievements) {
    if (unlockedIds.has(achievement.id)) continue;

    const condition = achievement.condition as {
      type: string;
      threshold: number;
    };
    let met = false;

    switch (condition.type) {
      case "task_count":
        met = taskCount >= condition.threshold;
        break;
      case "chore_count":
        met = choreCount >= condition.threshold;
        break;
      case "streak_days":
        met = (profile?.currentStreak ?? 0) >= condition.threshold;
        break;
      case "total_xp":
        met = (profile?.totalXp ?? 0) >= condition.threshold;
        break;
      case "level_reached":
        met = (profile?.level ?? 1) >= condition.threshold;
        break;
      default:
        break;
    }

    if (met) {
      await tx.memberAchievement.create({
        data: {
          memberId: input.memberId,
          achievementId: achievement.id,
        },
      });

      // Award achievement XP/points if any
      if (achievement.xpReward > 0 || achievement.pointsReward > 0) {
        await tx.xpEvent.create({
          data: {
            memberId: input.memberId,
            xpAmount: achievement.xpReward,
            pointsAmount: achievement.pointsReward,
            source: "CUSTOM",
            sourceId: achievement.id,
            multiplier: 1.0,
            description: `Achievement unlocked: ${achievement.name}`,
          },
        });

        // Update profile with achievement rewards
        if (achievement.xpReward > 0 || achievement.pointsReward > 0) {
          await tx.memberXpProfile.update({
            where: { memberId: input.memberId },
            data: {
              totalXp: { increment: achievement.xpReward },
              points: { increment: achievement.pointsReward },
            },
          });
        }
      }

      // Create notification (push queued for after transaction)
      const achieveNotif = await createNotification(tx, {
        memberId: input.memberId,
        type: "ACHIEVEMENT",
        title: `Achievement Unlocked: ${achievement.name}!`,
        message: achievement.description ?? "You unlocked a new achievement!",
        linkUrl: "/rewards?tab=achievements",
      });

      if (achieveNotif) {
        achievementPush.push({ memberId: achieveNotif.memberId, title: achieveNotif.title, message: achieveNotif.message, linkUrl: achieveNotif.linkUrl });
      }

      // Create activity event
      await tx.activityEvent.create({
        data: {
          familyId: input.familyId,
          memberId: input.memberId,
          type: "ACHIEVEMENT_UNLOCKED",
          description: `Unlocked achievement: ${achievement.name}`,
          sourceModule: "rewards",
          sourceId: achievement.id,
        },
      });

      newlyUnlocked.push(achievement.name);
    }
  }

  return { names: newlyUnlocked, pendingPush: achievementPush };
}
