import { z } from "zod/v4";

const calendarEventCategory = z.enum([
  "SCHOOL",
  "WORK",
  "MEDICAL",
  "SPORTS",
  "SOCIAL",
  "FAMILY",
  "OTHER",
]);

export const listEventsInput = z.object({
  start: z.coerce.date(),
  end: z.coerce.date(),
  memberIds: z.array(z.string()).optional(),
  categories: z.array(calendarEventCategory).optional(),
});

export const createEventInput = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  location: z.string().optional(),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  allDay: z.boolean().default(false),
  recurrenceRule: z.string().optional(),
  category: calendarEventCategory.default("OTHER"),
  assigneeIds: z.array(z.string()).min(1),
});

export const updateEventInput = z.object({
  id: z.string(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  location: z.string().optional(),
  startAt: z.coerce.date().optional(),
  endAt: z.coerce.date().optional(),
  allDay: z.boolean().optional(),
  recurrenceRule: z.string().nullable().optional(),
  category: calendarEventCategory.optional(),
  assigneeIds: z.array(z.string()).optional(),
  editMode: z.enum(["THIS", "ALL"]).default("ALL"),
  // For "THIS" mode on recurring events: the specific instance date being edited
  instanceDate: z.coerce.date().optional(),
});

export const deleteEventInput = z.object({
  id: z.string(),
  deleteMode: z.enum(["THIS", "ALL"]).default("ALL"),
  // For "THIS" mode: the specific instance date being deleted
  instanceDate: z.coerce.date().optional(),
});

export const getByIdInput = z.object({
  id: z.string(),
});

export const importIcalInput = z.object({
  icalString: z.string(),
  category: calendarEventCategory.optional(),
});

export const exportIcalInput = z.object({
  start: z.coerce.date().optional(),
  end: z.coerce.date().optional(),
  memberIds: z.array(z.string()).optional(),
});

export const getConflictsInput = z.object({
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  memberIds: z.array(z.string()),
  excludeEventId: z.string().optional(),
});
