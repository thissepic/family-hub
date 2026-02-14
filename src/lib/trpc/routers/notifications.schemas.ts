import { z } from "zod/v4";

export const listNotificationsInput = z.object({
  unreadOnly: z.boolean().optional(),
});

export const markReadInput = z.object({
  id: z.string(),
});

// markAllRead — no input needed (uses session memberId)

export const deleteNotificationInput = z.object({
  id: z.string(),
});

// unreadCount — no input needed (uses session memberId)

export const updatePreferenceInput = z.object({
  type: z.enum([
    "CALENDAR_REMINDER",
    "CHORE_DEADLINE",
    "SWAP_REQUEST",
    "REWARD_APPROVAL",
    "ACHIEVEMENT",
    "LEVEL_UP",
    "ADMIN_ANNOUNCEMENT",
  ]),
  muted: z.boolean(),
});
