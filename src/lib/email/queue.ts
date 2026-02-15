import { Queue } from "bullmq";
import IORedis from "ioredis";

let connection: IORedis | null = null;
let queue: Queue | null = null;

function getConnection(): IORedis {
  if (!connection) {
    connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      reconnectOnError: () => true,
    });
  }
  return connection;
}

function getQueue(): Queue {
  if (!queue) {
    queue = new Queue("email", {
      connection: getConnection() as never,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 3000 },
        removeOnComplete: { count: 200 },
        removeOnFail: { count: 50 },
      },
    });
  }
  return queue;
}

// ─── Enqueue helpers ────────────────────────────────────────────────────────

export async function enqueueVerificationEmail(
  email: string,
  locale: string,
  familyName: string,
  verifyUrl: string,
): Promise<void> {
  await getQueue().add("send-email", {
    type: "verification",
    email,
    locale,
    familyName,
    verifyUrl,
  });
}

export async function enqueuePasswordResetEmail(
  email: string,
  locale: string,
  familyName: string,
  resetUrl: string,
): Promise<void> {
  await getQueue().add("send-email", {
    type: "password-reset",
    email,
    locale,
    familyName,
    resetUrl,
  });
}

export async function enqueueEmailChangeNotification(
  oldEmail: string,
  newEmail: string,
  familyName: string,
  locale: string,
): Promise<void> {
  await getQueue().add("send-email", {
    type: "email-change-notification",
    email: oldEmail,
    locale,
    familyName,
    oldEmail,
    newEmail,
  });
}

export async function enqueueEmailChangeVerification(
  email: string,
  locale: string,
  familyName: string,
  verifyUrl: string,
): Promise<void> {
  await getQueue().add("send-email", {
    type: "email-change-verification",
    email,
    locale,
    familyName,
    verifyUrl,
  });
}

export { getConnection };
