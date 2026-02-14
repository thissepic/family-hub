import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, adminProcedure } from "../init";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

export const membersRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.familyMember.findMany({
      where: { familyId: ctx.session.familyId },
      select: {
        id: true,
        name: true,
        avatar: true,
        color: true,
        role: true,
        locale: true,
        themePreference: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });
  }),

  update: protectedProcedure
    .input(z.object({
      memberId: z.string(),
      name: z.string().min(1).max(50).optional(),
      avatar: z.string().optional(),
      color: z.string().optional(),
      locale: z.enum(["en", "de"]).nullable().optional(),
      themePreference: z.enum(["LIGHT", "DARK", "AUTO"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { memberId, ...data } = input;

      // Members can only update their own profile, admins can update anyone
      if (ctx.session.role !== "ADMIN" && ctx.session.memberId !== memberId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized to update this member" });
      }

      // Verify member belongs to same family
      const targetMember = await db.familyMember.findUnique({
        where: { id: memberId },
        select: { familyId: true },
      });
      if (!targetMember || targetMember.familyId !== ctx.session.familyId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Member not found" });
      }

      return db.familyMember.update({
        where: { id: memberId },
        data,
      });
    }),

  adminCreate: adminProcedure
    .input(z.object({
      name: z.string().min(1).max(50),
      avatar: z.string().optional(),
      color: z.string().default("#3b82f6"),
      pin: z.string().min(4).max(8),
      role: z.enum(["ADMIN", "MEMBER"]).default("MEMBER"),
      locale: z.enum(["en", "de"]).nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const pinHash = await bcrypt.hash(input.pin, 10);

      return db.$transaction(async (tx) => {
        const member = await tx.familyMember.create({
          data: {
            familyId: ctx.session.familyId,
            name: input.name,
            avatar: input.avatar,
            color: input.color,
            pinHash,
            role: input.role,
            locale: input.locale,
          },
        });

        await tx.memberXpProfile.create({
          data: { memberId: member.id },
        });

        return member;
      });
    }),

  updateRole: adminProcedure
    .input(z.object({
      memberId: z.string(),
      role: z.enum(["ADMIN", "MEMBER"]),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.session.memberId === input.memberId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot change your own role" });
      }

      // Verify member belongs to same family
      const targetMember = await db.familyMember.findUnique({
        where: { id: input.memberId },
        select: { familyId: true },
      });
      if (!targetMember || targetMember.familyId !== ctx.session.familyId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Member not found" });
      }

      if (input.role === "MEMBER") {
        const adminCount = await db.familyMember.count({
          where: { familyId: ctx.session.familyId, role: "ADMIN" },
        });
        if (adminCount <= 1) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot demote the last admin" });
        }
      }

      return db.familyMember.update({
        where: { id: input.memberId },
        data: { role: input.role },
      });
    }),

  adminResetPin: adminProcedure
    .input(z.object({
      memberId: z.string(),
      newPin: z.string().min(4).max(8),
    }))
    .mutation(async ({ ctx, input }) => {
      const member = await db.familyMember.findUnique({
        where: { id: input.memberId },
      });

      if (!member || member.familyId !== ctx.session.familyId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Member not found" });
      }

      const pinHash = await bcrypt.hash(input.newPin, 10);

      return db.familyMember.update({
        where: { id: input.memberId },
        data: { pinHash },
      });
    }),

  delete: adminProcedure
    .input(z.object({
      memberId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.session.memberId === input.memberId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot delete yourself" });
      }

      const member = await db.familyMember.findUnique({
        where: { id: input.memberId },
      });

      if (!member || member.familyId !== ctx.session.familyId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Member not found" });
      }

      if (member.role === "ADMIN") {
        const adminCount = await db.familyMember.count({
          where: { familyId: ctx.session.familyId, role: "ADMIN" },
        });
        if (adminCount <= 1) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot delete the last admin" });
        }
      }

      return db.familyMember.delete({
        where: { id: input.memberId },
      });
    }),

  changePin: protectedProcedure
    .input(z.object({
      memberId: z.string(),
      currentPin: z.string(),
      newPin: z.string().min(4).max(8),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.session.role !== "ADMIN" && ctx.session.memberId !== input.memberId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized" });
      }

      const member = await db.familyMember.findUnique({
        where: { id: input.memberId },
      });

      if (!member || member.familyId !== ctx.session.familyId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Member not found" });
      }

      // Admins can skip current PIN check for other members
      if (ctx.session.memberId === input.memberId) {
        const valid = await bcrypt.compare(input.currentPin, member.pinHash);
        if (!valid) throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid current PIN" });
      }

      const pinHash = await bcrypt.hash(input.newPin, 10);

      return db.familyMember.update({
        where: { id: input.memberId },
        data: { pinHash },
      });
    }),
});
