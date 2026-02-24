import { z } from "zod/v4";

const dueTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Must be HH:MM format");
const taskPriority = z.enum(["LOW", "MEDIUM", "HIGH"]);

export const listTasksInput = z.object({
  memberIds: z.array(z.string()).optional(),
  priorities: z.array(taskPriority).optional(),
});

export const listForTodayInput = z.object({
  date: z.coerce.date().optional(),
  memberIds: z.array(z.string()).optional(),
});

export const createTaskInput = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  priority: taskPriority.default("MEDIUM"),
  recurrenceRule: z.string().optional(),
  assigneeIds: z.array(z.string()).min(1),
  dueTime: dueTimeSchema.optional(),
  reminderMinutesBefore: z.number().int().min(1).max(43200).optional(),
});

export const updateTaskInput = z.object({
  id: z.string(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().nullable().optional(),
  priority: taskPriority.optional(),
  recurrenceRule: z.string().nullable().optional(),
  assigneeIds: z.array(z.string()).min(1).optional(),
  dueTime: dueTimeSchema.nullable().optional(),
  reminderMinutesBefore: z.number().int().min(1).max(43200).nullable().optional(),
});

export const deleteTaskInput = z.object({
  id: z.string(),
});

export const getByIdInput = z.object({
  id: z.string(),
});

export const toggleCompletionInput = z.object({
  taskId: z.string(),
  memberId: z.string(),
  date: z.coerce.date(),
  completed: z.boolean(),
});

export const bulkCreateInput = z.object({
  tasks: z
    .array(
      z.object({
        title: z.string().min(1).max(200),
        description: z.string().optional(),
        priority: taskPriority.default("MEDIUM"),
        recurrenceRule: z.string().optional(),
        assigneeIds: z.array(z.string()).min(1),
        dueTime: dueTimeSchema.optional(),
        reminderMinutesBefore: z.number().int().min(1).max(43200).optional(),
      })
    )
    .min(1)
    .max(50),
});
