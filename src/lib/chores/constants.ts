import { Zap, Flame, Crown, type LucideIcon } from "lucide-react";
import type { ChoreDifficulty } from "@prisma/client";

// ─── Difficulty ──────────────────────────────────────────────────

export const DIFFICULTIES: ChoreDifficulty[] = ["EASY", "MEDIUM", "HARD"];

export const DIFFICULTY_CONFIG: Record<
  ChoreDifficulty,
  { xp: number; color: string; icon: LucideIcon }
> = {
  EASY: { xp: 5, color: "#22c55e", icon: Zap },
  MEDIUM: { xp: 15, color: "#f59e0b", icon: Flame },
  HARD: { xp: 30, color: "#ef4444", icon: Crown },
};

// ─── Categories ──────────────────────────────────────────────────

export const DEFAULT_CATEGORIES = [
  "General",
  "Kitchen",
  "Bathroom",
  "Bedroom",
  "Living Room",
  "Outdoor",
  "Laundry",
  "Pets",
] as const;

// ─── Rotation ────────────────────────────────────────────────────

export const ROTATION_PATTERNS = [
  "ROUND_ROBIN",
  "RANDOM",
  "WEIGHTED",
] as const;

export const ROTATION_LABEL_KEYS: Record<string, string> = {
  ROUND_ROBIN: "rotationRoundRobin",
  RANDOM: "rotationRandom",
  WEIGHTED: "rotationWeighted",
};
