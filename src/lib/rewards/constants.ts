import type { AchievementRarity } from "@prisma/client";

// ─── Level Thresholds ───────────────────────────────────────────

export interface LevelThreshold {
  level: number;
  xpRequired: number;
  nameKey: string; // i18n key in rewards namespace
}

export const LEVEL_THRESHOLDS: LevelThreshold[] = [
  { level: 1, xpRequired: 0, nameKey: "levelBeginner" },
  { level: 2, xpRequired: 100, nameKey: "levelHelper" },
  { level: 3, xpRequired: 250, nameKey: "levelContributor" },
  { level: 4, xpRequired: 500, nameKey: "levelAchiever" },
  { level: 5, xpRequired: 1000, nameKey: "levelStar" },
  { level: 6, xpRequired: 2000, nameKey: "levelChampion" },
  { level: 7, xpRequired: 4000, nameKey: "levelHero" },
  { level: 8, xpRequired: 7500, nameKey: "levelMaster" },
  { level: 9, xpRequired: 12000, nameKey: "levelElite" },
  { level: 10, xpRequired: 20000, nameKey: "levelLegend" },
];

export interface LevelInfo {
  level: number;
  nameKey: string;
  currentXp: number;
  xpForNext: number | null; // null at max level
  progress: number; // 0–1
}

export function calculateLevel(totalXp: number): LevelInfo {
  let currentLevel = LEVEL_THRESHOLDS[0];
  for (const threshold of LEVEL_THRESHOLDS) {
    if (totalXp >= threshold.xpRequired) {
      currentLevel = threshold;
    } else {
      break;
    }
  }

  const nextLevel = LEVEL_THRESHOLDS.find(
    (t) => t.level === currentLevel.level + 1
  );

  const xpIntoLevel = totalXp - currentLevel.xpRequired;
  const xpForNext = nextLevel
    ? nextLevel.xpRequired - currentLevel.xpRequired
    : null;

  return {
    level: currentLevel.level,
    nameKey: currentLevel.nameKey,
    currentXp: xpIntoLevel,
    xpForNext,
    progress: xpForNext ? Math.min(xpIntoLevel / xpForNext, 1) : 1,
  };
}

// ─── Default Achievements ───────────────────────────────────────

export interface DefaultAchievement {
  name: string;
  description: string;
  condition: { type: string; threshold: number };
  rarity: AchievementRarity;
  xpReward: number;
  pointsReward: number;
}

export const DEFAULT_ACHIEVEMENTS: DefaultAchievement[] = [
  {
    name: "First Steps",
    description: "Complete your first task",
    condition: { type: "task_count", threshold: 1 },
    rarity: "COMMON",
    xpReward: 10,
    pointsReward: 1,
  },
  {
    name: "Helping Hand",
    description: "Complete 10 tasks",
    condition: { type: "task_count", threshold: 10 },
    rarity: "COMMON",
    xpReward: 25,
    pointsReward: 3,
  },
  {
    name: "Task Master",
    description: "Complete 50 tasks",
    condition: { type: "task_count", threshold: 50 },
    rarity: "RARE",
    xpReward: 100,
    pointsReward: 10,
  },
  {
    name: "Tidy Up",
    description: "Complete your first chore",
    condition: { type: "chore_count", threshold: 1 },
    rarity: "COMMON",
    xpReward: 10,
    pointsReward: 1,
  },
  {
    name: "Clean Machine",
    description: "Complete 25 chores",
    condition: { type: "chore_count", threshold: 25 },
    rarity: "RARE",
    xpReward: 75,
    pointsReward: 8,
  },
  {
    name: "On a Roll",
    description: "Maintain a 7-day streak",
    condition: { type: "streak_days", threshold: 7 },
    rarity: "RARE",
    xpReward: 50,
    pointsReward: 5,
  },
  {
    name: "Unstoppable",
    description: "Maintain a 30-day streak",
    condition: { type: "streak_days", threshold: 30 },
    rarity: "EPIC",
    xpReward: 200,
    pointsReward: 20,
  },
  {
    name: "XP Legend",
    description: "Reach 10,000 total XP",
    condition: { type: "total_xp", threshold: 10000 },
    rarity: "LEGENDARY",
    xpReward: 500,
    pointsReward: 50,
  },
];

// ─── XP Source Labels ───────────────────────────────────────────

export const XP_SOURCE_LABEL_KEYS: Record<string, string> = {
  TASK_COMPLETION: "sourceTaskCompletion",
  CHORE_COMPLETION: "sourceChoreCompletion",
  STREAK_BONUS: "sourceStreakBonus",
  SWAP_BONUS: "sourceSwapBonus",
  CUSTOM: "sourceCustom",
  ACHIEVEMENT: "sourceAchievement",
};

// ─── Rarity Config ──────────────────────────────────────────────

export const RARITY_CONFIG: Record<
  AchievementRarity,
  { color: string; borderColor: string; labelKey: string }
> = {
  COMMON: {
    color: "#6b7280",
    borderColor: "border-gray-400",
    labelKey: "rarityCommon",
  },
  RARE: {
    color: "#3b82f6",
    borderColor: "border-blue-400",
    labelKey: "rarityRare",
  },
  EPIC: {
    color: "#8b5cf6",
    borderColor: "border-purple-400",
    labelKey: "rarityEpic",
  },
  LEGENDARY: {
    color: "#f59e0b",
    borderColor: "border-amber-400",
    labelKey: "rarityLegendary",
  },
};
