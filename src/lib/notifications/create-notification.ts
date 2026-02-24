import type { PrismaClient, NotificationType } from "@prisma/client";
import { db } from "@/lib/db";

/** Notification types that are muted by default (when no preference row exists). */
const DEFAULT_MUTED_TYPES: ReadonlySet<NotificationType> = new Set([
  "CALENDAR_REMINDER",
]);

type TxClient = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

interface CreateNotificationInput {
  memberId: string;
  type: NotificationType;
  title: string;
  message: string;
  linkUrl?: string | null;
  sourceModule?: string;
  sourceId?: string;
}

interface CreateNotificationResult {
  id: string;
  memberId: string;
  type: NotificationType;
  title: string;
  message: string;
  linkUrl: string | null;
}

/**
 * Create a notification respecting member preferences.
 * Can be called inside or outside a transaction.
 *
 * Returns the created notification data (for push sending after commit),
 * or null if the member has muted this notification type.
 */
export async function createNotification(
  txOrDb: TxClient | typeof db,
  input: CreateNotificationInput
): Promise<CreateNotificationResult | null> {
  // Check if member has muted this notification type
  const preference = await txOrDb.notificationPreference.findUnique({
    where: {
      memberId_type: {
        memberId: input.memberId,
        type: input.type,
      },
    },
  });

  const isMuted = preference ? preference.muted : DEFAULT_MUTED_TYPES.has(input.type);
  if (isMuted) {
    return null;
  }

  const notification = await txOrDb.notification.create({
    data: {
      memberId: input.memberId,
      type: input.type,
      title: input.title,
      message: input.message,
      linkUrl: input.linkUrl ?? null,
      sourceModule: input.sourceModule ?? null,
      sourceId: input.sourceId ?? null,
    },
  });

  return {
    id: notification.id,
    memberId: notification.memberId,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    linkUrl: notification.linkUrl,
  };
}
