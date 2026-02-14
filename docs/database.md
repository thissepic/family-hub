# Database Schema

Family Hub uses PostgreSQL 16 with Prisma 6 as the ORM. The schema is defined in `packages/db/prisma/schema.prisma`.

## Overview

- **34 models** across 7 domains
- **23 enums** for type-safe status fields
- All IDs are UUIDs (`@default(cuid())`)
- Timestamps: `createdAt` / `updatedAt` on all models
- Cascading deletes where appropriate (family deletion removes all child data)

## Entity Relationship Diagram

```
Family (1)
  │
  ├── (1:N) FamilyMember
  │           ├── (1:N) CalendarEvent (createdById)
  │           ├── (1:N) EventAssignee
  │           ├── (1:N) Task (createdById)
  │           ├── (1:N) TaskAssignee
  │           ├── (1:N) TaskCompletion
  │           ├── (1:N) ChoreAssignee
  │           ├── (1:N) ChoreInstance (assignedMemberId)
  │           ├── (1:N) ChoreSwapRequest (requesterId / targetId)
  │           ├── (1:N) ExternalCalendarConnection
  │           ├── (1:N) Note (createdById)
  │           ├── (1:1) MemberXpProfile
  │           ├── (1:N) XpEvent
  │           ├── (1:N) MemberAchievement
  │           ├── (1:N) RewardRedemption
  │           ├── (1:N) Notification
  │           ├── (1:N) NotificationPreference
  │           ├── (1:N) PushSubscription
  │           └── (1:N) ActivityEvent
  │
  ├── (1:N) CalendarEvent
  ├── (1:N) Task
  ├── (1:N) Chore
  │           ├── (1:N) ChoreAssignee
  │           ├── (1:N) ChoreInstance
  │           └── (N:1) ChoreSet (optional)
  ├── (1:N) ChoreSet
  ├── (1:N) ShoppingList
  │           └── (1:N) ShoppingItem
  ├── (1:N) MealPlan
  ├── (1:N) Recipe
  │           └── (1:N) RecipeIngredient
  ├── (1:N) Note
  │           └── (1:N) NoteAttachment
  ├── (1:N) Achievement
  ├── (1:N) Reward
  ├── (1:N) FamilyGoal
  ├── (1:1) XpSettings
  ├── (1:1) HubDisplaySettings
  ├── (1:N) ActivityEvent
  ├── (1:N) LoginAttempt
  └── (1:N) ActiveSession
```

## Core Models

### Family & Members

| Model | Purpose | Key Fields |
|---|---|---|
| **Family** | Root entity for a household | `name`, `email` (unique), `passwordHash`, `emailVerified`, `defaultLocale`, `theme` |
| **FamilyMember** | A person in the family | `name`, `pinHash`, `role` (ADMIN/MEMBER), `avatar`, `color`, `locale`, `themePreference` |

A family registers with an email and password (bcrypt-hashed). Each member has a bcrypt-hashed PIN for profile authentication and an optional personal locale override.

### Calendar

| Model | Purpose | Key Fields |
|---|---|---|
| **CalendarEvent** | A calendar event (local or synced) | `title`, `startAt`, `endAt`, `allDay`, `recurrenceRule`, `source`, `category`, `externalId` |
| **EventAssignee** | Links events to members (M:N) | `eventId`, `memberId` |
| **ExternalCalendarConnection** | OAuth/credential link to a provider | `provider`, `accessToken` (encrypted), `refreshToken` (encrypted), `status`, `syncIntervalMinutes` |
| **ExternalCalendar** | A single calendar within a connection | `externalCalendarId`, `name`, `syncEnabled`, `privacyMode`, `syncDirection`, `lastSyncToken` |

Events with `source = LOCAL` are created within Family Hub. Synced events have `source` set to the provider (GOOGLE, APPLE, OUTLOOK, etc.) and carry an `externalId` for upsert matching.

### Tasks

| Model | Purpose | Key Fields |
|---|---|---|
| **Task** | A recurring or one-off task | `title`, `recurrenceRule`, `priority` (LOW/MEDIUM/HIGH) |
| **TaskAssignee** | Links tasks to members (M:N) | `taskId`, `memberId` |
| **TaskCompletion** | Tracks daily completions | `taskId`, `memberId`, `completedDate` |

Tasks support RRULE-based recurrence. Completions are tracked per date to allow recurring tasks.

### Chores

| Model | Purpose | Key Fields |
|---|---|---|
| **Chore** | A household chore with rotation | `title`, `recurrenceRule`, `recurrenceStart`, `rotationPattern`, `difficulty`, `needsVerification` |
| **ChoreSet** | Grouping of related chores | `name`, `familyId` |
| **ChoreAssignee** | Members in the rotation pool | `choreId`, `memberId`, `sortOrder` |
| **ChoreInstance** | A single assignment for one period | `choreId`, `assignedMemberId`, `periodStart`, `periodEnd`, `status` |
| **ChoreSwapRequest** | Request to swap an instance | `instanceId`, `requesterId`, `targetId`, `status` |

See [Chore Rotation](./chore-rotation.md) for details on the rotation algorithm.

### Shopping

| Model | Purpose | Key Fields |
|---|---|---|
| **ShoppingList** | Container for items | `name`, `familyId` |
| **ShoppingItem** | A single item on the list | `name`, `quantity`, `unit`, `category`, `checked`, `isRecurring`, `addedById` |

### Meals

| Model | Purpose | Key Fields |
|---|---|---|
| **MealPlan** | A planned meal on a date | `date`, `slot` (BREAKFAST/LUNCH/DINNER/SNACK), `recipeId` |
| **Recipe** | A stored recipe | `title`, `instructions`, `servings`, `prepTimeMinutes`, `cookTimeMinutes` |
| **RecipeIngredient** | An ingredient within a recipe | `name`, `amount`, `unit` |

### Notes

| Model | Purpose | Key Fields |
|---|---|---|
| **Note** | A rich-text note | `title`, `body` (JSON, Tiptap format), `isPinned`, `color` |
| **NoteAttachment** | File attachment on a note | `noteId`, `fileName`, `filePath`, `mimeType`, `sizeBytes` |

### Gamification (XP & Rewards)

| Model | Purpose | Key Fields |
|---|---|---|
| **MemberXpProfile** | Per-member XP state | `totalXp`, `level`, `points`, `currentStreak`, `longestStreak` |
| **XpEvent** | Audit trail of XP changes | `xpAmount`, `pointsAmount`, `source`, `multiplier`, `description` |
| **Achievement** | Badge definitions (family-wide) | `name`, `condition` (JSON), `rarity`, `xpReward`, `pointsReward`, `enabled` |
| **MemberAchievement** | Badge unlock per member | `memberId`, `achievementId`, `unlockedAt` |
| **Reward** | Redeemable items | `name`, `description`, `pointsCost`, `requiresApproval` |
| **RewardRedemption** | Purchase history | `memberId`, `rewardId`, `status` (PENDING_APPROVAL/APPROVED/DECLINED) |
| **FamilyGoal** | Shared XP goal | `title`, `targetXp`, `currentXp`, `status` (ACTIVE/COMPLETED) |
| **XpSettings** | Family-wide XP configuration | `taskXpValues` (JSON), `choreXpValues` (JSON), `streakMultipliers` (JSON), `pointsPerXpRatio`, `mode` |

See [Rewards System](./rewards-system.md) for details on the XP engine.

### Notifications & Activity

| Model | Purpose | Key Fields |
|---|---|---|
| **Notification** | In-app notification | `type`, `title`, `message`, `read`, `linkUrl` |
| **NotificationPreference** | Per-member mute settings | `memberId`, `type`, `muted` |
| **PushSubscription** | Web Push endpoint | `memberId`, `endpoint`, `p256dh`, `auth` |
| **ActivityEvent** | Family activity feed entry | `type`, `description`, `sourceModule`, `sourceId` |

### Hub Display

| Model | Purpose | Key Fields |
|---|---|---|
| **HubDisplaySettings** | Kiosk configuration | `visiblePanels` (JSON), `layoutMode`, `rotationEnabled`, `rotationIntervalSec`, `theme`, `fontScale`, `nightDimEnabled`, `weatherEnabled`, `accessToken` |

### Security & Sessions

| Model | Purpose | Key Fields |
|---|---|---|
| **LoginAttempt** | Tracks login attempts for rate limiting | `familyId`, `email`, `ipAddress`, `userAgent`, `success`, `failureReason` |
| **ActiveSession** | Tracks active authenticated sessions | `familyId`, `memberId`, `sessionToken` (unique), `ipAddress`, `userAgent`, `lastActivity`, `expiresAt` |

Login attempts are indexed by `email`, `ipAddress`, and `createdAt` for efficient rate limiting lookups. Active sessions are tracked to allow admins to view and invalidate sessions remotely.

## Enums Reference

### Roles & Status

| Enum | Values |
|---|---|
| `MemberRole` | `ADMIN`, `MEMBER` |
| `ConnectionStatus` | `ACTIVE`, `EXPIRED`, `REVOKED` |
| `ChoreInstanceStatus` | `PENDING`, `DONE`, `PENDING_REVIEW`, `OVERDUE`, `SKIPPED` |
| `SwapRequestStatus` | `PENDING`, `ACCEPTED`, `DECLINED` |
| `RedemptionStatus` | `PENDING_APPROVAL`, `APPROVED`, `DECLINED` |
| `GoalStatus` | `ACTIVE`, `COMPLETED` |

### Type Classifications

| Enum | Values |
|---|---|
| `CalendarEventSource` | `LOCAL`, `GOOGLE`, `APPLE`, `OUTLOOK`, `CALDAV`, `EXCHANGE_EWS` |
| `CalendarEventCategory` | `SCHOOL`, `WORK`, `MEDICAL`, `SPORTS`, `SOCIAL`, `FAMILY`, `OTHER` |
| `CalendarProvider` | `GOOGLE`, `APPLE`, `OUTLOOK`, `CALDAV`, `EXCHANGE_EWS` |
| `TaskPriority` | `LOW`, `MEDIUM`, `HIGH` |
| `ChoreDifficulty` | `EASY`, `MEDIUM`, `HARD` |
| `MealSlot` | `BREAKFAST`, `LUNCH`, `DINNER`, `SNACK` |
| `XpSource` | `TASK_COMPLETION`, `CHORE_COMPLETION`, `STREAK_BONUS`, `SWAP_BONUS`, `CUSTOM` |
| `AchievementRarity` | `COMMON`, `RARE`, `EPIC`, `LEGENDARY` |
| `NotificationType` | `CALENDAR_REMINDER`, `CHORE_DEADLINE`, `SWAP_REQUEST`, `REWARD_APPROVAL`, `ACHIEVEMENT`, `LEVEL_UP`, `ADMIN_ANNOUNCEMENT` |
| `ActivityEventType` | `TASK_COMPLETED`, `CHORE_COMPLETED`, `EVENT_CREATED`, `EVENT_UPDATED`, `SHOPPING_ITEM_ADDED`, `MEAL_PLANNED`, `NOTE_PINNED`, `ACHIEVEMENT_UNLOCKED`, `LEVEL_UP`, `REWARD_REDEEMED` |

### Configuration Enums

| Enum | Values |
|---|---|
| `RotationPattern` | `ROUND_ROBIN`, `RANDOM`, `WEIGHTED` |
| `PrivacyMode` | `FULL_DETAILS`, `BUSY_FREE_ONLY` |
| `SyncDirection` | `INBOUND_ONLY`, `TWO_WAY` |
| `XpMode` | `COMPETITIVE`, `COLLABORATIVE` |
| `HubLayoutMode` | `AUTO`, `CUSTOM` |
| `FontScale` | `SMALL`, `MEDIUM`, `LARGE`, `XL` |
| `ThemeMode` | `LIGHT`, `DARK`, `AUTO` |

## Database Management

### Migrations

```bash
# Create a new migration after schema changes
npx prisma migrate dev --name description_of_change

# Apply pending migrations (production)
npx prisma migrate deploy

# Reset database (development only)
npx prisma migrate reset
```

### Seeding

```bash
# Run the seed script
npx prisma db seed
```

The seed script is defined in `packages/db/seed.ts` and configured in `package.json` under the `prisma.seed` key.

### Prisma Studio

```bash
# Open the database GUI
npx prisma studio
```

### Backups

Automated daily backups run via BullMQ at 3:30 AM:
- Format: `familyhub_YYYY-MM-DD.sql.gz`
- Location: `BACKUP_DIR` (default: `/backups`)
- Retention: `BACKUP_RETENTION_DAYS` (default: 7 days)
