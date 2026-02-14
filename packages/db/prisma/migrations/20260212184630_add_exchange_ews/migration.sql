-- AlterEnum
ALTER TYPE "CalendarEventSource" ADD VALUE 'EXCHANGE_EWS';

-- AlterEnum
ALTER TYPE "CalendarProvider" ADD VALUE 'EXCHANGE_EWS';

-- AlterTable
ALTER TABLE "Chore" ALTER COLUMN "recurrenceStart" SET DATA TYPE TIMESTAMP(3);
