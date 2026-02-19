-- AlterEnum
ALTER TYPE "RotationPattern" ADD VALUE 'ALL_TOGETHER';

-- AlterTable: make assignedMemberId nullable for group tasks
ALTER TABLE "ChoreInstance" ALTER COLUMN "assignedMemberId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "ChoreInstanceAssignee" (
    "id" TEXT NOT NULL,
    "choreInstanceId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,

    CONSTRAINT "ChoreInstanceAssignee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChoreInstanceAssignee_choreInstanceId_idx" ON "ChoreInstanceAssignee"("choreInstanceId");

-- CreateIndex
CREATE INDEX "ChoreInstanceAssignee_memberId_idx" ON "ChoreInstanceAssignee"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "ChoreInstanceAssignee_choreInstanceId_memberId_key" ON "ChoreInstanceAssignee"("choreInstanceId", "memberId");

-- AddForeignKey
ALTER TABLE "ChoreInstanceAssignee" ADD CONSTRAINT "ChoreInstanceAssignee_choreInstanceId_fkey" FOREIGN KEY ("choreInstanceId") REFERENCES "ChoreInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChoreInstanceAssignee" ADD CONSTRAINT "ChoreInstanceAssignee_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: Create ChoreInstanceAssignee rows for all existing instances
INSERT INTO "ChoreInstanceAssignee" ("id", "choreInstanceId", "memberId")
SELECT gen_random_uuid()::text, "id", "assignedMemberId"
FROM "ChoreInstance"
WHERE "assignedMemberId" IS NOT NULL;
