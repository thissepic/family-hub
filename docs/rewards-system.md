# Rewards System (XP Engine)

Family Hub includes a gamification layer that awards XP for task and chore completions, tracks streaks, unlocks achievements, and lets members redeem points in a rewards shop.

Source files: `src/lib/rewards/xp-engine.ts` and `src/lib/rewards/constants.ts`.

## Level Progression

Members progress through 10 levels based on total XP earned:

| Level | Name | XP Required | XP to Next |
|---|---|---|---|
| 1 | Beginner | 0 | 100 |
| 2 | Helper | 100 | 150 |
| 3 | Contributor | 250 | 250 |
| 4 | Achiever | 500 | 500 |
| 5 | Star | 1,000 | 1,000 |
| 6 | Champion | 2,000 | 2,000 |
| 7 | Hero | 4,000 | 3,500 |
| 8 | Master | 7,500 | 4,500 |
| 9 | Elite | 12,000 | 8,000 |
| 10 | Legend | 20,000 | -- (max) |

Level names are i18n keys (e.g., `rewards.levelBeginner`) to support translation.

## XP Sources

| Source | Trigger | Default Base XP |
|---|---|---|
| `TASK_COMPLETION` | Completing a task | LOW: 5, MEDIUM: 10, HIGH: 20 |
| `CHORE_COMPLETION` | Completing a chore | EASY: 10, MEDIUM: 25, HARD: 50 |
| `STREAK_BONUS` | Maintaining a streak | Automatic (via multiplier) |
| `SWAP_BONUS` | Accepting a chore swap | Configurable |
| `CUSTOM` | Admin-awarded or achievement bonus | Variable |

Base XP values are configurable per family in `XpSettings.taskXpValues` and `XpSettings.choreXpValues`.

## XP Award Pipeline

The `awardXp()` function runs inside a Prisma transaction. Every step must succeed or the entire award is rolled back.

```
Input: { memberId, familyId, xpAmount, source, description }
                    │
                    ▼
  1. Fetch XpSettings (multipliers, points ratio, mode)
                    │
                    ▼
  2. Update streak
     ├── Check: was there a completion yesterday?
     ├── Check: was there a completion already today?
     ├── If yesterday activity exists → increment streak
     ├── If today already counted → keep current streak
     └── Otherwise → reset streak to 1
                    │
                    ▼
  3. Calculate streak multiplier
     │   Streak ≥ 7 days  → 1.5x
     │   Streak ≥ 14 days → 2.0x
     │   Streak ≥ 30 days → 3.0x
     │   (thresholds configurable in XpSettings.streakMultipliers)
                    │
                    ▼
  4. finalXp = round(baseXp * multiplier)
     pointsAwarded = round(finalXp * pointsPerXpRatio)
     (default ratio: 0.1, so 100 XP = 10 points)
                    │
                    ▼
  5. Create XpEvent record (audit trail)
     { xpAmount, pointsAmount, source, multiplier, description }
                    │
                    ▼
  6. Update MemberXpProfile
     totalXp += finalXp
     points += pointsAwarded
                    │
                    ▼
  7. Recalculate level from new totalXp
     If level increased → leveledUp = true
                    │
                    ▼
  8. If leveledUp:
     ├── Create LEVEL_UP notification
     ├── Create LEVEL_UP activity event
     └── Queue push notification (deferred)
                    │
                    ▼
  9. If mode = COLLABORATIVE:
     ├── Find active FamilyGoal
     ├── Increment goal.currentXp by finalXp
     └── If goal reached → mark COMPLETED
                    │
                    ▼
  10. Evaluate achievements
      (see Achievement System below)
                    │
                    ▼
  Return: { xpAwarded, pointsAwarded, newLevel, leveledUp, achievementsUnlocked, pendingPush }
```

After the transaction commits, `flushPendingPush()` sends all queued Web Push notifications.

## XP Removal

When a completion is undone (`uncomplete` on task or chore), XP is removed:

1. Find all `XpEvent` records matching `{ memberId, source, sourceId }`
2. Sum their `xpAmount` and `pointsAmount`
3. Delete the events
4. Subtract from `MemberXpProfile` (clamped to 0)
5. Recalculate level (may decrease)

## Streak System

Streaks track consecutive days of activity (task or chore completions).

**Logic** (`updateStreak`):

```
On each completion:
  1. Was there an XP event (task/chore) yesterday? → yesterdayActive
  2. Was there an XP event (task/chore) already today? → todayActive
  3. Decision:
     - yesterdayActive OR (todayActive AND streak > 0) → continue streak
       - If todayActive → keep currentStreak (already counted today)
       - If not todayActive → currentStreak + 1 (first activity today)
     - Otherwise → new streak starts at 1
  4. longestStreak = max(longestStreak, currentStreak)
```

**Edge cases:**
- First completion ever: streak = 1
- Multiple completions in one day: streak only increments once
- Gap of 1+ day: streak resets to 1

### Streak Multipliers

Multipliers reward sustained activity. The highest applicable multiplier is used.

| Streak | Default Multiplier |
|---|---|
| < 7 days | 1.0x (no bonus) |
| 7+ days | 1.5x |
| 14+ days | 2.0x |
| 30+ days | 3.0x |

Thresholds and multipliers are configurable per family in `XpSettings.streakMultipliers`.

## Achievement System

Achievements are badges that unlock when conditions are met.

### Condition Types

| Type | Parameter | Checks |
|---|---|---|
| `task_count` | threshold (number) | Total task completions |
| `chore_count` | threshold (number) | Total chore completions |
| `streak_days` | threshold (number) | Current streak length |
| `total_xp` | threshold (number) | Lifetime XP |
| `level_reached` | threshold (number) | Current level |

Conditions are stored as JSON in `Achievement.condition`: `{ "type": "task_count", "threshold": 50 }`.

### Default Achievements

| Name | Condition | Rarity | XP Reward | Points |
|---|---|---|---|---|
| First Steps | 1 task | COMMON | 10 | 1 |
| Helping Hand | 10 tasks | COMMON | 25 | 3 |
| Task Master | 50 tasks | RARE | 100 | 10 |
| Tidy Up | 1 chore | COMMON | 10 | 1 |
| Clean Machine | 25 chores | RARE | 75 | 8 |
| On a Roll | 7-day streak | RARE | 50 | 5 |
| Unstoppable | 30-day streak | EPIC | 200 | 20 |
| XP Legend | 10,000 total XP | LEGENDARY | 500 | 50 |

Admins can create custom achievements with any condition type.

### Rarity Tiers

| Rarity | Color | Border |
|---|---|---|
| COMMON | Gray (#6b7280) | `border-gray-400` |
| RARE | Blue (#3b82f6) | `border-blue-400` |
| EPIC | Purple (#8b5cf6) | `border-purple-400` |
| LEGENDARY | Gold (#f59e0b) | `border-amber-400` |

### Evaluation Process

Achievement evaluation runs after every XP award (step 10 of the pipeline):

```
evaluateAchievements(tx, { memberId, familyId }):
  1. Fetch all enabled achievements for the family
  2. Fetch already-unlocked achievement IDs for this member
  3. Fetch member stats (profile, task count, chore count)
  4. For each non-unlocked achievement:
     a. Check condition against stats
     b. If met:
        - Create MemberAchievement record
        - Award achievement XP/points (if any)
        - Create ACHIEVEMENT notification
        - Create ACHIEVEMENT_UNLOCKED activity event
        - Queue push notification
  5. Return list of newly unlocked names
```

Achievements can only be unlocked once per member.

## Reward Redemption

Members spend earned **points** (not XP) on rewards defined by admins.

**Flow:**

```
1. Admin creates a reward: { name, pointsCost, requiresApproval }
2. Member calls rewards.redeem({ rewardId })
3. Points deducted from MemberXpProfile.points
4. RewardRedemption created:
   - If requiresApproval: status = PENDING_APPROVAL
   - If not: status = APPROVED (instant)
5. Admin reviews pending redemptions:
   - rewards.reviewRedemption({ id, approve: true/false })
   - If declined: points are refunded
```

## Game Modes

Two modes are available, configurable per family in `XpSettings.mode`:

| Mode | Description |
|---|---|
| `COMPETITIVE` | Individual leaderboards, each member competes for XP |
| `COLLABORATIVE` | All XP contributes to a shared FamilyGoal; leaderboard still visible |

In `COLLABORATIVE` mode, every XP award also increments the active `FamilyGoal.currentXp`. When `currentXp >= targetXp`, the goal is marked `COMPLETED`.

## Configuration

All XP values are configurable per family via `rewards.updateSettings`:

```json
{
  "taskXpValues": { "LOW": 5, "MEDIUM": 10, "HIGH": 20 },
  "choreXpValues": { "EASY": 10, "MEDIUM": 25, "HARD": 50 },
  "streakMultipliers": { "7": 1.5, "14": 2.0, "30": 3.0 },
  "pointsPerXpRatio": 0.1,
  "mode": "COMPETITIVE"
}
```
