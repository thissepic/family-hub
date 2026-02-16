-- CreateEnum
CREATE TYPE "EmailNotificationType" AS ENUM ('TWO_FACTOR_ENABLED', 'TWO_FACTOR_DISABLED', 'OAUTH_LINKED', 'OAUTH_UNLINKED', 'EMAIL_CHANGE_NOTIFICATION');

-- CreateTable
CREATE TABLE "EmailPreference" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "type" "EmailNotificationType" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "EmailPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailPreference_familyId_idx" ON "EmailPreference"("familyId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailPreference_familyId_type_key" ON "EmailPreference"("familyId", "type");

-- AddForeignKey
ALTER TABLE "EmailPreference" ADD CONSTRAINT "EmailPreference_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;
