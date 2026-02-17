-- AlterTable
ALTER TABLE "FamilyInvitation" ADD COLUMN     "forMemberId" TEXT;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "FamilyInvitation_forMemberId_idx" ON "FamilyInvitation"("forMemberId");

-- AddForeignKey
ALTER TABLE "FamilyInvitation" ADD CONSTRAINT "FamilyInvitation_forMemberId_fkey" FOREIGN KEY ("forMemberId") REFERENCES "FamilyMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;
