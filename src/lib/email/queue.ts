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
  displayName: string,
  verifyUrl: string,
): Promise<void> {
  await getQueue().add("send-email", {
    type: "verification",
    email,
    locale,
    familyName: displayName,
    verifyUrl,
  });
}

export async function enqueuePasswordResetEmail(
  email: string,
  locale: string,
  displayName: string,
  resetUrl: string,
): Promise<void> {
  await getQueue().add("send-email", {
    type: "password-reset",
    email,
    locale,
    familyName: displayName,
    resetUrl,
  });
}

export async function enqueueEmailChangeNotification(
  userId: string,
  oldEmail: string,
  newEmail: string,
  displayName: string,
  locale: string,
): Promise<void> {
  if (!(await isEmailEnabled(userId, "EMAIL_CHANGE_NOTIFICATION"))) return;
  await getQueue().add("send-email", {
    type: "email-change-notification",
    email: oldEmail,
    locale,
    familyName: displayName,
    oldEmail,
    newEmail,
  });
}

export async function enqueueEmailChangeVerification(
  email: string,
  locale: string,
  displayName: string,
  verifyUrl: string,
): Promise<void> {
  await getQueue().add("send-email", {
    type: "email-change-verification",
    email,
    locale,
    familyName: displayName,
    verifyUrl,
  });
}

// ─── Preference check ─────────────────────────────────────────────────────

async function isEmailEnabled(
  userId: string,
  type: EmailNotificationType,
): Promise<boolean> {
  const pref = await db.emailPreference.findUnique({
    where: { userId_type: { userId, type } },
  });
  return pref?.enabled ?? true;
}

// ─── Security notification enqueue helpers ────────────────────────────────

export async function enqueueTwoFactorEnabledEmail(
  userId: string,
  email: string,
  locale: string,
  displayName: string,
): Promise<void> {
  if (!(await isEmailEnabled(userId, "TWO_FACTOR_ENABLED"))) return;
  await getQueue().add("send-email", {
    type: "two-factor-enabled",
    email,
    locale,
    familyName: displayName,
  });
}

export async function enqueueTwoFactorDisabledEmail(
  userId: string,
  email: string,
  locale: string,
  displayName: string,
): Promise<void> {
  if (!(await isEmailEnabled(userId, "TWO_FACTOR_DISABLED"))) return;
  await getQueue().add("send-email", {
    type: "two-factor-disabled",
    email,
    locale,
    familyName: displayName,
  });
}

export async function enqueueOAuthLinkedEmail(
  userId: string,
  email: string,
  locale: string,
  displayName: string,
  provider: string,
  providerEmail: string,
): Promise<void> {
  if (!(await isEmailEnabled(userId, "OAUTH_LINKED"))) return;
  await getQueue().add("send-email", {
    type: "oauth-linked",
    email,
    locale,
    familyName: displayName,
    provider,
    providerEmail,
  });
}

export async function enqueueOAuthUnlinkedEmail(
  userId: string,
  email: string,
  locale: string,
  displayName: string,
  provider: string,
  providerEmail: string,
): Promise<void> {
  if (!(await isEmailEnabled(userId, "OAUTH_UNLINKED"))) return;
  await getQueue().add("send-email", {
    type: "oauth-unlinked",
    email,
    locale,
    familyName: displayName,
    provider,
    providerEmail,
  });
}

export async function enqueueInvitationEmail(
  email: string,
  locale: string,
  familyName: string,
  inviterName: string,
  inviteUrl: string,
  expiresAt: string,
): Promise<void> {
  await getQueue().add("send-email", {
    type: "invitation",
    email,
    locale,
    familyName,
    inviterName,
    inviteUrl,
    expiresAt,
  });
}

export { getConnection };
