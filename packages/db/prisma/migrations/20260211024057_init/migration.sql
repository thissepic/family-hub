-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "CalendarEventSource" AS ENUM ('LOCAL', 'GOOGLE', 'APPLE', 'OUTLOOK', 'CALDAV');

-- CreateEnum
CREATE TYPE "CalendarEventCategory" AS ENUM ('SCHOOL', 'WORK', 'MEDICAL', 'SPORTS', 'SOCIAL', 'FAMILY', 'OTHER');

-- CreateEnum
CREATE TYPE "CalendarProvider" AS ENUM ('GOOGLE', 'APPLE', 'OUTLOOK', 'CALDAV');

-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "PrivacyMode" AS ENUM ('FULL_DETAILS', 'BUSY_FREE_ONLY');

-- CreateEnum
CREATE TYPE "SyncDirection" AS ENUM ('INBOUND_ONLY', 'TWO_WAY');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "ChoreFrequency" AS ENUM ('DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "ChoreDifficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "RotationPattern" AS ENUM ('ROUND_ROBIN', 'RANDOM', 'WEIGHTED');

-- CreateEnum
CREATE TYPE "ChoreInstanceStatus" AS ENUM ('PENDING', 'DONE', 'PENDING_REVIEW', 'OVERDUE', 'SKIPPED');

-- CreateEnum
CREATE TYPE "SwapRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

-- CreateEnum
CREATE TYPE "MealSlot" AS ENUM ('BREAKFAST', 'LUNCH', 'DINNER', 'SNACK');

-- CreateEnum
CREATE TYPE "XpSource" AS ENUM ('TASK_COMPLETION', 'CHORE_COMPLETION', 'STREAK_BONUS', 'SWAP_BONUS', 'CUSTOM');

-- CreateEnum
CREATE TYPE "AchievementRarity" AS ENUM ('COMMON', 'RARE', 'EPIC', 'LEGENDARY');

-- CreateEnum
CREATE TYPE "RedemptionStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'DECLINED');

-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('ACTIVE', 'COMPLETED');

-- CreateEnum
CREATE TYPE "XpMode" AS ENUM ('COMPETITIVE', 'COLLABORATIVE');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('CALENDAR_REMINDER', 'CHORE_DEADLINE', 'SWAP_REQUEST', 'REWARD_APPROVAL', 'ACHIEVEMENT', 'LEVEL_UP', 'ADMIN_ANNOUNCEMENT');

-- CreateEnum
CREATE TYPE "ActivityEventType" AS ENUM ('TASK_COMPLETED', 'CHORE_COMPLETED', 'EVENT_CREATED', 'EVENT_UPDATED', 'SHOPPING_ITEM_ADDED', 'MEAL_PLANNED', 'NOTE_PINNED', 'ACHIEVEMENT_UNLOCKED', 'LEVEL_UP', 'REWARD_REDEEMED');

-- CreateEnum
CREATE TYPE "HubLayoutMode" AS ENUM ('AUTO', 'CUSTOM');

-- CreateEnum
CREATE TYPE "FontScale" AS ENUM ('SMALL', 'MEDIUM', 'LARGE', 'XL');

-- CreateEnum
CREATE TYPE "ThemeMode" AS ENUM ('LIGHT', 'DARK', 'AUTO');

-- CreateTable
CREATE TABLE "Family" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "defaultLocale" TEXT NOT NULL DEFAULT 'en',
    "theme" "ThemeMode" NOT NULL DEFAULT 'AUTO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Family_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyMember" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatar" TEXT,
    "color" TEXT NOT NULL DEFAULT '#3b82f6',
    "pinHash" TEXT NOT NULL,
    "role" "MemberRole" NOT NULL DEFAULT 'MEMBER',
    "locale" TEXT NOT NULL DEFAULT 'en',
    "themePreference" "ThemeMode" NOT NULL DEFAULT 'AUTO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FamilyMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarEvent" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "recurrenceRule" TEXT,
    "category" "CalendarEventCategory" NOT NULL DEFAULT 'OTHER',
    "createdById" TEXT,
    "source" "CalendarEventSource" NOT NULL DEFAULT 'LOCAL',
    "externalId" TEXT,
    "externalCalendarId" TEXT,
    "isReadOnly" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventAssignee" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,

    CONSTRAINT "EventAssignee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalCalendarConnection" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "provider" "CalendarProvider" NOT NULL,
    "accountLabel" TEXT NOT NULL,
    "accessTokenEncrypted" TEXT NOT NULL,
    "refreshTokenEncrypted" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "caldavUrl" TEXT,
    "syncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMP(3),
    "syncIntervalMinutes" INTEGER NOT NULL DEFAULT 15,
    "status" "ConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalCalendarConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalCalendar" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "externalCalendarId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "syncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "privacyMode" "PrivacyMode" NOT NULL DEFAULT 'FULL_DETAILS',
    "syncDirection" "SyncDirection" NOT NULL DEFAULT 'INBOUND_ONLY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalCalendar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "recurrenceRule" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskAssignee" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,

    CONSTRAINT "TaskAssignee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskCompletion" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chore" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'General',
    "frequency" "ChoreFrequency" NOT NULL DEFAULT 'WEEKLY',
    "difficulty" "ChoreDifficulty" NOT NULL DEFAULT 'MEDIUM',
    "estimatedMinutes" INTEGER,
    "needsVerification" BOOLEAN NOT NULL DEFAULT false,
    "rotationPattern" "RotationPattern" NOT NULL DEFAULT 'ROUND_ROBIN',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Chore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChoreAssignee" (
    "id" TEXT NOT NULL,
    "choreId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ChoreAssignee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChoreInstance" (
    "id" TEXT NOT NULL,
    "choreId" TEXT NOT NULL,
    "assignedMemberId" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "status" "ChoreInstanceStatus" NOT NULL DEFAULT 'PENDING',
    "completedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),

    CONSTRAINT "ChoreInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChoreSwapRequest" (
    "id" TEXT NOT NULL,
    "choreInstanceId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "targetMemberId" TEXT NOT NULL,
    "status" "SwapRequestStatus" NOT NULL DEFAULT 'PENDING',
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChoreSwapRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShoppingList" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Groceries',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShoppingList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShoppingItem" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" TEXT,
    "unit" TEXT,
    "category" TEXT,
    "addedById" TEXT,
    "checked" BOOLEAN NOT NULL DEFAULT false,
    "checkedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShoppingItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealPlan" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "slot" "MealSlot" NOT NULL,
    "recipeId" TEXT,
    "freeformName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recipe" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "instructions" TEXT,
    "servings" INTEGER,
    "prepTime" INTEGER,
    "cookTime" INTEGER,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "image" TEXT,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeIngredient" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" TEXT,
    "unit" TEXT,

    CONSTRAINT "RecipeIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" JSONB,
    "color" TEXT,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "category" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoteAttachment" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NoteAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HubDisplaySettings" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "visiblePanels" JSONB NOT NULL DEFAULT '[]',
    "layoutMode" "HubLayoutMode" NOT NULL DEFAULT 'AUTO',
    "columnConfig" JSONB,
    "rotationEnabled" BOOLEAN NOT NULL DEFAULT false,
    "rotationIntervalSec" INTEGER NOT NULL DEFAULT 30,
    "theme" "ThemeMode" NOT NULL DEFAULT 'DARK',
    "fontScale" "FontScale" NOT NULL DEFAULT 'MEDIUM',
    "nightDimEnabled" BOOLEAN NOT NULL DEFAULT false,
    "nightDimStart" TEXT DEFAULT '22:00',
    "nightDimEnd" TEXT DEFAULT '06:00',
    "weatherEnabled" BOOLEAN NOT NULL DEFAULT false,
    "weatherLocationLat" DOUBLE PRECISION,
    "weatherLocationLon" DOUBLE PRECISION,
    "accessToken" TEXT,

    CONSTRAINT "HubDisplaySettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberXpProfile" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "totalXp" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "points" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MemberXpProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XpEvent" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "xpAmount" INTEGER NOT NULL,
    "pointsAmount" INTEGER NOT NULL DEFAULT 0,
    "source" "XpSource" NOT NULL,
    "sourceId" TEXT,
    "multiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "description" TEXT NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "XpEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Achievement" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "iconUrl" TEXT,
    "condition" JSONB NOT NULL,
    "rarity" "AchievementRarity" NOT NULL DEFAULT 'COMMON',
    "xpReward" INTEGER NOT NULL DEFAULT 0,
    "pointsReward" INTEGER NOT NULL DEFAULT 0,
    "isCustom" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberAchievement" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reward" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "iconUrl" TEXT,
    "pointCost" INTEGER NOT NULL,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardRedemption" (
    "id" TEXT NOT NULL,
    "rewardId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "pointsSpent" INTEGER NOT NULL,
    "status" "RedemptionStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "RewardRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyGoal" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "targetXp" INTEGER NOT NULL,
    "currentXp" INTEGER NOT NULL DEFAULT 0,
    "rewardDescription" TEXT,
    "status" "GoalStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "FamilyGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XpSettings" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "taskXpValues" JSONB NOT NULL DEFAULT '{"LOW": 5, "MEDIUM": 10, "HIGH": 20}',
    "choreXpValues" JSONB NOT NULL DEFAULT '{"EASY": 10, "MEDIUM": 25, "HARD": 50}',
    "streakMultipliers" JSONB NOT NULL DEFAULT '{"7": 1.5, "14": 2.0, "30": 3.0}',
    "pointsPerXpRatio" DOUBLE PRECISION NOT NULL DEFAULT 0.1,
    "mode" "XpMode" NOT NULL DEFAULT 'COMPETITIVE',

    CONSTRAINT "XpSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "linkUrl" TEXT,
    "sourceModule" TEXT,
    "sourceId" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "pushSent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityEvent" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "type" "ActivityEventType" NOT NULL,
    "description" TEXT NOT NULL,
    "sourceModule" TEXT,
    "sourceId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FamilyMember_familyId_idx" ON "FamilyMember"("familyId");

-- CreateIndex
CREATE INDEX "CalendarEvent_familyId_idx" ON "CalendarEvent"("familyId");

-- CreateIndex
CREATE INDEX "CalendarEvent_startAt_idx" ON "CalendarEvent"("startAt");

-- CreateIndex
CREATE INDEX "CalendarEvent_externalId_source_idx" ON "CalendarEvent"("externalId", "source");

-- CreateIndex
CREATE UNIQUE INDEX "EventAssignee_eventId_memberId_key" ON "EventAssignee"("eventId", "memberId");

-- CreateIndex
CREATE INDEX "ExternalCalendarConnection_memberId_idx" ON "ExternalCalendarConnection"("memberId");

-- CreateIndex
CREATE INDEX "ExternalCalendar_connectionId_idx" ON "ExternalCalendar"("connectionId");

-- CreateIndex
CREATE INDEX "Task_familyId_idx" ON "Task"("familyId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskAssignee_taskId_memberId_key" ON "TaskAssignee"("taskId", "memberId");

-- CreateIndex
CREATE INDEX "TaskCompletion_taskId_idx" ON "TaskCompletion"("taskId");

-- CreateIndex
CREATE INDEX "TaskCompletion_memberId_idx" ON "TaskCompletion"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskCompletion_taskId_memberId_date_key" ON "TaskCompletion"("taskId", "memberId", "date");

-- CreateIndex
CREATE INDEX "Chore_familyId_idx" ON "Chore"("familyId");

-- CreateIndex
CREATE UNIQUE INDEX "ChoreAssignee_choreId_memberId_key" ON "ChoreAssignee"("choreId", "memberId");

-- CreateIndex
CREATE INDEX "ChoreInstance_choreId_idx" ON "ChoreInstance"("choreId");

-- CreateIndex
CREATE INDEX "ChoreInstance_assignedMemberId_idx" ON "ChoreInstance"("assignedMemberId");

-- CreateIndex
CREATE INDEX "ChoreInstance_periodStart_idx" ON "ChoreInstance"("periodStart");

-- CreateIndex
CREATE INDEX "ChoreSwapRequest_choreInstanceId_idx" ON "ChoreSwapRequest"("choreInstanceId");

-- CreateIndex
CREATE INDEX "ShoppingList_familyId_idx" ON "ShoppingList"("familyId");

-- CreateIndex
CREATE INDEX "ShoppingItem_listId_idx" ON "ShoppingItem"("listId");

-- CreateIndex
CREATE INDEX "MealPlan_familyId_idx" ON "MealPlan"("familyId");

-- CreateIndex
CREATE UNIQUE INDEX "MealPlan_familyId_date_slot_key" ON "MealPlan"("familyId", "date", "slot");

-- CreateIndex
CREATE INDEX "Recipe_familyId_idx" ON "Recipe"("familyId");

-- CreateIndex
CREATE INDEX "RecipeIngredient_recipeId_idx" ON "RecipeIngredient"("recipeId");

-- CreateIndex
CREATE INDEX "Note_familyId_idx" ON "Note"("familyId");

-- CreateIndex
CREATE INDEX "NoteAttachment_noteId_idx" ON "NoteAttachment"("noteId");

-- CreateIndex
CREATE UNIQUE INDEX "HubDisplaySettings_familyId_key" ON "HubDisplaySettings"("familyId");

-- CreateIndex
CREATE UNIQUE INDEX "MemberXpProfile_memberId_key" ON "MemberXpProfile"("memberId");

-- CreateIndex
CREATE INDEX "XpEvent_memberId_idx" ON "XpEvent"("memberId");

-- CreateIndex
CREATE INDEX "XpEvent_earnedAt_idx" ON "XpEvent"("earnedAt");

-- CreateIndex
CREATE INDEX "Achievement_familyId_idx" ON "Achievement"("familyId");

-- CreateIndex
CREATE UNIQUE INDEX "MemberAchievement_memberId_achievementId_key" ON "MemberAchievement"("memberId", "achievementId");

-- CreateIndex
CREATE INDEX "Reward_familyId_idx" ON "Reward"("familyId");

-- CreateIndex
CREATE INDEX "RewardRedemption_rewardId_idx" ON "RewardRedemption"("rewardId");

-- CreateIndex
CREATE INDEX "RewardRedemption_memberId_idx" ON "RewardRedemption"("memberId");

-- CreateIndex
CREATE INDEX "FamilyGoal_familyId_idx" ON "FamilyGoal"("familyId");

-- CreateIndex
CREATE UNIQUE INDEX "XpSettings_familyId_key" ON "XpSettings"("familyId");

-- CreateIndex
CREATE INDEX "Notification_memberId_idx" ON "Notification"("memberId");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE INDEX "ActivityEvent_familyId_idx" ON "ActivityEvent"("familyId");

-- CreateIndex
CREATE INDEX "ActivityEvent_createdAt_idx" ON "ActivityEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "FamilyMember" ADD CONSTRAINT "FamilyMember_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "FamilyMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_externalCalendarId_fkey" FOREIGN KEY ("externalCalendarId") REFERENCES "ExternalCalendar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventAssignee" ADD CONSTRAINT "EventAssignee_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventAssignee" ADD CONSTRAINT "EventAssignee_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalCalendarConnection" ADD CONSTRAINT "ExternalCalendarConnection_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalCalendar" ADD CONSTRAINT "ExternalCalendar_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "ExternalCalendarConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "FamilyMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAssignee" ADD CONSTRAINT "TaskAssignee_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAssignee" ADD CONSTRAINT "TaskAssignee_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskCompletion" ADD CONSTRAINT "TaskCompletion_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskCompletion" ADD CONSTRAINT "TaskCompletion_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chore" ADD CONSTRAINT "Chore_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chore" ADD CONSTRAINT "Chore_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "FamilyMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChoreAssignee" ADD CONSTRAINT "ChoreAssignee_choreId_fkey" FOREIGN KEY ("choreId") REFERENCES "Chore"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChoreAssignee" ADD CONSTRAINT "ChoreAssignee_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChoreInstance" ADD CONSTRAINT "ChoreInstance_choreId_fkey" FOREIGN KEY ("choreId") REFERENCES "Chore"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChoreInstance" ADD CONSTRAINT "ChoreInstance_assignedMemberId_fkey" FOREIGN KEY ("assignedMemberId") REFERENCES "FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChoreInstance" ADD CONSTRAINT "ChoreInstance_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "FamilyMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChoreSwapRequest" ADD CONSTRAINT "ChoreSwapRequest_choreInstanceId_fkey" FOREIGN KEY ("choreInstanceId") REFERENCES "ChoreInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChoreSwapRequest" ADD CONSTRAINT "ChoreSwapRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChoreSwapRequest" ADD CONSTRAINT "ChoreSwapRequest_targetMemberId_fkey" FOREIGN KEY ("targetMemberId") REFERENCES "FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingList" ADD CONSTRAINT "ShoppingList_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingItem" ADD CONSTRAINT "ShoppingItem_listId_fkey" FOREIGN KEY ("listId") REFERENCES "ShoppingList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingItem" ADD CONSTRAINT "ShoppingItem_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "FamilyMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingItem" ADD CONSTRAINT "ShoppingItem_checkedById_fkey" FOREIGN KEY ("checkedById") REFERENCES "FamilyMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealPlan" ADD CONSTRAINT "MealPlan_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealPlan" ADD CONSTRAINT "MealPlan_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "FamilyMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "FamilyMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteAttachment" ADD CONSTRAINT "NoteAttachment_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HubDisplaySettings" ADD CONSTRAINT "HubDisplaySettings_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberXpProfile" ADD CONSTRAINT "MemberXpProfile_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XpEvent" ADD CONSTRAINT "XpEvent_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Achievement" ADD CONSTRAINT "Achievement_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberAchievement" ADD CONSTRAINT "MemberAchievement_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberAchievement" ADD CONSTRAINT "MemberAchievement_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "Achievement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reward" ADD CONSTRAINT "Reward_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reward" ADD CONSTRAINT "Reward_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "FamilyMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardRedemption" ADD CONSTRAINT "RewardRedemption_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "Reward"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardRedemption" ADD CONSTRAINT "RewardRedemption_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardRedemption" ADD CONSTRAINT "RewardRedemption_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "FamilyMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyGoal" ADD CONSTRAINT "FamilyGoal_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XpSettings" ADD CONSTRAINT "XpSettings_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
