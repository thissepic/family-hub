# Database Schema

Family Hub uses PostgreSQL 16 with Prisma 6 as the ORM. The schema is defined in `packages/db/prisma/schema.prisma`.

## Overview

- **41 models** across 9 domains
- **27 enums** for type-safe status fields
- All IDs are UUIDs (`@default(cuid())`)
- Timestamps: `createdAt` / `updatedAt` on all models
- Cascading deletes where appropriate (family deletion removes all child data)

## Entity Relationship Diagram

```
User (1)
  │
  ├── (1:N) FamilyMember (via userId)
  ├── (1:N) OAuthAccount
  ├── (1:N) EmailToken
  ├── (1:N) TwoFactorRecoveryCode
  ├── (1:N) LoginAttempt
  ├── (1:N) ActiveSession
  └── (1:N) EmailPreference

Family (1)
  │
  ├── (1:N) FamilyMember
  │           ├── (N:1) User (optional, via userId)
  │           ├── (1:N) FamilyInvitation (as invitedBy)
  │           ├── (1:N) FamilyInvitation (as forMember, optional)
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
  ├── (1:N) FamilyInvitation
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
  └── (1:N) ActivityEvent
```

## Core Models

### User (Authentication)

| Model | Purpose | Key Fields |
|---|---|---|
| **User** | Standalone user account (decoupled from families) | `email` (unique), `passwordHash` (nullable for OAuth-only), `emailVerified`, `twoFactorEnabled`, `twoFactorSecret` (encrypted), `defaultLocale`, `theme` |

A user registers with an email and password (bcrypt-hashed) or via OAuth (Google/Microsoft), in which case `passwordHash` is null. Users can belong to multiple families. If 2FA is enabled, `twoFactorSecret` stores the encrypted TOTP secret.

### Family & Members

| Model | Purpose | Key Fields |
|---|---|---|
| **Family** | Root entity for a household | `name`, `defaultLocale`, `theme` |
| **FamilyMember** | A person in the family, optionally linked to a User | `name`, `userId` (optional FK to User), `pinHash` (nullable), `role` (ADMIN/MEMBER), `avatar`, `color`, `locale`, `themePreference` |

A family has no authentication fields &mdash; all auth is on the User model. Members with `userId` set are linked to a user account and can log in directly. Unlinked members (`userId = null`) use a bcrypt-hashed PIN for profile authentication. The `@@unique([familyId, userId])` constraint ensures one user has at most one profile per family.

### Family Invitations

| Model | Purpose | Key Fields |
|---|---|---|
| **FamilyInvitation** | Invite someone to join a family | `familyId`, `email` (optional), `role`, `token` (unique), `status` (InvitationStatus), `invitedById` (FK to FamilyMember), `forMemberId` (optional FK to FamilyMember), `expiresAt`, `acceptedAt` |

Invitations can be created with or without an email. If `email` is set, an invitation email is sent. If `forMemberId` is set, accepting the invitation links the user to the existing unlinked member profile instead of creating a new one. Indexed on `familyId`, `token`, `email`, and `forMemberId`.

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

### OAuth, Tokens & Email Preferences

| Model | Purpose | Key Fields |
|---|---|---|
| **OAuthAccount** | Links a user to an OAuth provider identity | `userId`, `provider` (GOOGLE/MICROSOFT), `providerAccountId`, `email`, `displayName` |
| **EmailToken** | Hashed tokens for email verification, password reset, and email change | `userId`, `tokenHash` (unique, SHA-256), `type` (VERIFICATION/PASSWORD_RESET/EMAIL_CHANGE), `expiresAt`, `usedAt`, `metadata` (JSON) |
| **TwoFactorRecoveryCode** | Bcrypt-hashed single-use recovery codes for 2FA | `userId`, `codeHash`, `usedAt` |
| **EmailPreference** | Per-user email notification settings | `userId`, `type` (EmailNotificationType), `enabled` |

`OAuthAccount` has a composite unique constraint on `(provider, providerAccountId)` and is indexed on `(provider, email)`. When a user registers or logs in via OAuth, the provider identity is stored here. A user can have multiple linked OAuth accounts.

`EmailToken` stores SHA-256 hashed tokens (raw tokens are sent via email). Old unused tokens of the same type are auto-deleted when a new token is created. Token TTLs: VERIFICATION (24h), PASSWORD_RESET (1h), EMAIL_CHANGE (24h).

`TwoFactorRecoveryCode` stores 10 bcrypt-hashed codes per user. Codes are single-use (marked with `usedAt` on consumption). All codes are regenerated at once.

`EmailPreference` has a unique constraint on `(userId, type)`. Controls which security notification emails (2FA status changes, OAuth linking, email changes) are sent.

### Security & Sessions

| Model | Purpose | Key Fields |
|---|---|---|
| **LoginAttempt** | Tracks login attempts for rate limiting | `userId`, `email`, `ipAddress`, `userAgent`, `success`, `failureReason` |
| **ActiveSession** | Tracks active authenticated sessions | `userId`, `familyId` (optional), `memberId` (optional), `sessionToken` (unique), `ipAddress`, `userAgent`, `lastActivity`, `expiresAt` |

Login attempts are indexed by `email`, `ipAddress`, and `createdAt` for efficient rate limiting lookups. Active sessions are tracked to allow users to view and invalidate sessions remotely from Account Settings.

## Enums Reference

### Roles & Status

| Enum | Values |
|---|---|
| `MemberRole` | `ADMIN`, `MEMBER` |
| `InvitationStatus` | `PENDING`, `ACCEPTED`, `DECLINED`, `EXPIRED` |
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

### Authentication Enums

| Enum | Values |
|---|---|
| `OAuthProvider` | `GOOGLE`, `MICROSOFT` |
| `EmailTokenType` | `VERIFICATION`, `PASSWORD_RESET`, `EMAIL_CHANGE` |
| `EmailNotificationType` | `TWO_FACTOR_ENABLED`, `TWO_FACTOR_DISABLED`, `OAUTH_LINKED`, `OAUTH_UNLINKED`, `EMAIL_CHANGE_NOTIFICATION` |

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

The seed script is defined in `packages/db/seed.ts` and configured in `prisma.config.ts`.

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
