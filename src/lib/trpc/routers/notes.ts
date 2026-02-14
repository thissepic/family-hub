import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../init";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import {
  listNotesInput,
  getNoteInput,
  createNoteInput,
  updateNoteInput,
  deleteNoteInput,
  togglePinInput,
} from "./notes.schemas";

const noteInclude = {
  createdBy: { select: { id: true, name: true, color: true } },
  attachments: {
    select: { id: true, filename: true, path: true, mimeType: true, createdAt: true },
    orderBy: { createdAt: "asc" as const },
  },
};

export const notesRouter = router({
  // ─── List notes ──────────────────────────────────────────────
  list: protectedProcedure.input(listNotesInput).query(async ({ ctx, input }) => {
    const where: Prisma.NoteWhereInput = {
      familyId: ctx.session.familyId,
    };

    if (input.search) {
      where.title = { contains: input.search, mode: "insensitive" };
    }

    if (input.category) {
      where.category = input.category;
    }

    if (input.pinnedOnly) {
      where.pinned = true;
    }

    return db.note.findMany({
      where,
      include: noteInclude,
      orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
    });
  }),

  // ─── Get single note ────────────────────────────────────────
  get: protectedProcedure.input(getNoteInput).query(async ({ ctx, input }) => {
    const note = await db.note.findUnique({
      where: { id: input.id },
      include: noteInclude,
    });

    if (!note || note.familyId !== ctx.session.familyId) {
      throw new TRPCError({ code: "NOT_FOUND" });
    }

    return note;
  }),

  // ─── Create note ────────────────────────────────────────────
  create: protectedProcedure
    .input(createNoteInput)
    .mutation(async ({ ctx, input }) => {
      const note = await db.note.create({
        data: {
          familyId: ctx.session.familyId,
          title: input.title,
          body: input.body ?? undefined,
          color: input.color,
          category: input.category,
          pinned: input.pinned ?? false,
          createdById: ctx.session.memberId,
        },
        include: noteInclude,
      });

      // Activity event if pinned
      if (note.pinned) {
        await db.activityEvent.create({
          data: {
            familyId: ctx.session.familyId,
            memberId: ctx.session.memberId,
            type: "NOTE_PINNED",
            description: `Pinned note: ${note.title}`,
            sourceModule: "notes",
            sourceId: note.id,
          },
        });
      }

      return note;
    }),

  // ─── Update note ────────────────────────────────────────────
  update: protectedProcedure
    .input(updateNoteInput)
    .mutation(async ({ ctx, input }) => {
      const existing = await db.note.findUnique({
        where: { id: input.id },
      });

      if (!existing || existing.familyId !== ctx.session.familyId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const { id, ...data } = input;

      return db.note.update({
        where: { id },
        data: {
          ...(data.title !== undefined && { title: data.title }),
          ...(data.body !== undefined && { body: data.body }),
          ...(data.color !== undefined && { color: data.color }),
          ...(data.category !== undefined && { category: data.category }),
          ...(data.pinned !== undefined && { pinned: data.pinned }),
        },
        include: noteInclude,
      });
    }),

  // ─── Delete note ────────────────────────────────────────────
  delete: protectedProcedure
    .input(deleteNoteInput)
    .mutation(async ({ ctx, input }) => {
      const existing = await db.note.findUnique({
        where: { id: input.id },
      });

      if (!existing || existing.familyId !== ctx.session.familyId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      await db.note.delete({ where: { id: input.id } });

      return { success: true };
    }),

  // ─── Toggle pin ─────────────────────────────────────────────
  togglePin: protectedProcedure
    .input(togglePinInput)
    .mutation(async ({ ctx, input }) => {
      const existing = await db.note.findUnique({
        where: { id: input.id },
      });

      if (!existing || existing.familyId !== ctx.session.familyId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const newPinned = !existing.pinned;

      const note = await db.note.update({
        where: { id: input.id },
        data: { pinned: newPinned },
        include: noteInclude,
      });

      if (newPinned) {
        await db.activityEvent.create({
          data: {
            familyId: ctx.session.familyId,
            memberId: ctx.session.memberId,
            type: "NOTE_PINNED",
            description: `Pinned note: ${note.title}`,
            sourceModule: "notes",
            sourceId: note.id,
          },
        });
      }

      return note;
    }),

  // ─── Delete attachment ────────────────────────────────────────
  deleteAttachment: protectedProcedure
    .input(deleteNoteInput) // reuse: just needs { id: string }
    .mutation(async ({ ctx, input }) => {
      const attachment = await db.noteAttachment.findUnique({
        where: { id: input.id },
        include: { note: { select: { familyId: true } } },
      });

      if (!attachment || attachment.note.familyId !== ctx.session.familyId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      await db.noteAttachment.delete({ where: { id: input.id } });

      return { success: true };
    }),
});
