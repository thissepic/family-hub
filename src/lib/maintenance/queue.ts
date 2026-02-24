import { Queue } from "bullmq";
import IORedis from "ioredis";

let connection: IORedis | null = null;
let queue: Queue | null = null;

function getConnection(): IORedis {
  if (!connection) {
    connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
      maxRetriesPerRequest: null,
    });
  }
  return connection;
}

function getQueue(): Queue {
  if (!queue) {
    queue = new Queue("maintenance", {
      connection: getConnection() as never,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: { count: 50 },
        removeOnFail: { count: 20 },
      },
    });
  }
  return queue;
}

/**
 * Set up repeatable maintenance jobs.
 */
export async function enqueueMaintenanceJobs(): Promise<void> {
  const q = getQueue();

  // Remove existing repeatable jobs
  const repeatableJobs = await q.getRepeatableJobs();
  for (const job of repeatableJobs) {
    await q.removeRepeatableByKey(job.key);
  }

  // Cleanup old notifications — daily at 3:00 AM
  await q.add(
    "cleanup-old-notifications",
    {},
    { repeat: { pattern: "0 3 * * *" } }
  );

  // Weekly recap — Sunday at 6:00 PM
  await q.add(
    "weekly-recap",
    {},
    { repeat: { pattern: "0 18 * * 0" } }
  );

  // Cleanup expired email tokens — daily at 4:00 AM
  await q.add(
    "cleanup-expired-tokens",
    {},
    { repeat: { pattern: "0 4 * * *" } }
  );

  // Daily database backup — daily at 4:30 AM
  await q.add(
    "daily-backup",
    {},
    { repeat: { pattern: "30 4 * * *" } }
  );

  // Chore deadline reminders — every 15 minutes (supports per-chore due times)
  await q.add(
    "chore-deadline-reminders",
    {},
    { repeat: { pattern: "*/15 * * * *" } }
  );

  // Task deadline reminders — every 15 minutes (for tasks with due time set)
  await q.add(
    "task-deadline-reminders",
    {},
    { repeat: { pattern: "*/15 * * * *" } }
  );

  // Early reminders — every 15 minutes (chores and tasks with reminderMinutesBefore)
  await q.add(
    "early-reminders",
    {},
    { repeat: { pattern: "*/15 * * * *" } }
  );

  // Calendar event reminders — daily at 7:00 AM
  await q.add(
    "calendar-event-reminders",
    {},
    { repeat: { pattern: "0 7 * * *" } }
  );
}

export { getConnection };
