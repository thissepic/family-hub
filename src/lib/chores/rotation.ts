import type { RotationPattern } from "@prisma/client";

interface Assignee {
  memberId: string;
  sortOrder: number;
}

interface PastInstance {
  assignedMemberId: string;
}

/**
 * Mulberry32 — a simple seeded 32-bit PRNG.
 * Returns a function that produces numbers in [0, 1).
 */
function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Create a numeric seed from a string (simple hash).
 */
function hashString(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    const char = s.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32-bit integer
  }
  return hash;
}

/**
 * Fisher-Yates shuffle using a seeded PRNG.
 */
function seededShuffle<T>(arr: T[], rng: () => number): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Pick the next assignee for a chore based on the rotation pattern.
 *
 * @param pattern      - The rotation algorithm to use
 * @param assignees    - The chore's rotation pool (sorted by sortOrder)
 * @param pastInstances - Previous instances (newest first) for context
 * @param periodStart  - The start date of the period being generated
 * @returns memberId of the chosen assignee
 */
export function pickNextAssignee(
  pattern: RotationPattern,
  assignees: Assignee[],
  pastInstances: PastInstance[],
  periodStart: Date
): string {
  if (assignees.length === 0) {
    throw new Error("Cannot pick assignee from empty list");
  }
  if (assignees.length === 1) {
    return assignees[0].memberId;
  }

  // Sort by sortOrder for consistent ordering
  const sorted = [...assignees].sort((a, b) => a.sortOrder - b.sortOrder);

  switch (pattern) {
    case "ROUND_ROBIN": {
      if (pastInstances.length === 0) {
        return sorted[0].memberId;
      }
      const lastAssigned = pastInstances[0].assignedMemberId;
      const lastIndex = sorted.findIndex((a) => a.memberId === lastAssigned);
      if (lastIndex === -1) {
        // Last assignee no longer in pool
        return sorted[0].memberId;
      }
      return sorted[(lastIndex + 1) % sorted.length].memberId;
    }

    case "RANDOM": {
      // Deterministic: same period always picks the same member
      const seed = hashString(periodStart.toISOString());
      const rng = mulberry32(seed);
      const shuffled = seededShuffle(sorted, rng);
      return shuffled[0].memberId;
    }

    case "WEIGHTED": {
      // Count how many past instances each assignee has
      const counts = new Map<string, number>();
      for (const a of sorted) {
        counts.set(a.memberId, 0);
      }
      for (const inst of pastInstances) {
        const current = counts.get(inst.assignedMemberId);
        if (current !== undefined) {
          counts.set(inst.assignedMemberId, current + 1);
        }
      }
      // Find minimum count
      let minCount = Infinity;
      for (const count of counts.values()) {
        if (count < minCount) minCount = count;
      }
      // Pick first member (by sortOrder) with minimum count
      for (const a of sorted) {
        if (counts.get(a.memberId) === minCount) {
          return a.memberId;
        }
      }
      // Fallback
      return sorted[0].memberId;
    }
  }
}
