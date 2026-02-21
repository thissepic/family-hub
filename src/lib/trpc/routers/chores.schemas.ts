import { z } from "zod/v4";

const choreDifficulty = z.enum(["EASY", "MEDIUM", "HARD"]);
const rotationPattern = z.enum(["ROUND_ROBIN", "RANDOM", "WEIGHTED", "ALL_TOGETHER"]);
const choreInstanceStatus = z.enum([
  "PENDING",
  "DONE",
  "PENDING_REVIEW",
  "OVERDUE",
  "SKIPPED",
]);

// ─── Chore CRUD ──────────────────────────────────────────────────

export const listChoresInput = z.object({
  memberIds: z.array(z.string()).optional(),
  categories: z.array(z.string()).optional(),
});

export const getByIdInput = z.object({
  id: z.string(),
});

export const createChoreInput = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  category: z.string().default("General"),
  recurrenceRule: z.string().min(1).default("RRULE:FREQ=WEEKLY"),
  difficulty: choreDifficulty.default("MEDIUM"),
  estimatedMinutes: z.number().int().min(1).max(480).optional(),
  needsVerification: z.boolean().default(false),
  rotationPattern: rotationPattern.default("ROUND_ROBIN"),
  assigneeIds: z.array(z.string()).min(1),
});

export const updateChoreInput = z.object({
  id: z.string(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().nullable().optional(),
  category: z.string().optional(),
  recurrenceRule: z.string().min(1).optional(),
  difficulty: choreDifficulty.optional(),
  estimatedMinutes: z.number().int().min(1).max(480).nullable().optional(),
  needsVerification: z.boolean().optional(),
  rotationPattern: rotationPattern.optional(),
  assigneeIds: z.array(z.string()).min(1).optional(),
});

export const deleteChoreInput = z.object({
  id: z.string(),
});

// ─── Instance Management ─────────────────────────────────────────

export const listMyInstancesInput = z.object({
  memberIds: z.array(z.string()).optional(),
  date: z.coerce.date().optional(),
  statuses: z.array(choreInstanceStatus).optional(),
});

export const completeInstanceInput = z.object({
  instanceId: z.string(),
});

export const verifyInstanceInput = z.object({
  instanceId: z.string(),
  approved: z.boolean(),
});

export const skipInstanceInput = z.object({
  instanceId: z.string(),
});

export const uncompleteInstanceInput = z.object({
  instanceId: z.string(),
});

// ─── Swap Requests ───────────────────────────────────────────────

export const requestSwapInput = z.object({
  instanceId: z.string(),
  targetMemberId: z.string(),
  isTransfer: z.boolean().optional(),
});

export const respondToSwapInput = z.object({
  swapRequestId: z.string(),
  accepted: z.boolean(),
});

// ─── Chore Sets ─────────────────────────────────────────────────

export const createChoreSetInput = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
});

export const updateChoreSetInput = z.object({
  id: z.string(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().nullable().optional(),
});

export const deleteChoreSetInput = z.object({
  id: z.string(),
});

export const addChoreToSetInput = z.object({
  choreId: z.string(),
  choreSetId: z.string(),
});

export const removeChoreFromSetInput = z.object({
  choreId: z.string(),
});

// ─── Fairness ────────────────────────────────────────────────────

export const fairnessStatsInput = z.object({
  days: z.number().int().min(7).max(365).default(30),
});
