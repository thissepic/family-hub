import { TRPCError } from "@trpc/server";
import { rrulestr } from "rrule";
import { router, protectedProcedure } from "../init";
import { db } from "@/lib/db";
import { expandRecurrence } from "@/lib/calendar/recurrence";
import { PRIORITY_CONFIG } from "@/lib/tasks/constants";
import { awardXp, removeXp, flushPendingPush } from "@/lib/rewards/xp-engine";
import {
  listTasksInput,
  listForTodayInput,
  createTaskInput,
  updateTaskInput,
  deleteTaskInput,
  getByIdInput,
  toggleCompletionInput,
  bulkCreateInput,
} from "./tasks.schemas";

const assigneeInclude = {
  assignees: {
    include: {
      member: {
        select: { id: true, name: true, color: true },
      },
    },
  },
} as const;

/**
 * Check if a task is active on a given date based on its recurrence rule.
 */
function isTaskActiveOnDate(
  task: { createdAt: Date; recurrenceRule: string | null },
  date: Date
): boolean {
  // No recurrence rule = one-time task, always active
  if (!task.recurrenceRule) return true;

  const startOfDay = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );
  const endOfDay = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    23,
    59,
    59,
    999
  );

  try {
    const instances = expandRecurrence(
      {
        id: "check",
        startAt: task.createdAt,
        endAt: new Date(task.createdAt.getTime() + 1),
        recurrenceRule: task.recurrenceRule,
      },
      startOfDay,
      endOfDay
    );
    return instances.length > 0;
  } catch {
    // If recurrence rule is invalid, treat as always active
    return true;
  }
}

export const tasksRouter = router({
  /**
   * List all task definitions for the family.
   */
  list: protectedProcedure
    .input(listTasksInput)
    .query(async ({ ctx, input }) => {
      const familyId = ctx.session.familyId;
      const { memberIds, priorities } = input;

      const memberFilter = memberIds?.length
        ? { assignees: { some: { memberId: { in: memberIds } } } }
        : {};
      const priorityFilter = priorities?.length
        ? { priority: { in: priorities } }
        : {};

      const tasks = await db.task.findMany({
        where: {
          familyId,
          ...memberFilter,
          ...priorityFilter,
        },
        include: assigneeInclude,
        orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      });

      return tasks;
    }),

  /**
   * List tasks for the Today's Board, grouped by member.
   */
  listForToday: protectedProcedure
    .input(listForTodayInput)
    .query(async ({ ctx, input }) => {
      const familyId = ctx.session.familyId;
      const date = input.date ?? new Date();

      // Normalize date to start of day for completion lookup
      const dateOnly = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
      );

      const memberFilter = input.memberIds?.length
        ? { assignees: { some: { memberId: { in: input.memberIds } } } }
        : {};

      // Fetch all tasks with assignees and today's completions
      const tasks = await db.task.findMany({
        where: {
          familyId,
          ...memberFilter,
        },
        include: {
          ...assigneeInclude,
          completions: {
            where: { date: dateOnly },
          },
        },
        orderBy: [{ priority: "desc" }, { title: "asc" }],
      });

      // Filter to tasks active today
      const activeTasks = tasks.filter((task) =>
        isTaskActiveOnDate(task, date)
      );

      // Group by member
      const memberMap = new Map<
        string,
        {
          memberId: string;
          memberName: string;
          memberColor: string;
          tasks: Array<{
            id: string;
            title: string;
            description: string | null;
            priority: string;
            recurrenceRule: string | null;
            completed: boolean;
          }>;
        }
      >();

      for (const task of activeTasks) {
        for (const assignee of task.assignees) {
          const { member } = assignee;
          if (!memberMap.has(member.id)) {
            memberMap.set(member.id, {
              memberId: member.id,
              memberName: member.name,
              memberColor: member.color,
              tasks: [],
            });
          }

          const completed = task.completions.some(
            (c) => c.memberId === member.id
          );

          memberMap.get(member.id)!.tasks.push({
            id: task.id,
            title: task.title,
            description: task.description,
            priority: task.priority,
            recurrenceRule: task.recurrenceRule,
            completed,
          });
        }
      }

      return Array.from(memberMap.values());
    }),

  /**
   * Create a new task.
   */
  create: protectedProcedure
    .input(createTaskInput)
    .mutation(async ({ ctx, input }) => {
      const familyId = ctx.session.familyId;

      // Normalize recurrence rule: extract only the RRULE line, ensure clean prefix
      const normalizedCreateRule = input.recurrenceRule
        ? (() => {
            const lines = input.recurrenceRule.split("\n");
            const rruleLine =
              lines.find((l) => l.startsWith("RRULE:FREQ")) ??
              lines.find((l) => l.startsWith("FREQ=")) ??
              input.recurrenceRule;
            const body = rruleLine.replace(/^RRULE:/, "");
            return `RRULE:${body}`;
          })()
        : input.recurrenceRule;

      // Validate recurrence rule
      if (normalizedCreateRule) {
        try {
          rrulestr(normalizedCreateRule, { dtstart: new Date() });
        } catch {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid recurrence rule",
          });
        }
      }

      return db.$transaction(async (tx) => {
        const task = await tx.task.create({
          data: {
            familyId,
            title: input.title,
            description: input.description,
            priority: input.priority,
            recurrenceRule: normalizedCreateRule,
            createdById: ctx.session.memberId,
          },
        });

        await tx.taskAssignee.createMany({
          data: input.assigneeIds.map((memberId) => ({
            taskId: task.id,
            memberId,
          })),
        });

        return tx.task.findUniqueOrThrow({
          where: { id: task.id },
          include: assigneeInclude,
        });
      });
    }),

  /**
   * Update an existing task.
   */
  update: protectedProcedure
    .input(updateTaskInput)
    .mutation(async ({ ctx, input }) => {
      const { id, assigneeIds, ...updateData } = input;
      const familyId = ctx.session.familyId;

      const existingTask = await db.task.findFirst({
        where: { id, familyId },
      });

      if (!existingTask) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
      }

      // Normalize recurrence rule: extract only the RRULE line, ensure clean prefix
      const normalizedRule =
        updateData.recurrenceRule === undefined
          ? undefined
          : updateData.recurrenceRule === null
            ? null
            : (() => {
                const lines = updateData.recurrenceRule.split("\n");
                const rruleLine =
                  lines.find((l) => l.startsWith("RRULE:FREQ")) ??
                  lines.find((l) => l.startsWith("FREQ=")) ??
                  updateData.recurrenceRule;
                const body = rruleLine.replace(/^RRULE:/, "");
                return `RRULE:${body}`;
              })();

      // Validate recurrence rule if provided
      if (normalizedRule && normalizedRule !== null) {
        try {
          rrulestr(normalizedRule, { dtstart: new Date() });
        } catch {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid recurrence rule",
          });
        }
      }

      return db.$transaction(async (tx) => {
        await tx.task.update({
          where: { id },
          data: {
            ...(updateData.title !== undefined && { title: updateData.title }),
            ...(updateData.description !== undefined && {
              description: updateData.description,
            }),
            ...(updateData.priority !== undefined && {
              priority: updateData.priority,
            }),
            ...(normalizedRule !== undefined && {
              recurrenceRule: normalizedRule,
            }),
          },
        });

        // Update assignees if provided
        if (assigneeIds) {
          await tx.taskAssignee.deleteMany({ where: { taskId: id } });
          await tx.taskAssignee.createMany({
            data: assigneeIds.map((memberId) => ({
              taskId: id,
              memberId,
            })),
          });
        }

        return tx.task.findUniqueOrThrow({
          where: { id },
          include: assigneeInclude,
        });
      });
    }),

  /**
   * Delete a task.
   */
  delete: protectedProcedure
    .input(deleteTaskInput)
    .mutation(async ({ ctx, input }) => {
      const task = await db.task.findFirst({
        where: { id: input.id, familyId: ctx.session.familyId },
      });

      if (!task) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
      }

      await db.task.delete({ where: { id: input.id } });
      return { deleted: true };
    }),

  /**
   * Get a single task by ID.
   */
  getById: protectedProcedure
    .input(getByIdInput)
    .query(async ({ ctx, input }) => {
      const task = await db.task.findFirst({
        where: { id: input.id, familyId: ctx.session.familyId },
        include: assigneeInclude,
      });

      if (!task) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
      }

      return task;
    }),

  /**
   * Toggle task completion for a member on a specific date.
   * Creates/deletes TaskCompletion, XpEvent, and ActivityEvent records.
   */
  toggleCompletion: protectedProcedure
    .input(toggleCompletionInput)
    .mutation(async ({ ctx, input }) => {
      const familyId = ctx.session.familyId;

      const task = await db.task.findFirst({
        where: { id: input.taskId, familyId },
        include: {
          assignees: { select: { memberId: true } },
        },
      });

      if (!task) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
      }

      // Verify the member is an assignee
      const isAssignee = task.assignees.some(
        (a) => a.memberId === input.memberId
      );
      if (!isAssignee) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Member is not assigned to this task",
        });
      }

      // Normalize date
      const dateOnly = new Date(
        input.date.getFullYear(),
        input.date.getMonth(),
        input.date.getDate()
      );

      // Get XP amount from settings or fall back to hardcoded constants
      const xpSettings = await db.xpSettings.findUnique({
        where: { familyId },
      });
      const taskXpValues = (xpSettings?.taskXpValues ?? {}) as Record<string, number>;
      const xpAmount = taskXpValues[task.priority] ?? PRIORITY_CONFIG[task.priority].xp;

      const result = await db.$transaction(async (tx) => {
        if (input.completed) {
          // Mark as complete
          await tx.taskCompletion.upsert({
            where: {
              taskId_memberId_date: {
                taskId: input.taskId,
                memberId: input.memberId,
                date: dateOnly,
              },
            },
            create: {
              taskId: input.taskId,
              memberId: input.memberId,
              date: dateOnly,
            },
            update: {},
          });

          // Award XP via engine (handles points, streaks, profile, achievements, notifications)
          const xpResult = await awardXp(tx, {
            memberId: input.memberId,
            familyId,
            xpAmount,
            source: "TASK_COMPLETION",
            sourceId: input.taskId,
            description: `Completed task: ${task.title}`,
          });

          // Create activity event
          await tx.activityEvent.create({
            data: {
              familyId,
              memberId: input.memberId,
              type: "TASK_COMPLETED",
              description: `Completed task: ${task.title}`,
              sourceModule: "tasks",
              sourceId: input.taskId,
            },
          });

          return { completed: true, xpAwarded: xpResult.xpAwarded, leveledUp: xpResult.leveledUp, pendingPush: xpResult.pendingPush };
        } else {
          // Unmark completion
          await tx.taskCompletion.deleteMany({
            where: {
              taskId: input.taskId,
              memberId: input.memberId,
              date: dateOnly,
            },
          });

          // Remove XP via engine
          await removeXp(tx, {
            memberId: input.memberId,
            source: "TASK_COMPLETION",
            sourceId: input.taskId,
          });

          return { completed: false, xpAwarded: 0, leveledUp: false, pendingPush: [] };
        }
      });

      // Send push notifications after transaction commits
      if (result.pendingPush.length > 0) {
        flushPendingPush(result.pendingPush).catch(() => {});
      }

      return { completed: result.completed, xpAwarded: result.xpAwarded, leveledUp: result.leveledUp };
    }),

  /**
   * Bulk create tasks (for template loading).
   */
  bulkCreate: protectedProcedure
    .input(bulkCreateInput)
    .mutation(async ({ ctx, input }) => {
      const familyId = ctx.session.familyId;

      const created = await db.$transaction(async (tx) => {
        const results = [];

        for (const taskData of input.tasks) {
          const task = await tx.task.create({
            data: {
              familyId,
              title: taskData.title,
              description: taskData.description,
              priority: taskData.priority,
              recurrenceRule: taskData.recurrenceRule,
              createdById: ctx.session.memberId,
            },
          });

          await tx.taskAssignee.createMany({
            data: taskData.assigneeIds.map((memberId) => ({
              taskId: task.id,
              memberId,
            })),
          });

          results.push(task);
        }

        return results;
      });

      return { count: created.length };
    }),
});
