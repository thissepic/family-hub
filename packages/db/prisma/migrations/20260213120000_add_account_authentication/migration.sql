-- AlterTable: Add account authentication fields to Family
ALTER TABLE "Family" ADD COLUMN "email" TEXT;
ALTER TABLE "Family" ADD COLUMN "passwordHash" TEXT;
ALTER TABLE "Family" ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: LoginAttempt
CREATE TABLE "LoginAttempt" (
    "id" TEXT NOT NULL,
    "familyId" TEXT,
    "email" TEXT,
    "ipAddress" TEXT NOT NULL,
    "userAgent" TEXT,
    "success" BOOLEAN NOT NULL,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ActiveSession
CREATE TABLE "ActiveSession" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "memberId" TEXT,
    "sessionToken" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "userAgent" TEXT,
    "lastActivity" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActiveSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LoginAttempt_email_idx" ON "LoginAttempt"("email");
CREATE INDEX "LoginAttempt_ipAddress_idx" ON "LoginAttempt"("ipAddress");
CREATE INDEX "LoginAttempt_createdAt_idx" ON "LoginAttempt"("createdAt");

CREATE UNIQUE INDEX "ActiveSession_sessionToken_key" ON "ActiveSession"("sessionToken");
CREATE INDEX "ActiveSession_familyId_idx" ON "ActiveSession"("familyId");
CREATE INDEX "ActiveSession_expiresAt_idx" ON "ActiveSession"("expiresAt");

-- AddForeignKey
ALTER TABLE "LoginAttempt" ADD CONSTRAINT "LoginAttempt_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActiveSession" ADD CONSTRAINT "ActiveSession_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill existing families: set email/password to placeholder values
-- These must be updated via the migration script before the app is usable
UPDATE "Family" SET "email" = 'setup-required@' || "id" || '.local', "passwordHash" = 'MIGRATION_REQUIRED' WHERE "email" IS NULL;

-- Now make the columns required and add unique constraint
ALTER TABLE "Family" ALTER COLUMN "email" SET NOT NULL;
ALTER TABLE "Family" ALTER COLUMN "passwordHash" SET NOT NULL;
CREATE UNIQUE INDEX "Family_email_key" ON "Family"("email");
