-- AlterTable
ALTER TABLE "Chore" ADD COLUMN     "choreSetId" TEXT;

-- AlterTable
ALTER TABLE "ShoppingItem" ADD COLUMN     "isRecurring" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ChoreSet" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChoreSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "muted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChoreSet_familyId_idx" ON "ChoreSet"("familyId");

-- CreateIndex
CREATE INDEX "PushSubscription_memberId_idx" ON "PushSubscription"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_memberId_endpoint_key" ON "PushSubscription"("memberId", "endpoint");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_memberId_type_key" ON "NotificationPreference"("memberId", "type");

-- CreateIndex
CREATE INDEX "Chore_choreSetId_idx" ON "Chore"("choreSetId");

-- CreateIndex
CREATE INDEX "Note_pinned_idx" ON "Note"("pinned");

-- AddForeignKey
ALTER TABLE "Chore" ADD CONSTRAINT "Chore_choreSetId_fkey" FOREIGN KEY ("choreSetId") REFERENCES "ChoreSet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChoreSet" ADD CONSTRAINT "ChoreSet_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
