import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, accountProcedure, adminProcedure } from "../init";
import { db } from "@/lib/db";
import { setAccountSession, getRequestMeta } from "@/lib/auth";
import { checkLoginRateLimit, checkAccountLockout, recordFailedLogin, resetLoginCounters } from "@/lib/rate-limit";
import bcrypt from "bcryptjs";

export const accountRouter = router({
  /** Account login with email + password (Layer 1). */
  login: publicProcedure
    .input(z.object({
      email: z.string().email(),
      password: z.string().min(1),
      rememberMe: z.boolean().default(false),
    }))
    .mutation(async ({ input }) => {
      const { ipAddress, userAgent } = await getRequestMeta();
      const email = input.email.toLowerCase();

      // Rate limit checks
      try {
        await checkLoginRateLimit(ipAddress);
      } catch {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Too many login attempts. Please try again later.",
        });
      }

      try {
        await checkAccountLockout(email);
      } catch {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Account temporarily locked. Please try again later.",
        });
      }

      const family = await db.family.findUnique({
        where: { email },
      });

      if (!family || family.passwordHash === "MIGRATION_REQUIRED") {
        await recordFailedLogin(email);
        await db.loginAttempt.create({
          data: {
            email,
            ipAddress,
            userAgent,
            success: false,
            failureReason: !family ? "UNKNOWN_EMAIL" : "MIGRATION_REQUIRED",
          },
        });
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid email or password",
        });
      }

      const valid = await bcrypt.compare(input.password, family.passwordHash);

      if (!valid) {
        await recordFailedLogin(email);
        await db.loginAttempt.create({
          data: {
            familyId: family.id,
            email,
            ipAddress,
            userAgent,
            success: false,
            failureReason: "INVALID_PASSWORD",
          },
        });
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid email or password",
        });
      }

      // Success - reset rate limits and create account session
      await resetLoginCounters(ipAddress, email);
      await db.loginAttempt.create({
        data: {
          familyId: family.id,
          email,
          ipAddress,
          userAgent,
          success: true,
        },
      });

      await setAccountSession(family.id, input.rememberMe);

      return { success: true, familyName: family.name };
    }),

  /** List family members for profile selection (requires account auth). */
  listMembers: accountProcedure.query(async ({ ctx }) => {
    const family = await db.family.findUnique({
      where: { id: ctx.session.familyId },
      include: {
        members: {
          select: {
            id: true,
            name: true,
            avatar: true,
            color: true,
            role: true,
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!family) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Family not found" });
    }

    return {
      family: { id: family.id, name: family.name },
      members: family.members,
    };
  }),

  /** Change account password (admin only). */
  changePassword: adminProcedure
    .input(z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(8).max(128),
    }))
    .mutation(async ({ ctx, input }) => {
      const family = await db.family.findUnique({
        where: { id: ctx.session.familyId },
      });

      if (!family) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const valid = await bcrypt.compare(input.currentPassword, family.passwordHash);
      if (!valid) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Current password is incorrect",
        });
      }

      const newHash = await bcrypt.hash(input.newPassword, 10);
      await db.family.update({
        where: { id: ctx.session.familyId },
        data: { passwordHash: newHash },
      });

      return { success: true };
    }),

  /** Change account email (admin only). */
  changeEmail: adminProcedure
    .input(z.object({
      newEmail: z.string().email(),
      password: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const family = await db.family.findUnique({
        where: { id: ctx.session.familyId },
      });

      if (!family) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      // Verify password
      const valid = await bcrypt.compare(input.password, family.passwordHash);
      if (!valid) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Password is incorrect",
        });
      }

      // Check email not already taken
      const existing = await db.family.findUnique({
        where: { email: input.newEmail.toLowerCase() },
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Email already in use",
        });
      }

      await db.family.update({
        where: { id: ctx.session.familyId },
        data: {
          email: input.newEmail.toLowerCase(),
          emailVerified: false,
        },
      });

      return { success: true };
    }),

  /** Get active sessions for this family (admin only). */
  activeSessions: adminProcedure.query(async ({ ctx }) => {
    return db.activeSession.findMany({
      where: {
        familyId: ctx.session.familyId,
        expiresAt: { gt: new Date() },
      },
      orderBy: { lastActivity: "desc" },
    });
  }),

  /** Invalidate a specific session (admin only). */
  invalidateSession: adminProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await db.activeSession.deleteMany({
        where: {
          id: input.sessionId,
          familyId: ctx.session.familyId,
        },
      });
      return { success: true };
    }),

  /** Get recent login attempts (admin only). */
  loginAttempts: adminProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
    }).optional())
    .query(async ({ ctx, input }) => {
      return db.loginAttempt.findMany({
        where: { familyId: ctx.session.familyId },
        orderBy: { createdAt: "desc" },
        take: input?.limit ?? 20,
      });
    }),
});
