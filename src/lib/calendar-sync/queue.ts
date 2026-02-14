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
    queue = new Queue("calendar-sync", {
      connection: getConnection() as never,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
      },
    });
  }
  return queue;
}

/**
 * Enqueue a sync job for a specific connection.
 * If immediate is true, the job runs right away.
 */
export async function enqueueSyncJob(
  connectionId: string,
  immediate?: boolean
): Promise<void> {
  const q = getQueue();
  await q.add(
    "sync-connection",
    { connectionId, force: immediate ?? false },
    { delay: immediate ? 0 : undefined }
  );
}

/**
 * Set up the periodic sync job that checks all connections.
 */
export async function enqueuePeriodicSync(): Promise<void> {
  const q = getQueue();

  // Remove existing repeatable job if present
  const repeatableJobs = await q.getRepeatableJobs();
  for (const job of repeatableJobs) {
    if (job.name === "periodic-sync") {
      await q.removeRepeatableByKey(job.key);
    }
  }

  // Add repeatable job: every 5 minutes
  await q.add(
    "periodic-sync",
    {},
    { repeat: { every: 5 * 60 * 1000 } }
  );
}

export { getConnection };
