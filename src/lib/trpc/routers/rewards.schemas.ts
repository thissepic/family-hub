import { z } from "zod/v4";

// ─── Profile & XP ───────────────────────────────────────────────

export const getProfileInput = z.object({
  memberId: z.string().optional(),
});

export const getXpHistoryInput = z.object({
  memberId: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(50),
  cursor: z.string().optional(),
});

// ─── Rewards Shop ───────────────────────────────────────────────

export const listRewardsInput = z.object({
  enabledOnly: z.boolean().optional(),
});

export const createRewardInput = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  iconUrl: z.string().optional(),
  pointCost: z.number().int().min(1),
  requiresApproval: z.boolean().default(true),
});

export const updateRewardInput = z.object({
  id: z.string(),
  title: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  iconUrl: z.string().optional(),
  pointCost: z.number().int().min(1).optional(),
  requiresApproval: z.boolean().optional(),
  enabled: z.boolean().optional(),
});

export const deleteRewardInput = z.object({
  id: z.string(),
});

export const redeemRewardInput = z.object({
  rewardId: z.string(),
});

export const listRedemptionsInput = z.object({
  status: z.enum(["PENDING_APPROVAL", "APPROVED", "DECLINED"]).optional(),
  memberId: z.string().optional(),
});

export const reviewRedemptionInput = z.object({
  id: z.string(),
  approved: z.boolean(),
});

// ─── Achievements ───────────────────────────────────────────────

export const listAchievementsInput = z.object({
  memberId: z.string().optional(),
});

export const createAchievementInput = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  iconUrl: z.string().optional(),
  condition: z.object({
    type: z.enum([
      "task_count",
      "chore_count",
      "streak_days",
      "total_xp",
      "level_reached",
    ]),
    threshold: z.number().int().min(1),
  }),
  rarity: z.enum(["COMMON", "RARE", "EPIC", "LEGENDARY"]).default("COMMON"),
  xpReward: z.number().int().min(0).default(0),
  pointsReward: z.number().int().min(0).default(0),
});

export const updateAchievementInput = z.object({
  id: z.string(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  condition: z.object({
    type: z.enum([
      "task_count",
      "chore_count",
      "streak_days",
      "total_xp",
      "level_reached",
    ]),
    threshold: z.number().int().min(1),
  }).optional(),
  rarity: z.enum(["COMMON", "RARE", "EPIC", "LEGENDARY"]).optional(),
  enabled: z.boolean().optional(),
  xpReward: z.number().int().min(0).optional(),
  pointsReward: z.number().int().min(0).optional(),
});

export const deleteAchievementInput = z.object({
  id: z.string(),
});

// ─── XP Settings ────────────────────────────────────────────────

export const updateSettingsInput = z.object({
  taskXpValues: z
    .object({
      LOW: z.number().int().min(0),
      MEDIUM: z.number().int().min(0),
      HIGH: z.number().int().min(0),
    })
    .optional(),
  choreXpValues: z
    .object({
      EASY: z.number().int().min(0),
      MEDIUM: z.number().int().min(0),
      HARD: z.number().int().min(0),
    })
    .optional(),
  streakMultipliers: z
    .object({
      "7": z.number().min(1),
      "14": z.number().min(1),
      "30": z.number().min(1),
    })
    .optional(),
  pointsPerXpRatio: z.number().min(0).max(10).optional(),
  mode: z.enum(["COMPETITIVE", "COLLABORATIVE"]).optional(),
});

// ─── Family Goals ───────────────────────────────────────────────

export const createGoalInput = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  targetXp: z.number().int().min(1),
  rewardDescription: z.string().max(500).optional(),
});

export const updateGoalInput = z.object({
  id: z.string(),
  title: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  targetXp: z.number().int().min(1).optional(),
  rewardDescription: z.string().max(500).optional(),
});

export const deleteGoalInput = z.object({
  id: z.string(),
});
