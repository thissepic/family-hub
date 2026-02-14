import webpush from "web-push";
import { db } from "@/lib/db";

let initialized = false;

function ensureInitialized() {
  if (initialized) return;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@familyhub.local";

  if (!publicKey || !privateKey) {
    return; // Push not configured — silently skip
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  initialized = true;
}

interface PushPayload {
  title: string;
  message: string;
  linkUrl?: string | null;
}

/**
 * Send push notification to all subscriptions of a member.
 * Silently no-ops if VAPID keys are not configured.
 */
export async function sendPush(memberId: string, payload: PushPayload): Promise<void> {
  ensureInitialized();
  if (!initialized) return;

  const subscriptions = await db.pushSubscription.findMany({
    where: { memberId },
  });

  const staleIds: string[] = [];

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(payload)
        );
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 410 || statusCode === 404) {
          staleIds.push(sub.id);
        }
      }
    })
  );

  // Clean up stale subscriptions
  if (staleIds.length > 0) {
    await db.pushSubscription.deleteMany({
      where: { id: { in: staleIds } },
    });
  }
}
