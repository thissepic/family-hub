-- AlterTable: Add new columns with defaults
ALTER TABLE "Chore" ADD COLUMN "recurrenceRule" TEXT NOT NULL DEFAULT 'RRULE:FREQ=WEEKLY';
ALTER TABLE "Chore" ADD COLUMN "recurrenceStart" TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Data migration: Convert existing enum values to RRULE strings
UPDATE "Chore" SET "recurrenceRule" = 'RRULE:FREQ=DAILY', "recurrenceStart" = DATE_TRUNC('day', "createdAt") WHERE "frequency" = 'DAILY';
UPDATE "Chore" SET "recurrenceRule" = 'RRULE:FREQ=WEEKLY;BYDAY=MO', "recurrenceStart" = '2024-01-01T00:00:00Z' WHERE "frequency" = 'WEEKLY';
UPDATE "Chore" SET "recurrenceRule" = 'RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO', "recurrenceStart" = '2024-01-01T00:00:00Z' WHERE "frequency" = 'BIWEEKLY';
UPDATE "Chore" SET "recurrenceRule" = 'RRULE:FREQ=MONTHLY;BYMONTHDAY=1', "recurrenceStart" = DATE_TRUNC('month', "createdAt") WHERE "frequency" = 'MONTHLY';

-- Drop old column
ALTER TABLE "Chore" DROP COLUMN "frequency";

-- Drop unused enum type
DROP TYPE "ChoreFrequency";

-- CreateIndex for range query on ChoreInstance
CREATE INDEX "ChoreInstance_periodStart_periodEnd_idx" ON "ChoreInstance"("periodStart", "periodEnd");
