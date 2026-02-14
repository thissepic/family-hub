# Chore Rotation System

Family Hub automates the assignment of household chores to family members using a rotation system built on recurrence rules and configurable algorithms.

## Key Concepts

### Chore

A recurring household task (e.g., "Take out trash") with:
- **Recurrence rule** (RRULE format) defining when it repeats
- **Recurrence start** date (anchor for the RRULE)
- **Rotation pool** (list of members who participate)
- **Rotation pattern** (algorithm for picking the next assignee)
- **Difficulty** (EASY / MEDIUM / HARD) for XP rewards
- Optional **verification** requirement (admin must approve completion)

### Period

A span of time between two RRULE occurrences. For example:
- A weekly chore has 7-day periods
- A daily chore has 1-day periods
- A biweekly chore has 14-day periods

Periods are computed dynamically from the RRULE, not stored in the database.

### Instance

A single assignment of a chore to a member for one period. The `ChoreInstance` model stores:

| Field | Description |
|---|---|
| `choreId` | Which chore |
| `assignedMemberId` | Who is responsible |
| `periodStart` | Start date of the period |
| `periodEnd` | End date of the period |
| `status` | Current state (see lifecycle below) |
| `completedAt` | When it was marked done |
| `verifiedAt` | When an admin verified it |

## Instance Lifecycle

```
                 ┌──────────┐
                 │ PENDING   │  ← created by instance generation
                 └────┬──────┘
                      │
        ┌─────────────┼──────────────┐
        ▼             ▼              ▼
  ┌──────────┐  ┌──────────────┐  ┌─────────┐
  │   DONE   │  │PENDING_REVIEW│  │ SKIPPED │  ← admin skips
  └──────────┘  └──────┬───────┘  └─────────┘
                       │
                ┌──────┴──────┐
                ▼             ▼
          ┌──────────┐  (rejected → stays PENDING_REVIEW
          │   DONE   │   or reset to PENDING)
          └──────────┘

  If not completed by periodEnd → status changes to OVERDUE
```

**Transitions:**
- `PENDING` -> `DONE`: Member completes (no verification needed). Awards XP.
- `PENDING` -> `PENDING_REVIEW`: Member completes (verification needed). XP awarded on verification.
- `PENDING` -> `SKIPPED`: Admin skips the instance. No XP.
- `PENDING` -> `OVERDUE`: Period ends without completion.
- `PENDING_REVIEW` -> `DONE`: Admin verifies.

## Period Calculation

Periods are derived from the chore's RRULE using the `rrule` library.

**Algorithm** (`periods.ts`):

```
getCurrentPeriodFromRule(recurrenceRule, recurrenceStart, referenceDate):
  1. Parse RRULE with dtstart = recurrenceStart
  2. Find most recent occurrence on or before referenceDate → periodStart
  3. Find next occurrence after periodStart → nextOccurrence
  4. periodEnd = nextOccurrence - 1 day
  5. Return { start: periodStart, end: periodEnd }
```

**Examples:**

| RRULE | Anchor | Reference | Period |
|---|---|---|---|
| `FREQ=WEEKLY;BYDAY=MO` | 2025-01-06 | 2025-01-15 (Wed) | Jan 13 - Jan 19 |
| `FREQ=DAILY` | 2025-01-01 | 2025-01-15 | Jan 15 - Jan 15 |
| `FREQ=MONTHLY;BYMONTHDAY=1` | 2025-01-01 | 2025-01-15 | Jan 1 - Jan 31 |

## Rotation Algorithms

Three algorithms are available, configured per chore via `rotationPattern`.

### ROUND_ROBIN

Sequential rotation through the pool, ordered by `sortOrder`.

```
Pool: [Alice(0), Bob(1), Carol(2)]

Period 1 → Alice  (first in pool)
Period 2 → Bob    (next after Alice)
Period 3 → Carol  (next after Bob)
Period 4 → Alice  (wrap around)
```

**Logic:**
1. Find the last assigned member in `pastInstances`
2. Find their index in the sorted pool
3. Return `pool[(index + 1) % pool.length]`

If the last assignee is no longer in the pool, restart from the first member.

### RANDOM

Deterministic pseudo-random selection using a seeded PRNG.

```
Pool: [Alice, Bob, Carol]

Period starting 2025-01-06 → seed = hash("2025-01-06T00:00:00.000Z")
  → Mulberry32 PRNG → Fisher-Yates shuffle → pick first
  → Result: Bob (deterministic — same date always gives same result)
```

**Key property:** The same period always produces the same assignment. This means:
- Re-running instance generation produces identical results
- No randomness-related bugs from duplicate runs
- The seed is derived from `periodStart.toISOString()`

### WEIGHTED

Load-balancing based on historical completion counts. Assigns to the member with the fewest past instances.

```
Pool: [Alice, Bob, Carol]
Past instances: Alice(5), Bob(3), Carol(5)

Minimum count = 3 (Bob)
→ Bob gets the next assignment

Tie-breaking: first member by sortOrder wins
```

**Logic:**
1. Count past instances per pool member
2. Find the minimum count
3. Pick the first member (by `sortOrder`) with that minimum count

## Instance Generation

Instances are generated lazily, not eagerly for all future periods. The function `ensureInstancesForChore()` creates instances for:

1. The **current period** (if no instance exists yet)
2. Optionally, the **next period** (for look-ahead in the UI)

**Algorithm** (`generate-instances.ts`):

```
ensureInstancesForChore(tx, choreId, { includeNext }):
  1. Fetch chore with assignees (sorted) and recent instances
  2. Compute current period from RRULE
  3. If no instance exists for current periodStart:
     a. pickNextAssignee(pattern, assignees, pastInstances, periodStart)
     b. Create ChoreInstance
  4. If includeNext:
     a. Compute next period
     b. Repeat step 3 for next period (with updated instances)
```

**Family-wide generation** (`ensureInstancesForFamily`) iterates all chores and calls `ensureInstancesForChore` for each, always including the next period.

## Swap Requests

Members can request to swap their assigned instance with another member.

**Flow:**

```
1. Alice has an instance for "Vacuum Living Room" this week
2. Alice calls chores.requestSwap({ instanceId, targetMemberId: bob.id })
3. ChoreSwapRequest created: status = PENDING
4. Bob sees the request in chores.mySwapRequests
5. Bob calls chores.respondToSwap({ requestId, accept: true })
6. If accepted:
   - Instance.assignedMemberId changes from Alice → Bob
   - SwapRequest.status = ACCEPTED
7. If declined:
   - SwapRequest.status = DECLINED
   - Instance unchanged
```

## XP Rewards

Completing a chore instance awards XP based on difficulty:

| Difficulty | XP | Color | Icon |
|---|---|---|---|
| EASY | 5 XP | Green | Zap |
| MEDIUM | 15 XP | Amber | Flame |
| HARD | 30 XP | Red | Crown |

These are base values before the streak multiplier is applied. See [Rewards System](./rewards-system.md) for the full XP pipeline.

## Chore Categories

Default categories for organizing chores:

- General, Kitchen, Bathroom, Bedroom, Living Room, Outdoor, Laundry, Pets

## Chore Sets

Chores can be grouped into sets (e.g., "Morning Routine", "Weekend Deep Clean"). Sets are purely organizational and have no effect on rotation or scheduling.
