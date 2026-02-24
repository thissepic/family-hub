-- AlterTable
ALTER TABLE "Chore" ADD COLUMN     "dueTime" TEXT,
ADD COLUMN     "reminderMinutesBefore" INTEGER;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "dueTime" TEXT,
ADD COLUMN     "reminderMinutesBefore" INTEGER;
