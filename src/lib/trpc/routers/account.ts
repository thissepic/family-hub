import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, accountProcedure, adminProcedure } from "../init";
import { db } from "@/lib/db";
import { setAccountSession, getRequestMeta } from "@/lib/auth";
import {
  checkLoginRateLimit,
  checkAccountLockout,
  recordFailedLogin,
  resetLoginCounters,
  checkPasswordResetRateLimit,
  checkVerificationResendRateLimit,
} from "@/lib/rate-limit";
import { createEmailToken, validateEmailToken } from "@/lib/email/tokens";
import {
  enqueueVerificationEmail,
  enqueuePasswordResetEmail,
  enqueueEmailChangeNotification,
  enqueueEmailChangeVerification,
} from "@/lib/email/queue";
import bcrypt from "bcryptjs";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

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

  /** Request a password reset email (public, from login page "forgot password"). */
  requestPasswordReset: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      const email = input.email.toLowerCase();

      try {
        await checkPasswordResetRateLimit(email);
      } catch {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Too many reset requests. Please try again later.",
        });
      }

      // Always return success to prevent email enumeration
      const family = await db.family.findUnique({ where: { email } });
      if (!family) {
        return { success: true };
      }

      const rawToken = await createEmailToken(family.id, "PASSWORD_RESET");
      const resetUrl = `${APP_URL}/reset-password?token=${rawToken}`;

      await enqueuePasswordResetEmail(email, family.defaultLocale, family.name, resetUrl);

      return { success: true };
    }),

  /** Reset password using a token from email. */
  resetPassword: publicProcedure
    .input(z.object({
      token: z.string(),
      newPassword: z.string().min(8).max(128),
    }))
    .mutation(async ({ input }) => {
      let tokenRecord;
      try {
        tokenRecord = await validateEmailToken(input.token, "PASSWORD_RESET");
      } catch {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid or expired reset link.",
        });
      }

      const newHash = await bcrypt.hash(input.newPassword, 10);

      await db.$transaction(async (tx) => {
        await tx.family.update({
          where: { id: tokenRecord.familyId },
          data: { passwordHash: newHash },
        });

        await tx.emailToken.update({
          where: { id: tokenRecord.id },
          data: { usedAt: new Date() },
        });

        // Invalidate all sessions to force re-login with new password
        await tx.activeSession.deleteMany({
          where: { familyId: tokenRecord.familyId },
        });
      });

      return { success: true };
    }),

  /** Verify email address using a token (handles both VERIFICATION and EMAIL_CHANGE). */
  verifyEmail: publicProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ input }) => {
      let tokenRecord;

      // Try VERIFICATION first, then EMAIL_CHANGE
      try {
        tokenRecord = await validateEmailToken(input.token, "VERIFICATION");
      } catch {
        try {
          tokenRecord = await validateEmailToken(input.token, "EMAIL_CHANGE");
        } catch {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid or expired verification link.",
          });
        }
      }

      await db.$transaction(async (tx) => {
        await tx.family.update({
          where: { id: tokenRecord.familyId },
          data: { emailVerified: true },
        });

        await tx.emailToken.update({
          where: { id: tokenRecord.id },
          data: { usedAt: new Date() },
        });
      });

      return { success: true };
    }),

  /** Resend verification email (requires account-level auth). */
  resendVerification: accountProcedure.mutation(async ({ ctx }) => {
    try {
      await checkVerificationResendRateLimit(ctx.session.familyId);
    } catch {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Too many resend requests. Please try again later.",
      });
    }

    const family = await db.family.findUnique({
      where: { id: ctx.session.familyId },
    });

    if (!family) {
      throw new TRPCError({ code: "NOT_FOUND" });
    }

    if (family.emailVerified) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Email is already verified." });
    }

    const rawToken = await createEmailToken(family.id, "VERIFICATION");
    const verifyUrl = `${APP_URL}/verify-email?token=${rawToken}`;

    await enqueueVerificationEmail(family.email, family.defaultLocale, family.name, verifyUrl);

    return { success: true };
  }),

  /** Request password change email from settings (admin only). */
  requestPasswordChange: adminProcedure.mutation(async ({ ctx }) => {
    const family = await db.family.findUnique({
      where: { id: ctx.session.familyId },
    });

    if (!family) {
      throw new TRPCError({ code: "NOT_FOUND" });
    }

    const rawToken = await createEmailToken(family.id, "PASSWORD_RESET");
    const resetUrl = `${APP_URL}/reset-password?token=${rawToken}`;

    await enqueuePasswordResetEmail(family.email, family.defaultLocale, family.name, resetUrl);

    return { success: true };
  }),

  /** Change account email (admin only). Sends notification to old + verification to new. */
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

      const newEmail = input.newEmail.toLowerCase();

      // Check email not already taken
      const existing = await db.family.findUnique({
        where: { email: newEmail },
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Email already in use",
        });
      }

      const oldEmail = family.email;

      await db.family.update({
        where: { id: ctx.session.familyId },
        data: {
          email: newEmail,
          emailVerified: false,
        },
      });

      // Notify old email about the change
      await enqueueEmailChangeNotification(oldEmail, newEmail, family.name, family.defaultLocale);

      // Send verification to new email
      const rawToken = await createEmailToken(ctx.session.familyId, "EMAIL_CHANGE", { newEmail });
      const verifyUrl = `${APP_URL}/verify-email?token=${rawToken}`;
      await enqueueEmailChangeVerification(newEmail, family.defaultLocale, family.name, verifyUrl);

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
