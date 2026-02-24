import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, adminProcedure } from "../init";
import { db } from "@/lib/db";
import { DIFFICULTY_CONFIG } from "@/lib/chores/constants";
import { awardXp, removeXp, flushPendingPush } from "@/lib/rewards/xp-engine";
import { ensureInstancesForFamily } from "@/lib/chores/generate-instances";
import { createNotification } from "@/lib/notifications/create-notification";
import { sendPush } from "@/lib/notifications/push";
import type { ChoreDifficulty } from "@prisma/client";
import { rrulestr } from "rrule";
import {
  listChoresInput,
  getByIdInput,
  createChoreInput,
  updateChoreInput,
  deleteChoreInput,
  listMyInstancesInput,
  completeInstanceInput,
  verifyInstanceInput,
  skipInstanceInput,
  uncompleteInstanceInput,
  requestSwapInput,
  respondToSwapInput,
  fairnessStatsInput,
  createChoreSetInput,
  updateChoreSetInput,
  deleteChoreSetInput,
  addChoreToSetInput,
  removeChoreFromSetInput,
} from "./chores.schemas";

const choreInclude = {
  assignees: {
    include: {
      member: {
        select: { id: true, name: true, color: true },
      },
    },
    orderBy: { sortOrder: "asc" as const },
  },
} as const;

const instanceInclude = {
  chore: {
    select: {
      id: true,
      title: true,
      category: true,
      difficulty: true,
      recurrenceRule: true,
      needsVerification: true,
      estimatedMinutes: true,
      rotationPattern: true,
      dueTime: true,
      reminderMinutesBefore: true,
      assignees: {
        include: {
          member: { select: { id: true, name: true, color: true } },
        },
        orderBy: { sortOrder: "asc" as const },
      },
    },
  },
  assignedMember: {
    select: { id: true, name: true, color: true },
  },
  instanceAssignees: {
    include: {
      member: { select: { id: true, name: true, color: true } },
    },
  },
} as const;

export const choresRouter = router({
  // ─── CRUD ────────────────────────────────────────────────────

  list: protectedProcedure.input(listChoresInput).query(async ({ ctx, input }) => {
    const { familyId } = ctx.session;
    const where: Record<string, unknown> = { familyId };

    if (input.memberIds && input.memberIds.length > 0) {
      where.assignees = {
        some: { memberId: { in: input.memberIds } },
      };
    }
    if (input.categories && input.categories.length > 0) {
      where.category = { in: input.categories };
    }

    return db.chore.findMany({
      where,
      include: choreInclude,
      orderBy: { createdAt: "desc" },
    });
  }),

  getById: protectedProcedure.input(getByIdInput).query(async ({ ctx, input }) => {
    const chore = await db.chore.findUnique({
      where: { id: input.id },
      include: choreInclude,
    });

    if (!chore || chore.familyId !== ctx.session.familyId) {
      throw new TRPCError({ code: "NOT_FOUND" });
    }

    return chore;
  }),

  create: protectedProcedure.input(createChoreInput).mutation(async ({ ctx, input }) => {
    const { familyId, memberId } = ctx.session;

    // Normalize recurrence rule
    const normalizedRule = (() => {
      const lines = input.recurrenceRule.split("\n");
      const rruleLine =
        lines.find((l) => l.startsWith("RRULE:FREQ")) ??
        lines.find((l) => l.startsWith("FREQ=")) ??
        input.recurrenceRule;
      const body = rruleLine.replace(/^RRULE:/, "");
      return `RRULE:${body}`;
    })();

    // Validate recurrence rule
    try {
      rrulestr(normalizedRule, { dtstart: new Date() });
    } catch {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Invalid recurrence rule",
      });
    }

    return db.$transaction(async (tx) => {
      const chore = await tx.chore.create({
        data: {
          familyId,
          title: input.title,
          description: input.description,
          category: input.category,
          recurrenceRule: normalizedRule,
          recurrenceStart: new Date(),
          difficulty: input.difficulty,
          estimatedMinutes: input.estimatedMinutes,
          needsVerification: input.needsVerification,
          rotationPattern: input.rotationPattern,
          dueTime: input.dueTime,
          reminderMinutesBefore: input.reminderMinutesBefore,
          createdById: memberId,
        },
      });

      for (let i = 0; i < input.assigneeIds.length; i++) {
        await tx.choreAssignee.create({
          data: {
            choreId: chore.id,
            memberId: input.assigneeIds[i],
            sortOrder: i,
          },
        });
      }

      return chore;
    });
  }),

  update: protectedProcedure.input(updateChoreInput).mutation(async ({ ctx, input }) => {
    const existing = await db.chore.findUnique({
      where: { id: input.id },
    });

    if (!existing || existing.familyId !== ctx.session.familyId) {
      throw new TRPCError({ code: "NOT_FOUND" });
    }

    // Normalize and validate recurrence rule if provided
    let normalizedRule: string | undefined;
    if (input.recurrenceRule) {
      const lines = input.recurrenceRule.split("\n");
      const rruleLine =
        lines.find((l) => l.startsWith("RRULE:FREQ")) ??
        lines.find((l) => l.startsWith("FREQ=")) ??
        input.recurrenceRule;
      const body = rruleLine.replace(/^RRULE:/, "");
      normalizedRule = `RRULE:${body}`;

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
      const chore = await tx.chore.update({
        where: { id: input.id },
        data: {
          title: input.title,
          description: input.description,
          category: input.category,
          recurrenceRule: normalizedRule,
          difficulty: input.difficulty,
          estimatedMinutes: input.estimatedMinutes,
          needsVerification: input.needsVerification,
          rotationPattern: input.rotationPattern,
          ...(input.dueTime !== undefined && { dueTime: input.dueTime }),
          ...(input.reminderMinutesBefore !== undefined && { reminderMinutesBefore: input.reminderMinutesBefore }),
        },
      });

      // If recurrence rule changed, delete future pending instances (they have wrong period boundaries)
      if (normalizedRule) {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        await tx.choreInstance.deleteMany({
          where: {
            choreId: input.id,
            status: "PENDING",
            periodStart: { gt: todayStart },
          },
        });
      }

      if (input.assigneeIds) {
        await tx.choreAssignee.deleteMany({
          where: { choreId: input.id },
        });
        for (let i = 0; i < input.assigneeIds.length; i++) {
          await tx.choreAssignee.create({
            data: {
              choreId: input.id,
              memberId: input.assigneeIds[i],
              sortOrder: i,
            },
          });
        }
      }

      return chore;
    });
  }),

  delete: protectedProcedure.input(deleteChoreInput).mutation(async ({ ctx, input }) => {
    const existing = await db.chore.findUnique({
      where: { id: input.id },
    });

    if (!existing || existing.familyId !== ctx.session.familyId) {
      throw new TRPCError({ code: "NOT_FOUND" });
    }

    await db.chore.delete({ where: { id: input.id } });
    return { id: input.id };
  }),

  // ─── Instance Management ─────────────────────────────────────

  listMyInstances: protectedProcedure
    .input(listMyInstancesInput)
    .query(async ({ ctx, input }) => {
      const { familyId } = ctx.session;

      // Auto-generate missing instances
      await db.$transaction(async (tx) => {
        await ensureInstancesForFamily(tx, familyId);
      });

      // Build date filter — instances whose period contains the reference date
      const refDate = input.date ?? new Date();
      const today = new Date(
        refDate.getFullYear(),
        refDate.getMonth(),
        refDate.getDate(),
      );

      const where: Record<string, unknown> = {
        chore: { familyId },
        periodStart: { lte: today },
        periodEnd: { gte: today },
      };

      if (input.memberIds && input.memberIds.length > 0) {
        // Include both single-assignee and group-task instances
        where.OR = [
          { assignedMemberId: { in: input.memberIds } },
          { instanceAssignees: { some: { memberId: { in: input.memberIds } } } },
        ];
      }

      if (input.statuses && input.statuses.length > 0) {
        where.status = { in: input.statuses };
      }

      const instances = await db.choreInstance.findMany({
        where,
        include: instanceInclude,
        orderBy: [{ periodEnd: "asc" }, { chore: { title: "asc" } }],
      });

      // Group by assigned member
      const memberMap = new Map<
        string,
        {
          memberId: string;
          memberName: string;
          memberColor: string;
          instances: typeof instances;
        }
      >();

      for (const inst of instances) {
        // Determine which members this instance belongs to
        const assignedMembers =
          inst.instanceAssignees.length > 0
            ? inst.instanceAssignees.map((a) => a.member)
            : inst.assignedMember
              ? [inst.assignedMember]
              : [];

        for (const member of assignedMembers) {
          // If filtering by memberIds, only include relevant members
          if (input.memberIds && input.memberIds.length > 0 && !input.memberIds.includes(member.id)) {
            continue;
          }

          const key = member.id;
          if (!memberMap.has(key)) {
            memberMap.set(key, {
              memberId: member.id,
              memberName: member.name,
              memberColor: member.color,
              instances: [],
            });
          }
          memberMap.get(key)!.instances.push(inst);
        }
      }

      return Array.from(memberMap.values());
    }),

  completeInstance: protectedProcedure
    .input(completeInstanceInput)
    .mutation(async ({ ctx, input }) => {
      const { memberId, familyId } = ctx.session;

      const instance = await db.choreInstance.findUnique({
        where: { id: input.instanceId },
        include: {
          chore: {
            select: {
              id: true,
              title: true,
              difficulty: true,
              needsVerification: true,
              familyId: true,
              rotationPattern: true,
            },
          },
          instanceAssignees: { select: { memberId: true } },
        },
      });

      if (!instance || instance.chore.familyId !== familyId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      // Permission check: assigned member or instance assignee or admin
      const isAssigned =
        instance.assignedMemberId === memberId ||
        instance.instanceAssignees.some((a) => a.memberId === memberId);
      if (!isAssigned && ctx.session.role !== "ADMIN") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      if (instance.status !== "PENDING") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Instance is not in PENDING status",
        });
      }

      const difficulty = instance.chore.difficulty as ChoreDifficulty;
      const isGroupTask = instance.chore.rotationPattern === "ALL_TOGETHER";

      // Get XP from settings or fall back to constants
      const xpSettings = await db.xpSettings.findUnique({ where: { familyId } });
      const choreXpValues = (xpSettings?.choreXpValues ?? {}) as Record<string, number>;
      const xp = choreXpValues[difficulty] ?? DIFFICULTY_CONFIG[difficulty]?.xp ?? 0;

      if (instance.chore.needsVerification) {
        // Set to pending review — XP awarded upon admin verification
        await db.choreInstance.update({
          where: { id: input.instanceId },
          data: { status: "PENDING_REVIEW", completedAt: new Date() },
        });

        return { status: "PENDING_REVIEW" as const, xpAwarded: 0 };
      }

      // Complete immediately with XP
      const result = await db.$transaction(async (tx) => {
        await tx.choreInstance.update({
          where: { id: input.instanceId },
          data: { status: "DONE", completedAt: new Date() },
        });

        // Determine who gets XP
        const xpRecipients = isGroupTask
          ? instance.instanceAssignees.map((a) => a.memberId)
          : instance.assignedMemberId
            ? [instance.assignedMemberId]
            : [];

        let anyLeveledUp = false;
        let allPendingPush: Awaited<ReturnType<typeof awardXp>>["pendingPush"] = [];

        for (const recipientId of xpRecipients) {
          const xpResult = await awardXp(tx, {
            memberId: recipientId,
            familyId,
            xpAmount: xp,
            source: "CHORE_COMPLETION",
            sourceId: instance.id,
            description: `Completed chore: ${instance.chore.title}`,
          });
          if (xpResult.leveledUp) anyLeveledUp = true;
          allPendingPush = [...allPendingPush, ...xpResult.pendingPush];

          await tx.activityEvent.create({
            data: {
              familyId,
              memberId: recipientId,
              type: "CHORE_COMPLETED",
              description: `Completed chore: ${instance.chore.title}`,
              sourceModule: "chores",
              sourceId: instance.id,
            },
          });
        }

        return { status: "DONE" as const, xpAwarded: xp, leveledUp: anyLeveledUp, pendingPush: allPendingPush };
      });

      // Send push notifications after transaction commits
      flushPendingPush(result.pendingPush).catch(() => {});

      return { status: result.status, xpAwarded: result.xpAwarded, leveledUp: result.leveledUp };
    }),

  verifyInstance: adminProcedure
    .input(verifyInstanceInput)
    .mutation(async ({ ctx, input }) => {
      const { memberId, familyId } = ctx.session;

      const instance = await db.choreInstance.findUnique({
        where: { id: input.instanceId },
        include: {
          chore: {
            select: {
              id: true,
              title: true,
              difficulty: true,
              familyId: true,
              rotationPattern: true,
            },
          },
          instanceAssignees: { select: { memberId: true } },
        },
      });

      if (!instance || instance.chore.familyId !== familyId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      if (instance.status !== "PENDING_REVIEW") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Instance is not awaiting review",
        });
      }

      if (!input.approved) {
        // Reject — send back to pending
        await db.choreInstance.update({
          where: { id: input.instanceId },
          data: { status: "PENDING", completedAt: null },
        });
        return { status: "PENDING" as const, xpAwarded: 0 };
      }

      // Approve — complete with XP
      const difficulty = instance.chore.difficulty as ChoreDifficulty;
      const isGroupTask = instance.chore.rotationPattern === "ALL_TOGETHER";
      const xpSettings = await db.xpSettings.findUnique({ where: { familyId } });
      const choreXpValues = (xpSettings?.choreXpValues ?? {}) as Record<string, number>;
      const xp = choreXpValues[difficulty] ?? DIFFICULTY_CONFIG[difficulty]?.xp ?? 0;

      const result = await db.$transaction(async (tx) => {
        await tx.choreInstance.update({
          where: { id: input.instanceId },
          data: {
            status: "DONE",
            verifiedById: memberId,
            verifiedAt: new Date(),
          },
        });

        // Determine who gets XP
        const xpRecipients = isGroupTask
          ? instance.instanceAssignees.map((a) => a.memberId)
          : instance.assignedMemberId
            ? [instance.assignedMemberId]
            : [];

        let anyLeveledUp = false;
        let allPendingPush: Awaited<ReturnType<typeof awardXp>>["pendingPush"] = [];

        for (const recipientId of xpRecipients) {
          const xpResult = await awardXp(tx, {
            memberId: recipientId,
            familyId,
            xpAmount: xp,
            source: "CHORE_COMPLETION",
            sourceId: instance.id,
            description: `Completed chore: ${instance.chore.title}`,
          });
          if (xpResult.leveledUp) anyLeveledUp = true;
          allPendingPush = [...allPendingPush, ...xpResult.pendingPush];

          await tx.activityEvent.create({
            data: {
              familyId,
              memberId: recipientId,
              type: "CHORE_COMPLETED",
              description: `Completed chore: ${instance.chore.title}`,
              sourceModule: "chores",
              sourceId: instance.id,
            },
          });
        }

        return { status: "DONE" as const, xpAwarded: xp, leveledUp: anyLeveledUp, pendingPush: allPendingPush };
      });

      flushPendingPush(result.pendingPush).catch(() => {});

      return { status: result.status, xpAwarded: result.xpAwarded, leveledUp: result.leveledUp };
    }),

  skipInstance: protectedProcedure
    .input(skipInstanceInput)
    .mutation(async ({ ctx, input }) => {
      const { memberId } = ctx.session;

      const instance = await db.choreInstance.findUnique({
        where: { id: input.instanceId },
        include: {
          chore: { select: { familyId: true } },
          instanceAssignees: { select: { memberId: true } },
        },
      });

      if (!instance || instance.chore.familyId !== ctx.session.familyId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      // Permission: assigned member, instance assignee, or admin
      const isAssigned =
        instance.assignedMemberId === memberId ||
        instance.instanceAssignees.some((a) => a.memberId === memberId);
      if (!isAssigned && ctx.session.role !== "ADMIN") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      if (instance.status !== "PENDING") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Can only skip pending instances",
        });
      }

      await db.choreInstance.update({
        where: { id: input.instanceId },
        data: { status: "SKIPPED" },
      });

      return { status: "SKIPPED" as const };
    }),

  uncompleteInstance: protectedProcedure
    .input(uncompleteInstanceInput)
    .mutation(async ({ ctx, input }) => {
      const { memberId, familyId } = ctx.session;

      const instance = await db.choreInstance.findUnique({
        where: { id: input.instanceId },
        include: {
          chore: {
            select: {
              id: true,
              title: true,
              familyId: true,
              rotationPattern: true,
            },
          },
          instanceAssignees: { select: { memberId: true } },
        },
      });

      if (!instance || instance.chore.familyId !== familyId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      // Permission: assigned member, instance assignee, or admin
      const isAssigned =
        instance.assignedMemberId === memberId ||
        instance.instanceAssignees.some((a) => a.memberId === memberId);
      if (!isAssigned && ctx.session.role !== "ADMIN") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      if (instance.status !== "DONE" && instance.status !== "PENDING_REVIEW" && instance.status !== "SKIPPED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Can only uncomplete done, skipped or pending-review instances",
        });
      }

      const isGroupTask = instance.chore.rotationPattern === "ALL_TOGETHER";

      await db.$transaction(async (tx) => {
        // If it was DONE, XP was already awarded — remove it
        if (instance.status === "DONE") {
          if (isGroupTask) {
            // Remove XP from all assignees
            for (const assignee of instance.instanceAssignees) {
              await removeXp(tx, {
                memberId: assignee.memberId,
                source: "CHORE_COMPLETION",
                sourceId: instance.id,
              });
            }
          } else if (instance.assignedMemberId) {
            await removeXp(tx, {
              memberId: instance.assignedMemberId,
              source: "CHORE_COMPLETION",
              sourceId: instance.id,
            });
          }
        }

        // Reset instance back to PENDING
        await tx.choreInstance.update({
          where: { id: input.instanceId },
          data: {
            status: "PENDING",
            completedAt: null,
            verifiedById: null,
            verifiedAt: null,
          },
        });
      });

      return { status: "PENDING" as const };
    }),

  // ─── Swap Requests ───────────────────────────────────────────

  requestSwap: protectedProcedure
    .input(requestSwapInput)
    .mutation(async ({ ctx, input }) => {
      const { memberId, familyId } = ctx.session;

      const instance = await db.choreInstance.findUnique({
        where: { id: input.instanceId },
        include: {
          chore: {
            select: {
              title: true,
              familyId: true,
              rotationPattern: true,
              assignees: { select: { memberId: true } },
            },
          },
          assignedMember: { select: { name: true } },
        },
      });

      if (!instance || instance.chore.familyId !== familyId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      // Only allow swaps on pending instances
      if (instance.status !== "PENDING") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only pending chores can be swapped or transferred",
        });
      }

      // Swaps not allowed for group tasks
      if (instance.chore.rotationPattern === "ALL_TOGETHER") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Swaps are not available for group tasks",
        });
      }

      if (instance.assignedMemberId !== memberId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the assigned member can request a swap",
        });
      }

      if (input.isTransfer) {
        // For transfers, verify target is in the same family
        const targetMember = await db.familyMember.findUnique({
          where: { id: input.targetMemberId },
          select: { familyId: true },
        });
        if (!targetMember || targetMember.familyId !== familyId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Target member is not in the same family",
          });
        }
      } else {
        // For swaps, verify target is in the rotation pool
        const targetInPool = instance.chore.assignees.some(
          (a) => a.memberId === input.targetMemberId
        );
        if (!targetInPool) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Target member is not in the chore rotation pool",
          });
        }
      }

      // Check for any existing pending swap on this instance (not just from this requester)
      const existingSwap = await db.choreSwapRequest.findFirst({
        where: {
          choreInstanceId: input.instanceId,
          status: "PENDING",
        },
      });
      if (existingSwap) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A swap request already exists for this instance",
        });
      }

      const swapRequest = await db.choreSwapRequest.create({
        data: {
          choreInstanceId: input.instanceId,
          requesterId: memberId,
          targetMemberId: input.targetMemberId,
        },
      });

      // Notify target member about the swap/transfer request
      const requesterName = instance.assignedMember?.name ?? "Someone";
      const choreTitle = instance.chore.title;
      const action = input.isTransfer ? "transfer" : "swap";
      const notif = await createNotification(db, {
        memberId: input.targetMemberId,
        type: "SWAP_REQUEST",
        title: `Chore ${action} request`,
        message: `${requesterName} wants to ${action} "${choreTitle}" with you`,
        linkUrl: "/chores",
      });
      if (notif) {
        sendPush(notif.memberId, {
          title: notif.title,
          message: notif.message,
          linkUrl: notif.linkUrl,
        }).catch(() => {});
      }

      return swapRequest;
    }),

  respondToSwap: protectedProcedure
    .input(respondToSwapInput)
    .mutation(async ({ ctx, input }) => {
      const { memberId } = ctx.session;

      const swap = await db.choreSwapRequest.findUnique({
        where: { id: input.swapRequestId },
        include: {
          choreInstance: {
            include: { chore: { select: { familyId: true, title: true } } },
          },
          targetMember: { select: { name: true } },
        },
      });

      if (
        !swap ||
        swap.choreInstance.chore.familyId !== ctx.session.familyId
      ) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      if (swap.targetMemberId !== memberId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the target member can respond to a swap",
        });
      }

      if (swap.status !== "PENDING") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Swap request is no longer pending",
        });
      }

      const choreTitle = swap.choreInstance.chore.title;
      const responderName = swap.targetMember.name;

      if (input.accepted) {
        // Verify the instance is still PENDING and still assigned to the requester
        if (swap.choreInstance.status !== "PENDING") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "This chore is no longer pending",
          });
        }
        if (swap.choreInstance.assignedMemberId !== swap.requesterId) {
          // Instance was already reassigned (e.g. by another swap) — auto-decline this stale request
          await db.choreSwapRequest.update({
            where: { id: input.swapRequestId },
            data: { status: "DECLINED", respondedAt: new Date() },
          });
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "This chore has already been reassigned",
          });
        }

        const result = await db.$transaction(async (tx) => {
          // Update instance assignment
          await tx.choreInstance.update({
            where: { id: swap.choreInstanceId },
            data: { assignedMemberId: swap.targetMemberId },
          });

          // Also update the instanceAssignee record so the grouping in
          // listMyInstances (which checks instanceAssignees first) reflects
          // the new assignee.  Swaps are blocked for group tasks, so there
          // is exactly one instanceAssignee to replace.
          await tx.choreInstanceAssignee.deleteMany({
            where: { choreInstanceId: swap.choreInstanceId },
          });
          await tx.choreInstanceAssignee.create({
            data: {
              choreInstanceId: swap.choreInstanceId,
              memberId: swap.targetMemberId,
            },
          });

          // Update swap status
          await tx.choreSwapRequest.update({
            where: { id: input.swapRequestId },
            data: { status: "ACCEPTED", respondedAt: new Date() },
          });

          // Cancel any other pending swap requests for this instance
          await tx.choreSwapRequest.updateMany({
            where: {
              choreInstanceId: swap.choreInstanceId,
              status: "PENDING",
              id: { not: input.swapRequestId },
            },
            data: { status: "DECLINED", respondedAt: new Date() },
          });

          const notif = await createNotification(tx, {
            memberId: swap.requesterId,
            type: "SWAP_REQUEST",
            title: "Swap request accepted",
            message: `${responderName} accepted your swap request for "${choreTitle}"`,
            linkUrl: "/chores",
          });

          return { status: "ACCEPTED" as const, pushNotif: notif };
        });

        if (result.pushNotif) {
          sendPush(result.pushNotif.memberId, {
            title: result.pushNotif.title,
            message: result.pushNotif.message,
            linkUrl: result.pushNotif.linkUrl,
          }).catch(() => {});
        }

        return { status: result.status };
      }

      // Decline
      await db.choreSwapRequest.update({
        where: { id: input.swapRequestId },
        data: { status: "DECLINED", respondedAt: new Date() },
      });

      const declineNotif = await createNotification(db, {
        memberId: swap.requesterId,
        type: "SWAP_REQUEST",
        title: "Swap request declined",
        message: `${responderName} declined your swap request for "${choreTitle}"`,
        linkUrl: "/chores",
      });
      if (declineNotif) {
        sendPush(declineNotif.memberId, {
          title: declineNotif.title,
          message: declineNotif.message,
          linkUrl: declineNotif.linkUrl,
        }).catch(() => {});
      }

      return { status: "DECLINED" as const };
    }),

  mySwapRequests: protectedProcedure.query(async ({ ctx }) => {
    const { memberId, familyId } = ctx.session;

    return db.choreSwapRequest.findMany({
      where: {
        status: "PENDING",
        targetMemberId: memberId,
        choreInstance: {
          chore: { familyId },
        },
      },
      include: {
        choreInstance: {
          include: {
            chore: { select: { title: true, category: true } },
            assignedMember: {
              select: { id: true, name: true, color: true },
            },
          },
        },
        requester: {
          select: { id: true, name: true, color: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }),

  // ─── Chore Sets ─────────────────────────────────────────────

  listSets: protectedProcedure.query(async ({ ctx }) => {
    const { familyId } = ctx.session;

    return db.choreSet.findMany({
      where: { familyId },
      include: {
        chores: {
          include: choreInclude,
        },
      },
      orderBy: { name: "asc" },
    });
  }),

  createSet: adminProcedure
    .input(createChoreSetInput)
    .mutation(async ({ ctx, input }) => {
      const { familyId } = ctx.session;

      return db.choreSet.create({
        data: {
          familyId,
          name: input.name,
          description: input.description,
        },
      });
    }),

  updateSet: adminProcedure
    .input(updateChoreSetInput)
    .mutation(async ({ ctx, input }) => {
      const set = await db.choreSet.findFirst({
        where: { id: input.id, familyId: ctx.session.familyId },
      });
      if (!set) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const { id, ...data } = input;
      return db.choreSet.update({ where: { id }, data });
    }),

  deleteSet: adminProcedure
    .input(deleteChoreSetInput)
    .mutation(async ({ ctx, input }) => {
      const set = await db.choreSet.findFirst({
        where: { id: input.id, familyId: ctx.session.familyId },
      });
      if (!set) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      // Remove set reference from chores, then delete set
      await db.$transaction(async (tx) => {
        await tx.chore.updateMany({
          where: { choreSetId: input.id },
          data: { choreSetId: null },
        });
        await tx.choreSet.delete({ where: { id: input.id } });
      });

      return { success: true };
    }),

  addChoreToSet: adminProcedure
    .input(addChoreToSetInput)
    .mutation(async ({ ctx, input }) => {
      const { familyId } = ctx.session;

      const [chore, set] = await Promise.all([
        db.chore.findFirst({ where: { id: input.choreId, familyId } }),
        db.choreSet.findFirst({ where: { id: input.choreSetId, familyId } }),
      ]);

      if (!chore || !set) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return db.chore.update({
        where: { id: input.choreId },
        data: { choreSetId: input.choreSetId },
      });
    }),

  removeChoreFromSet: adminProcedure
    .input(removeChoreFromSetInput)
    .mutation(async ({ ctx, input }) => {
      const chore = await db.chore.findFirst({
        where: { id: input.choreId, familyId: ctx.session.familyId },
      });
      if (!chore) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return db.chore.update({
        where: { id: input.choreId },
        data: { choreSetId: null },
      });
    }),

  // ─── Fairness Stats ──────────────────────────────────────────

  fairnessStats: protectedProcedure
    .input(fairnessStatsInput)
    .query(async ({ ctx, input }) => {
      const { familyId } = ctx.session;
      const since = new Date();
      since.setDate(since.getDate() - input.days);

      const instances = await db.choreInstance.findMany({
        where: {
          chore: { familyId },
          status: "DONE",
          completedAt: { gte: since },
        },
        include: {
          chore: { select: { difficulty: true } },
          assignedMember: {
            select: { id: true, name: true, color: true },
          },
          instanceAssignees: {
            include: {
              member: { select: { id: true, name: true, color: true } },
            },
          },
        },
      });

      // Group by member
      const statsMap = new Map<
        string,
        {
          memberId: string;
          memberName: string;
          memberColor: string;
          completions: number;
          totalXp: number;
        }
      >();

      for (const inst of instances) {
        const difficulty = inst.chore.difficulty as ChoreDifficulty;
        const xpPerMember = DIFFICULTY_CONFIG[difficulty]?.xp ?? 0;

        // Determine contributing members
        const members =
          inst.instanceAssignees.length > 0
            ? inst.instanceAssignees.map((a) => a.member)
            : inst.assignedMember
              ? [inst.assignedMember]
              : [];

        for (const member of members) {
          const key = member.id;
          if (!statsMap.has(key)) {
            statsMap.set(key, {
              memberId: member.id,
              memberName: member.name,
              memberColor: member.color,
              completions: 0,
              totalXp: 0,
            });
          }
          const stat = statsMap.get(key)!;
          stat.completions += 1;
          stat.totalXp += xpPerMember;
        }
      }

      const weeks = Math.max(1, input.days / 7);
      return Array.from(statsMap.values()).map((s) => ({
        ...s,
        avgPerWeek: Math.round((s.completions / weeks) * 10) / 10,
      }));
    }),
});
