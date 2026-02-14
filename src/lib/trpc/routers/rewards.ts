import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, adminProcedure } from "../init";
import { db } from "@/lib/db";
import { calculateLevel } from "@/lib/rewards/constants";
import { createNotification } from "@/lib/notifications/create-notification";
import { sendPush } from "@/lib/notifications/push";
import {
  getProfileInput,
  getXpHistoryInput,
  listRewardsInput,
  createRewardInput,
  updateRewardInput,
  deleteRewardInput,
  redeemRewardInput,
  listRedemptionsInput,
  reviewRedemptionInput,
  listAchievementsInput,
  createAchievementInput,
  updateAchievementInput,
  deleteAchievementInput,
  updateSettingsInput,
  createGoalInput,
  updateGoalInput,
  deleteGoalInput,
} from "./rewards.schemas";

export const rewardsRouter = router({
  // ─── Profile & XP ──────────────────────────────────────────────

  getProfile: protectedProcedure
    .input(getProfileInput)
    .query(async ({ ctx, input }) => {
      const memberId = input.memberId || ctx.session.memberId;

      // Verify member belongs to same family
      if (input.memberId) {
        const member = await db.familyMember.findUnique({
          where: { id: memberId },
          select: { familyId: true },
        });
        if (!member || member.familyId !== ctx.session.familyId) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Member not found" });
        }
      }

      const profile = await db.memberXpProfile.findUnique({
        where: { memberId },
        include: {
          member: { select: { id: true, name: true, color: true } },
        },
      });

      if (!profile) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "XP profile not found",
        });
      }

      const levelInfo = calculateLevel(profile.totalXp);

      return {
        ...profile,
        levelInfo,
      };
    }),

  getXpHistory: protectedProcedure
    .input(getXpHistoryInput)
    .query(async ({ ctx, input }) => {
      const memberId = input.memberId || ctx.session.memberId;

      // Verify member belongs to same family
      if (input.memberId) {
        const member = await db.familyMember.findUnique({
          where: { id: memberId },
          select: { familyId: true },
        });
        if (!member || member.familyId !== ctx.session.familyId) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Member not found" });
        }
      }

      const items = await db.xpEvent.findMany({
        where: { memberId },
        orderBy: { earnedAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor && { cursor: { id: input.cursor }, skip: 1 }),
      });

      let nextCursor: string | undefined;
      if (items.length > input.limit) {
        const extra = items.pop()!;
        nextCursor = extra.id;
      }

      return { items, nextCursor };
    }),

  getLeaderboard: protectedProcedure.query(async ({ ctx }) => {
    const { familyId } = ctx.session;

    const profiles = await db.memberXpProfile.findMany({
      where: { member: { familyId } },
      include: {
        member: { select: { id: true, name: true, color: true } },
      },
      orderBy: { totalXp: "desc" },
    });

    return profiles.map((p, index) => ({
      rank: index + 1,
      memberId: p.memberId,
      member: p.member,
      totalXp: p.totalXp,
      level: p.level,
      currentStreak: p.currentStreak,
      points: p.points,
      levelInfo: calculateLevel(p.totalXp),
    }));
  }),

  // ─── Rewards Shop ─────────────────────────────────────────────

  listRewards: protectedProcedure
    .input(listRewardsInput)
    .query(async ({ ctx, input }) => {
      const { familyId, role } = ctx.session;
      const enabledOnly = input.enabledOnly ?? (role !== "ADMIN");

      return db.reward.findMany({
        where: {
          familyId,
          ...(enabledOnly && { enabled: true }),
        },
        orderBy: { pointCost: "asc" },
      });
    }),

  createReward: adminProcedure
    .input(createRewardInput)
    .mutation(async ({ ctx, input }) => {
      const { familyId, memberId } = ctx.session;

      return db.reward.create({
        data: {
          familyId,
          createdById: memberId,
          title: input.title,
          description: input.description,
          iconUrl: input.iconUrl,
          pointCost: input.pointCost,
          requiresApproval: input.requiresApproval,
        },
      });
    }),

  updateReward: adminProcedure
    .input(updateRewardInput)
    .mutation(async ({ ctx, input }) => {
      const reward = await db.reward.findFirst({
        where: { id: input.id, familyId: ctx.session.familyId },
      });
      if (!reward) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const { id, ...data } = input;
      return db.reward.update({ where: { id }, data });
    }),

  deleteReward: adminProcedure
    .input(deleteRewardInput)
    .mutation(async ({ ctx, input }) => {
      const reward = await db.reward.findFirst({
        where: { id: input.id, familyId: ctx.session.familyId },
      });
      if (!reward) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      await db.reward.delete({ where: { id: input.id } });
      return { success: true };
    }),

  redeem: protectedProcedure
    .input(redeemRewardInput)
    .mutation(async ({ ctx, input }) => {
      const { memberId, familyId } = ctx.session;

      return db.$transaction(async (tx) => {
        const reward = await tx.reward.findFirst({
          where: { id: input.rewardId, familyId, enabled: true },
        });
        if (!reward) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }

        const profile = await tx.memberXpProfile.findUnique({
          where: { memberId },
        });
        if (!profile || profile.points < reward.pointCost) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Not enough points",
          });
        }

        // Deduct points
        await tx.memberXpProfile.update({
          where: { memberId },
          data: { points: { decrement: reward.pointCost } },
        });

        // Determine initial status
        const status = reward.requiresApproval
          ? ("PENDING_APPROVAL" as const)
          : ("APPROVED" as const);

        // Create redemption
        const redemption = await tx.rewardRedemption.create({
          data: {
            rewardId: reward.id,
            memberId,
            pointsSpent: reward.pointCost,
            status,
            ...(status === "APPROVED" && {
              reviewedAt: new Date(),
            }),
          },
        });

        // Create activity event
        await tx.activityEvent.create({
          data: {
            familyId,
            memberId,
            type: "REWARD_REDEEMED",
            description: `Redeemed reward: ${reward.title}`,
            sourceModule: "rewards",
            sourceId: redemption.id,
          },
        });

        return { redemption, status };
      });
    }),

  listRedemptions: protectedProcedure
    .input(listRedemptionsInput)
    .query(async ({ ctx, input }) => {
      const { familyId } = ctx.session;

      return db.rewardRedemption.findMany({
        where: {
          reward: { familyId },
          ...(input.status && { status: input.status }),
          ...(input.memberId && { memberId: input.memberId }),
        },
        include: {
          reward: { select: { title: true, pointCost: true } },
          member: { select: { id: true, name: true, color: true } },
          reviewedBy: { select: { name: true } },
        },
        orderBy: { requestedAt: "desc" },
        take: 50,
      });
    }),

  reviewRedemption: adminProcedure
    .input(reviewRedemptionInput)
    .mutation(async ({ ctx, input }) => {
      const { memberId: reviewerId, familyId } = ctx.session;

      const result = await db.$transaction(async (tx) => {
        const redemption = await tx.rewardRedemption.findFirst({
          where: {
            id: input.id,
            reward: { familyId },
            status: "PENDING_APPROVAL",
          },
          include: { reward: { select: { title: true } } },
        });

        if (!redemption) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }

        if (input.approved) {
          await tx.rewardRedemption.update({
            where: { id: input.id },
            data: {
              status: "APPROVED",
              reviewedById: reviewerId,
              reviewedAt: new Date(),
            },
          });

          const notif = await createNotification(tx, {
            memberId: redemption.memberId,
            type: "REWARD_APPROVAL",
            title: `Reward Approved: ${redemption.reward.title}`,
            message: "Your reward redemption has been approved!",
            linkUrl: "/rewards?tab=shop",
          });

          return { status: "APPROVED" as const, pushNotif: notif };
        } else {
          // Decline — refund points
          await tx.rewardRedemption.update({
            where: { id: input.id },
            data: {
              status: "DECLINED",
              reviewedById: reviewerId,
              reviewedAt: new Date(),
            },
          });

          await tx.memberXpProfile.update({
            where: { memberId: redemption.memberId },
            data: { points: { increment: redemption.pointsSpent } },
          });

          const notif = await createNotification(tx, {
            memberId: redemption.memberId,
            type: "REWARD_APPROVAL",
            title: `Reward Declined: ${redemption.reward.title}`,
            message:
              "Your reward redemption was declined. Points have been refunded.",
            linkUrl: "/rewards?tab=shop",
          });

          return { status: "DECLINED" as const, pushNotif: notif };
        }
      });

      // Send push after transaction commits
      if (result.pushNotif) {
        sendPush(result.pushNotif.memberId, {
          title: result.pushNotif.title,
          message: result.pushNotif.message,
          linkUrl: result.pushNotif.linkUrl,
        }).catch(() => {/* push is best-effort */});
      }

      return { status: result.status };
    }),

  // ─── Achievements ─────────────────────────────────────────────

  listAchievements: protectedProcedure
    .input(listAchievementsInput)
    .query(async ({ ctx, input }) => {
      const { familyId } = ctx.session;
      const memberId = input.memberId || ctx.session.memberId;

      // Verify member belongs to same family
      if (input.memberId) {
        const member = await db.familyMember.findUnique({
          where: { id: memberId },
          select: { familyId: true },
        });
        if (!member || member.familyId !== familyId) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Member not found" });
        }
      }

      const achievements = await db.achievement.findMany({
        where: { familyId, enabled: true },
        orderBy: [{ rarity: "asc" }, { name: "asc" }],
      });

      const unlocked = await db.memberAchievement.findMany({
        where: { memberId },
        select: { achievementId: true, unlockedAt: true },
      });
      const unlockedMap = new Map(
        unlocked.map((u) => [u.achievementId, u.unlockedAt])
      );

      return achievements.map((a) => ({
        ...a,
        unlocked: unlockedMap.has(a.id),
        unlockedAt: unlockedMap.get(a.id) ?? null,
      }));
    }),

  createAchievement: adminProcedure
    .input(createAchievementInput)
    .mutation(async ({ ctx, input }) => {
      const { familyId } = ctx.session;

      return db.achievement.create({
        data: {
          familyId,
          name: input.name,
          description: input.description,
          iconUrl: input.iconUrl,
          condition: input.condition,
          rarity: input.rarity,
          xpReward: input.xpReward,
          pointsReward: input.pointsReward,
          isCustom: true,
        },
      });
    }),

  updateAchievement: adminProcedure
    .input(updateAchievementInput)
    .mutation(async ({ ctx, input }) => {
      const achievement = await db.achievement.findFirst({
        where: { id: input.id, familyId: ctx.session.familyId },
      });
      if (!achievement) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const { id, ...data } = input;
      return db.achievement.update({ where: { id }, data });
    }),

  deleteAchievement: adminProcedure
    .input(deleteAchievementInput)
    .mutation(async ({ ctx, input }) => {
      const achievement = await db.achievement.findFirst({
        where: { id: input.id, familyId: ctx.session.familyId },
      });
      if (!achievement) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      await db.achievement.delete({ where: { id: input.id } });
      return { success: true };
    }),

  // ─── XP Settings ──────────────────────────────────────────────

  getSettings: protectedProcedure.query(async ({ ctx }) => {
    const { familyId } = ctx.session;

    const settings = await db.xpSettings.findUnique({
      where: { familyId },
    });

    if (!settings) {
      throw new TRPCError({ code: "NOT_FOUND" });
    }

    return settings;
  }),

  updateSettings: adminProcedure
    .input(updateSettingsInput)
    .mutation(async ({ ctx, input }) => {
      const { familyId } = ctx.session;

      return db.xpSettings.update({
        where: { familyId },
        data: {
          ...(input.taskXpValues !== undefined && {
            taskXpValues: input.taskXpValues,
          }),
          ...(input.choreXpValues !== undefined && {
            choreXpValues: input.choreXpValues,
          }),
          ...(input.streakMultipliers !== undefined && {
            streakMultipliers: input.streakMultipliers,
          }),
          ...(input.pointsPerXpRatio !== undefined && {
            pointsPerXpRatio: input.pointsPerXpRatio,
          }),
          ...(input.mode !== undefined && { mode: input.mode }),
        },
      });
    }),

  // ─── Family Goals ─────────────────────────────────────────────

  listGoals: protectedProcedure.query(async ({ ctx }) => {
    const { familyId } = ctx.session;

    return db.familyGoal.findMany({
      where: { familyId },
      orderBy: [{ status: "asc" }, { startedAt: "desc" }],
    });
  }),

  createGoal: adminProcedure
    .input(createGoalInput)
    .mutation(async ({ ctx, input }) => {
      const { familyId } = ctx.session;

      return db.familyGoal.create({
        data: {
          familyId,
          title: input.title,
          description: input.description,
          targetXp: input.targetXp,
          rewardDescription: input.rewardDescription,
        },
      });
    }),

  updateGoal: adminProcedure
    .input(updateGoalInput)
    .mutation(async ({ ctx, input }) => {
      const goal = await db.familyGoal.findFirst({
        where: { id: input.id, familyId: ctx.session.familyId },
      });
      if (!goal) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const { id, ...data } = input;
      return db.familyGoal.update({ where: { id }, data });
    }),

  deleteGoal: adminProcedure
    .input(deleteGoalInput)
    .mutation(async ({ ctx, input }) => {
      const goal = await db.familyGoal.findFirst({
        where: { id: input.id, familyId: ctx.session.familyId },
      });
      if (!goal) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      await db.familyGoal.delete({ where: { id: input.id } });
      return { success: true };
    }),
});
