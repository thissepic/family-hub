import { Queue } from "bullmq";
import IORedis from "ioredis";
import { db } from "@/lib/db";
import type { EmailNotificationType } from "@prisma/client";

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
  familyId: string,
  oldEmail: string,
  newEmail: string,
  familyName: string,
  locale: string,
): Promise<void> {
  if (!(await isEmailEnabled(familyId, "EMAIL_CHANGE_NOTIFICATION"))) return;
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

// ─── Preference check ─────────────────────────────────────────────────────

async function isEmailEnabled(
  familyId: string,
  type: EmailNotificationType,
): Promise<boolean> {
  const pref = await db.emailPreference.findUnique({
    where: { familyId_type: { familyId, type } },
  });
  return pref?.enabled ?? true;
}

// ─── Security notification enqueue helpers ────────────────────────────────

export async function enqueueTwoFactorEnabledEmail(
  familyId: string,
  email: string,
  locale: string,
  familyName: string,
): Promise<void> {
  if (!(await isEmailEnabled(familyId, "TWO_FACTOR_ENABLED"))) return;
  await getQueue().add("send-email", {
    type: "two-factor-enabled",
    email,
    locale,
    familyName,
  });
}

export async function enqueueTwoFactorDisabledEmail(
  familyId: string,
  email: string,
  locale: string,
  familyName: string,
): Promise<void> {
  if (!(await isEmailEnabled(familyId, "TWO_FACTOR_DISABLED"))) return;
  await getQueue().add("send-email", {
    type: "two-factor-disabled",
    email,
    locale,
    familyName,
  });
}

export async function enqueueOAuthLinkedEmail(
  familyId: string,
  email: string,
  locale: string,
  familyName: string,
  provider: string,
  providerEmail: string,
): Promise<void> {
  if (!(await isEmailEnabled(familyId, "OAUTH_LINKED"))) return;
  await getQueue().add("send-email", {
    type: "oauth-linked",
    email,
    locale,
    familyName,
    provider,
    providerEmail,
  });
}

export async function enqueueOAuthUnlinkedEmail(
  familyId: string,
  email: string,
  locale: string,
  familyName: string,
  provider: string,
  providerEmail: string,
): Promise<void> {
  if (!(await isEmailEnabled(familyId, "OAUTH_UNLINKED"))) return;
  await getQueue().add("send-email", {
    type: "oauth-unlinked",
    email,
    locale,
    familyName,
    provider,
    providerEmail,
  });
}

export { getConnection };
