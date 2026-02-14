import { z } from "zod/v4";

export const getConnectionInput = z.object({
  id: z.string(),
});

export const deleteConnectionInput = z.object({
  id: z.string(),
});

export const updateCalendarInput = z.object({
  id: z.string(),
  syncEnabled: z.boolean().optional(),
  privacyMode: z.enum(["FULL_DETAILS", "BUSY_FREE_ONLY"]).optional(),
  syncDirection: z.enum(["INBOUND_ONLY", "TWO_WAY"]).optional(),
});

export const triggerSyncInput = z.object({
  connectionId: z.string(),
});

export const refreshCalendarListInput = z.object({
  connectionId: z.string(),
});

export const connectCaldavInput = z.object({
  provider: z.enum(["APPLE", "CALDAV"]),
  caldavUrl: z.string().optional(),
  username: z.string().min(1),
  password: z.string().min(1),
  accountLabel: z.string().min(1).max(100),
});

export const reconnectInput = z.object({
  connectionId: z.string(),
});

export const connectEwsInput = z.object({
  ewsUrl: z.string().url(),
  domain: z.string().min(1),
  username: z.string().min(1),
  password: z.string().min(1),
  email: z.string().email(),
  accountLabel: z.string().min(1).max(100),
});
