-- ============================================================================
-- Migration: Decouple User accounts from Families
--
-- This migration:
-- 1. Creates the User table
-- 2. Creates one User per existing Family (migrating auth fields)
-- 3. Links the first ADMIN FamilyMember to the new User
-- 4. Moves security models from familyId to userId
-- 5. Removes auth fields from Family
-- 6. Adds FamilyInvitation table
-- ============================================================================

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED');

-- ============================================================================
-- Step 1: Create User table
-- ============================================================================
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorSecret" TEXT,
    "defaultLocale" TEXT NOT NULL DEFAULT 'en',
    "theme" "ThemeMode" NOT NULL DEFAULT 'AUTO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- ============================================================================
-- Step 2: Add userId column to FamilyMember (nullable for now)
-- ============================================================================
ALTER TABLE "FamilyMember" ADD COLUMN "userId" TEXT;
ALTER TABLE "FamilyMember" ALTER COLUMN "pinHash" DROP NOT NULL;

-- ============================================================================
-- Step 3: Add userId columns to security models (nullable alongside familyId)
-- ============================================================================
ALTER TABLE "OAuthAccount" ADD COLUMN "userId" TEXT;
ALTER TABLE "EmailToken" ADD COLUMN "userId" TEXT;
ALTER TABLE "TwoFactorRecoveryCode" ADD COLUMN "userId" TEXT;
ALTER TABLE "LoginAttempt" ADD COLUMN "userId" TEXT;
ALTER TABLE "ActiveSession" ADD COLUMN "userId" TEXT;
ALTER TABLE "EmailPreference" ADD COLUMN "userId" TEXT;

-- ============================================================================
-- Step 4: Migrate data - Create Users from Families
-- ============================================================================

-- Generate a cuid-like ID for each family and create corresponding users
-- We use the family's own id prefix with 'u' to create deterministic user IDs
INSERT INTO "User" ("id", "email", "passwordHash", "emailVerified", "twoFactorEnabled", "twoFactorSecret", "defaultLocale", "theme", "createdAt", "updatedAt")
SELECT
    'u' || substring("id" from 2),  -- deterministic user ID from family ID
    "email",
    "passwordHash",
    "emailVerified",
    "twoFactorEnabled",
    "twoFactorSecret",
    "defaultLocale",
    "theme",
    "createdAt",
    "updatedAt"
FROM "Family"
WHERE "email" IS NOT NULL;

-- ============================================================================
-- Step 5: Link first ADMIN FamilyMember to the new User
-- ============================================================================
UPDATE "FamilyMember" fm
SET "userId" = 'u' || substring(fm."familyId" from 2)
FROM (
    SELECT DISTINCT ON ("familyId") "id", "familyId"
    FROM "FamilyMember"
    WHERE "role" = 'ADMIN'
    ORDER BY "familyId", "createdAt" ASC
) first_admin
WHERE fm."id" = first_admin."id";

-- ============================================================================
-- Step 6: Migrate security models from familyId to userId
-- ============================================================================
UPDATE "OAuthAccount"
SET "userId" = 'u' || substring("familyId" from 2);

UPDATE "EmailToken"
SET "userId" = 'u' || substring("familyId" from 2);

UPDATE "TwoFactorRecoveryCode"
SET "userId" = 'u' || substring("familyId" from 2);

UPDATE "LoginAttempt"
SET "userId" = 'u' || substring("familyId" from 2)
WHERE "familyId" IS NOT NULL;

UPDATE "ActiveSession"
SET "userId" = 'u' || substring("familyId" from 2);

UPDATE "EmailPreference"
SET "userId" = 'u' || substring("familyId" from 2);

-- ============================================================================
-- Step 7: Make userId NOT NULL where required, add foreign keys
-- ============================================================================

-- OAuthAccount
ALTER TABLE "OAuthAccount" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "OAuthAccount" ADD CONSTRAINT "OAuthAccount_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- EmailToken
ALTER TABLE "EmailToken" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "EmailToken" ADD CONSTRAINT "EmailToken_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- TwoFactorRecoveryCode
ALTER TABLE "TwoFactorRecoveryCode" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "TwoFactorRecoveryCode" ADD CONSTRAINT "TwoFactorRecoveryCode_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- LoginAttempt (userId stays nullable - failed logins may not have a user)
ALTER TABLE "LoginAttempt" ADD CONSTRAINT "LoginAttempt_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ActiveSession
ALTER TABLE "ActiveSession" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "ActiveSession" ALTER COLUMN "familyId" DROP NOT NULL;
ALTER TABLE "ActiveSession" ADD CONSTRAINT "ActiveSession_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- EmailPreference
ALTER TABLE "EmailPreference" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "EmailPreference" ADD CONSTRAINT "EmailPreference_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- FamilyMember.userId FK
ALTER TABLE "FamilyMember" ADD CONSTRAINT "FamilyMember_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================================
-- Step 8: Drop old familyId columns from security models (except ActiveSession)
-- ============================================================================

-- OAuthAccount: drop familyId FK and column
ALTER TABLE "OAuthAccount" DROP CONSTRAINT "OAuthAccount_familyId_fkey";
DROP INDEX IF EXISTS "OAuthAccount_familyId_idx";
ALTER TABLE "OAuthAccount" DROP COLUMN "familyId";

-- EmailToken: drop familyId FK and column
ALTER TABLE "EmailToken" DROP CONSTRAINT "EmailToken_familyId_fkey";
DROP INDEX IF EXISTS "EmailToken_familyId_idx";
ALTER TABLE "EmailToken" DROP COLUMN "familyId";

-- TwoFactorRecoveryCode: drop familyId FK and column
ALTER TABLE "TwoFactorRecoveryCode" DROP CONSTRAINT "TwoFactorRecoveryCode_familyId_fkey";
DROP INDEX IF EXISTS "TwoFactorRecoveryCode_familyId_idx";
ALTER TABLE "TwoFactorRecoveryCode" DROP COLUMN "familyId";

-- LoginAttempt: drop familyId FK and column
ALTER TABLE "LoginAttempt" DROP CONSTRAINT IF EXISTS "LoginAttempt_familyId_fkey";
ALTER TABLE "LoginAttempt" DROP COLUMN "familyId";

-- EmailPreference: drop old unique index, familyId FK and column
DROP INDEX IF EXISTS "EmailPreference_familyId_type_key";
DROP INDEX IF EXISTS "EmailPreference_familyId_idx";
ALTER TABLE "EmailPreference" DROP CONSTRAINT "EmailPreference_familyId_fkey";
ALTER TABLE "EmailPreference" DROP COLUMN "familyId";

-- ActiveSession: drop old familyId FK (keep column, make nullable, re-add FK to Family)
ALTER TABLE "ActiveSession" DROP CONSTRAINT "ActiveSession_familyId_fkey";
ALTER TABLE "ActiveSession" ADD CONSTRAINT "ActiveSession_familyId_fkey"
    FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================================
-- Step 9: Remove auth fields from Family
-- ============================================================================
DROP INDEX IF EXISTS "Family_email_key";
ALTER TABLE "Family" DROP COLUMN "email";
ALTER TABLE "Family" DROP COLUMN "passwordHash";
ALTER TABLE "Family" DROP COLUMN "emailVerified";
ALTER TABLE "Family" DROP COLUMN "twoFactorEnabled";
ALTER TABLE "Family" DROP COLUMN "twoFactorSecret";

-- ============================================================================
-- Step 10: Add new indexes and constraints
-- ============================================================================

-- FamilyMember indexes
CREATE UNIQUE INDEX "FamilyMember_familyId_userId_key" ON "FamilyMember"("familyId", "userId");
CREATE INDEX "FamilyMember_userId_idx" ON "FamilyMember"("userId");

-- Security model indexes (replace old familyId indexes with userId indexes)
CREATE INDEX "OAuthAccount_userId_idx" ON "OAuthAccount"("userId");
CREATE INDEX "EmailToken_userId_idx" ON "EmailToken"("userId");
CREATE INDEX "TwoFactorRecoveryCode_userId_idx" ON "TwoFactorRecoveryCode"("userId");
CREATE INDEX "ActiveSession_userId_idx" ON "ActiveSession"("userId");
CREATE INDEX "EmailPreference_userId_idx" ON "EmailPreference"("userId");
CREATE UNIQUE INDEX "EmailPreference_userId_type_key" ON "EmailPreference"("userId", "type");

-- ============================================================================
-- Step 11: Create FamilyInvitation table
-- ============================================================================
CREATE TABLE "FamilyInvitation" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "email" TEXT,
    "role" "MemberRole" NOT NULL DEFAULT 'MEMBER',
    "token" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "invitedById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),

    CONSTRAINT "FamilyInvitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FamilyInvitation_token_key" ON "FamilyInvitation"("token");
CREATE INDEX "FamilyInvitation_familyId_idx" ON "FamilyInvitation"("familyId");
CREATE INDEX "FamilyInvitation_token_idx" ON "FamilyInvitation"("token");
CREATE INDEX "FamilyInvitation_email_idx" ON "FamilyInvitation"("email");

ALTER TABLE "FamilyInvitation" ADD CONSTRAINT "FamilyInvitation_familyId_fkey"
    FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FamilyInvitation" ADD CONSTRAINT "FamilyInvitation_invitedById_fkey"
    FOREIGN KEY ("invitedById") REFERENCES "FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
