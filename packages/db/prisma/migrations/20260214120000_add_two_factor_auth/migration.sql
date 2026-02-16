-- AlterTable: Add 2FA fields to Family
ALTER TABLE "Family" ADD COLUMN "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Family" ADD COLUMN "twoFactorSecret" TEXT;

-- CreateTable: TwoFactorRecoveryCode
CREATE TABLE "TwoFactorRecoveryCode" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TwoFactorRecoveryCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TwoFactorRecoveryCode_familyId_idx" ON "TwoFactorRecoveryCode"("familyId");

-- AddForeignKey
ALTER TABLE "TwoFactorRecoveryCode" ADD CONSTRAINT "TwoFactorRecoveryCode_familyId_fkey"
    FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;
