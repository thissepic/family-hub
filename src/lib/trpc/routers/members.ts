import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, adminProcedure, userProcedure, familyProcedure } from "../init";
import { db } from "@/lib/db";
import { checkPinRateLimit, resetPinRateLimit } from "@/lib/rate-limit";
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
        userId: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });
  }),

  /** List members for profile selection (Layer 2). Returns selection metadata. */
  listForProfileSelection: familyProcedure.query(async ({ ctx }) => {
    const ownMember = await db.familyMember.findUnique({
      where: { familyId_userId: { familyId: ctx.session.familyId, userId: ctx.session.userId } },
      select: { id: true, role: true },
    });

    const isAdmin = ownMember?.role === "ADMIN";

    const members = await db.familyMember.findMany({
      where: { familyId: ctx.session.familyId },
      select: {
        id: true,
        name: true,
        avatar: true,
        color: true,
        role: true,
        userId: true,
        pinHash: true,
      },
      orderBy: { createdAt: "asc" },
    });

    return members.map((m) => ({
      id: m.id,
      name: m.name,
      avatar: m.avatar,
      color: m.color,
      role: m.role,
      isLinked: m.userId !== null,
      isOwnProfile: m.userId === ctx.session.userId,
      hasPin: !!m.pinHash,
      canSelect: isAdmin
        ? (m.userId === null || m.userId === ctx.session.userId)
        : m.userId === ctx.session.userId,
      skipPin: m.userId === ctx.session.userId || (isAdmin && m.userId === null),
    }));
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

  /** Admin creates a new member profile (optionally linked to an existing user by email). */
  adminCreate: adminProcedure
    .input(z.object({
      name: z.string().min(1).max(50),
      avatar: z.string().optional(),
      color: z.string().default("#3b82f6"),
      pin: z.string().min(4).max(8).optional(),
      role: z.enum(["ADMIN", "MEMBER"]).default("MEMBER"),
      locale: z.enum(["en", "de"]).nullable().optional(),
      email: z.string().email().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      let userId: string | undefined;

      // If email is provided, try to link to an existing user
      if (input.email) {
        const existingUser = await db.user.findUnique({
          where: { email: input.email.toLowerCase() },
          select: { id: true },
        });

        if (existingUser) {
          // Check if user is already a member of this family
          const existingMember = await db.familyMember.findUnique({
            where: { familyId_userId: { familyId: ctx.session.familyId, userId: existingUser.id } },
          });
          if (existingMember) {
            throw new TRPCError({
              code: "CONFLICT",
              message: "This user is already a member of this family",
            });
          }
          userId = existingUser.id;
        }
      }

      // PIN is required for unlinked profiles, optional for linked ones
      const pinHash = input.pin
        ? await bcrypt.hash(input.pin, 10)
        : null;

      return db.$transaction(async (tx) => {
        const member = await tx.familyMember.create({
          data: {
            familyId: ctx.session.familyId,
            userId,
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

  /**
   * Link an unlinked profile to the current user.
   * The user must verify the member's PIN to claim it.
   */
  linkProfile: userProcedure
    .input(z.object({
      memberId: z.string(),
      familyId: z.string(),
      pin: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const member = await db.familyMember.findUnique({
        where: { id: input.memberId },
      });

      if (!member || member.familyId !== input.familyId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Member not found" });
      }

      // Can only link unlinked profiles
      if (member.userId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This profile is already linked to a user",
        });
      }

      // Check if user already has a member in this family
      const existingMember = await db.familyMember.findUnique({
        where: { familyId_userId: { familyId: input.familyId, userId: ctx.session.userId } },
      });
      if (existingMember) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "You already have a profile in this family",
        });
      }

      // Verify PIN if the member has one set
      if (member.pinHash) {
        if (!input.pin) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "PIN required to claim this profile" });
        }

        const pinRateLimitKey = `${input.familyId}:${input.memberId}`;
        try {
          await checkPinRateLimit(pinRateLimitKey);
        } catch {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: "Too many PIN attempts. Please try again later.",
          });
        }

        const valid = await bcrypt.compare(input.pin, member.pinHash);
        if (!valid) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid PIN" });
        }

        await resetPinRateLimit(pinRateLimitKey);
      }

      // Link the profile
      return db.familyMember.update({
        where: { id: input.memberId },
        data: { userId: ctx.session.userId },
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
      if (ctx.session.memberId === input.memberId && member.pinHash) {
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
