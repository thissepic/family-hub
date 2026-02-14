import { TRPCError } from "@trpc/server";
import { rrulestr } from "rrule";
import { router, protectedProcedure } from "../init";
import { db } from "@/lib/db";
import { expandRecurrence, addExdateToRule } from "@/lib/calendar/recurrence";
import { parseIcalString, generateIcalString } from "@/lib/calendar/ical";
import {
  listEventsInput,
  createEventInput,
  updateEventInput,
  deleteEventInput,
  getByIdInput,
  importIcalInput,
  exportIcalInput,
  getConflictsInput,
} from "./calendar.schemas";

const assigneeInclude = {
  assignees: {
    include: {
      member: {
        select: { id: true, name: true, color: true },
      },
    },
  },
} as const;

export const calendarRouter = router({
  list: protectedProcedure
    .input(listEventsInput)
    .query(async ({ ctx, input }) => {
      const { start, end, memberIds, categories } = input;
      const familyId = ctx.session.familyId;

      // Build where clause for member filtering
      const memberFilter = memberIds?.length
        ? { assignees: { some: { memberId: { in: memberIds } } } }
        : {};
      const categoryFilter = categories?.length
        ? { category: { in: categories } }
        : {};

      // Phase 1: Get non-recurring events in date range
      const nonRecurringEvents = await db.calendarEvent.findMany({
        where: {
          familyId,
          recurrenceRule: null,
          startAt: { lt: end },
          endAt: { gt: start },
          ...memberFilter,
          ...categoryFilter,
        },
        include: assigneeInclude,
        orderBy: { startAt: "asc" },
      });

      // Phase 2: Get ALL recurring events and expand them
      const recurringEvents = await db.calendarEvent.findMany({
        where: {
          familyId,
          recurrenceRule: { not: null },
          ...memberFilter,
          ...categoryFilter,
        },
        include: assigneeInclude,
      });

      // Expand recurring events into instances
      const expandedInstances = recurringEvents.flatMap((event) => {
        if (!event.recurrenceRule) return [];
        const instances = expandRecurrence(
          {
            id: event.id,
            startAt: event.startAt,
            endAt: event.endAt,
            recurrenceRule: event.recurrenceRule,
          },
          start,
          end
        );
        return instances.map((instance) => ({
          ...event,
          startAt: instance.startAt,
          endAt: instance.endAt,
          isRecurringInstance: true,
          parentEventId: instance.parentEventId,
          originalStartAt: instance.originalStartAt,
        }));
      });

      // Merge and sort all events
      const allEvents = [
        ...nonRecurringEvents.map((e) => ({
          ...e,
          isRecurringInstance: false,
          parentEventId: null,
          originalStartAt: null,
        })),
        ...expandedInstances,
      ].sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

      return allEvents;
    }),

  create: protectedProcedure
    .input(createEventInput)
    .mutation(async ({ ctx, input }) => {
      const familyId = ctx.session.familyId;

      if (input.endAt < input.startAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "End time must be after start time",
        });
      }

      // Validate recurrence rule parses correctly
      if (input.recurrenceRule) {
        try {
          rrulestr(input.recurrenceRule, { dtstart: input.startAt });
        } catch {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid recurrence rule",
          });
        }
      }

      return db.$transaction(async (tx) => {
        const event = await tx.calendarEvent.create({
          data: {
            familyId,
            title: input.title,
            description: input.description,
            location: input.location,
            startAt: input.startAt,
            endAt: input.endAt,
            allDay: input.allDay,
            recurrenceRule: input.recurrenceRule,
            category: input.category,
            createdById: ctx.session.memberId,
            source: "LOCAL",
          },
        });

        // Create assignees
        await tx.eventAssignee.createMany({
          data: input.assigneeIds.map((memberId) => ({
            eventId: event.id,
            memberId,
          })),
        });

        return tx.calendarEvent.findUniqueOrThrow({
          where: { id: event.id },
          include: assigneeInclude,
        });
      });
    }),

  update: protectedProcedure
    .input(updateEventInput)
    .mutation(async ({ ctx, input }) => {
      const { id, editMode, instanceDate, assigneeIds, ...updateData } = input;
      const familyId = ctx.session.familyId;

      const existingEvent = await db.calendarEvent.findFirst({
        where: { id, familyId },
        include: assigneeInclude,
      });

      if (!existingEvent) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Event not found" });
      }

      if (existingEvent.isReadOnly) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot edit read-only events",
        });
      }

      // Validate dates if provided
      const newStart = updateData.startAt ?? existingEvent.startAt;
      const newEnd = updateData.endAt ?? existingEvent.endAt;
      if (newEnd < newStart) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "End time must be after start time",
        });
      }

      return db.$transaction(async (tx) => {
        if (
          editMode === "THIS" &&
          existingEvent.recurrenceRule &&
          instanceDate
        ) {
          // Create exception: add EXDATE to parent, create standalone event
          const updatedRule = addExdateToRule(
            existingEvent.recurrenceRule,
            instanceDate
          );

          await tx.calendarEvent.update({
            where: { id },
            data: { recurrenceRule: updatedRule },
          });

          // Create new standalone event for this instance
          const newEvent = await tx.calendarEvent.create({
            data: {
              familyId,
              title: updateData.title ?? existingEvent.title,
              description:
                updateData.description !== undefined
                  ? updateData.description
                  : existingEvent.description,
              location:
                updateData.location !== undefined
                  ? updateData.location
                  : existingEvent.location,
              startAt: updateData.startAt ?? instanceDate,
              endAt:
                updateData.endAt ??
                new Date(
                  instanceDate.getTime() +
                    (existingEvent.endAt.getTime() -
                      existingEvent.startAt.getTime())
                ),
              allDay: updateData.allDay ?? existingEvent.allDay,
              category: updateData.category ?? existingEvent.category,
              createdById: ctx.session.memberId,
              source: "LOCAL",
            },
          });

          const memberIds =
            assigneeIds ??
            existingEvent.assignees.map((a) => a.member.id);
          await tx.eventAssignee.createMany({
            data: memberIds.map((memberId) => ({
              eventId: newEvent.id,
              memberId,
            })),
          });

          return tx.calendarEvent.findUniqueOrThrow({
            where: { id: newEvent.id },
            include: assigneeInclude,
          });
        }

        // editMode "ALL" or non-recurring: update the event directly
        const updated = await tx.calendarEvent.update({
          where: { id },
          data: {
            ...(updateData.title !== undefined && { title: updateData.title }),
            ...(updateData.description !== undefined && {
              description: updateData.description,
            }),
            ...(updateData.location !== undefined && {
              location: updateData.location,
            }),
            ...(updateData.startAt !== undefined && {
              startAt: updateData.startAt,
            }),
            ...(updateData.endAt !== undefined && { endAt: updateData.endAt }),
            ...(updateData.allDay !== undefined && {
              allDay: updateData.allDay,
            }),
            ...(updateData.recurrenceRule !== undefined && {
              recurrenceRule: updateData.recurrenceRule,
            }),
            ...(updateData.category !== undefined && {
              category: updateData.category,
            }),
          },
        });

        // Update assignees if provided
        if (assigneeIds) {
          await tx.eventAssignee.deleteMany({ where: { eventId: id } });
          await tx.eventAssignee.createMany({
            data: assigneeIds.map((memberId) => ({
              eventId: id,
              memberId,
            })),
          });
        }

        return tx.calendarEvent.findUniqueOrThrow({
          where: { id: updated.id },
          include: assigneeInclude,
        });
      });
    }),

  delete: protectedProcedure
    .input(deleteEventInput)
    .mutation(async ({ ctx, input }) => {
      const { id, deleteMode, instanceDate } = input;
      const familyId = ctx.session.familyId;

      const event = await db.calendarEvent.findFirst({
        where: { id, familyId },
      });

      if (!event) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Event not found" });
      }

      if (event.isReadOnly) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot delete read-only events",
        });
      }

      if (
        deleteMode === "THIS" &&
        event.recurrenceRule &&
        instanceDate
      ) {
        // Add EXDATE to exclude this occurrence
        const updatedRule = addExdateToRule(
          event.recurrenceRule,
          instanceDate
        );
        await db.calendarEvent.update({
          where: { id },
          data: { recurrenceRule: updatedRule },
        });
        return { deleted: false, excluded: true };
      }

      // Delete the entire event (cascades to assignees via Prisma)
      await db.calendarEvent.delete({ where: { id } });
      return { deleted: true, excluded: false };
    }),

  getById: protectedProcedure
    .input(getByIdInput)
    .query(async ({ ctx, input }) => {
      const event = await db.calendarEvent.findFirst({
        where: { id: input.id, familyId: ctx.session.familyId },
        include: assigneeInclude,
      });

      if (!event) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Event not found" });
      }

      return event;
    }),

  importIcal: protectedProcedure
    .input(importIcalInput)
    .mutation(async ({ ctx, input }) => {
      const familyId = ctx.session.familyId;
      const parsedEvents = parseIcalString(input.icalString);

      let count = 0;
      for (const parsed of parsedEvents) {
        await db.$transaction(async (tx) => {
          const event = await tx.calendarEvent.create({
            data: {
              familyId,
              title: parsed.title,
              description: parsed.description,
              location: parsed.location,
              startAt: parsed.startAt,
              endAt: parsed.endAt,
              allDay: parsed.allDay,
              recurrenceRule: parsed.recurrenceRule,
              category: input.category ?? "OTHER",
              createdById: ctx.session.memberId,
              source: "LOCAL",
            },
          });

          await tx.eventAssignee.create({
            data: {
              eventId: event.id,
              memberId: ctx.session.memberId,
            },
          });
        });
        count++;
      }

      return { count };
    }),

  exportIcal: protectedProcedure
    .input(exportIcalInput)
    .query(async ({ ctx, input }) => {
      const familyId = ctx.session.familyId;

      const where: Record<string, unknown> = { familyId };
      if (input.start && input.end) {
        where.startAt = { lt: input.end };
        where.endAt = { gt: input.start };
      }
      if (input.memberIds?.length) {
        where.assignees = {
          some: { memberId: { in: input.memberIds } },
        };
      }

      const events = await db.calendarEvent.findMany({
        where,
        orderBy: { startAt: "asc" },
      });

      const icalString = generateIcalString(events);
      return { icalString };
    }),

  getConflicts: protectedProcedure
    .input(getConflictsInput)
    .query(async ({ ctx, input }) => {
      const familyId = ctx.session.familyId;

      const conflicts = await db.calendarEvent.findMany({
        where: {
          familyId,
          // Date overlap: existing starts before input ends AND existing ends after input starts
          startAt: { lt: input.endAt },
          endAt: { gt: input.startAt },
          // For the specified members
          assignees: {
            some: { memberId: { in: input.memberIds } },
          },
          // Exclude the event being edited
          ...(input.excludeEventId
            ? { id: { not: input.excludeEventId } }
            : {}),
        },
        include: assigneeInclude,
        orderBy: { startAt: "asc" },
        take: 5,
      });

      return conflicts;
    }),
});
