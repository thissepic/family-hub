import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, userProcedure } from "../init";
import { db } from "@/lib/db";
import { setUserSession, getRequestMeta, clearSession } from "@/lib/auth";
import {
  checkLoginRateLimit,
  checkAccountLockout,
  recordFailedLogin,
  resetLoginCounters,
  checkPasswordResetRateLimit,
  checkVerificationResendRateLimit,
  checkTotpRateLimit,
  resetTotpRateLimit,
} from "@/lib/rate-limit";
import { createEmailToken, validateEmailToken } from "@/lib/email/tokens";
import {
  enqueueVerificationEmail,
  enqueuePasswordResetEmail,
  enqueueEmailChangeNotification,
  enqueueEmailChangeVerification,
  enqueueTwoFactorEnabledEmail,
  enqueueTwoFactorDisabledEmail,
  enqueueOAuthUnlinkedEmail,
} from "@/lib/email/queue";
import bcrypt from "bcryptjs";
import { createPendingToken, consumePendingToken } from "@/lib/two-factor-pending";
import {
  generateTotpSecret,
  encryptTotpSecret,
  decryptTotpSecret,
  generateTotpUri,
  generateQrCodeDataUrl,
  verifyTotpCode,
  generateRecoveryCodes,
  matchRecoveryCode,
} from "@/lib/two-factor";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const accountRouter = router({
  /** Account login with email + password. */
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

      const user = await db.user.findUnique({
        where: { email },
      });

      if (!user) {
        await recordFailedLogin(email);
        await db.loginAttempt.create({
          data: {
            email,
            ipAddress,
            userAgent,
            success: false,
            failureReason: "UNKNOWN_EMAIL",
          },
        });
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid email or password",
        });
      }

      // OAuth-only account: no password set
      if (user.passwordHash === null) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "OAUTH_ONLY_ACCOUNT",
        });
      }

      const valid = await bcrypt.compare(input.password, user.passwordHash);

      if (!valid) {
        await recordFailedLogin(email);
        await db.loginAttempt.create({
          data: {
            userId: user.id,
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

      // Success - reset rate limits
      await resetLoginCounters(ipAddress, email);
      await db.loginAttempt.create({
        data: {
          userId: user.id,
          email,
          ipAddress,
          userAgent,
          success: true,
        },
      });

      // Check if 2FA is enabled
      if (user.twoFactorEnabled && user.twoFactorSecret) {
        const pendingToken = await createPendingToken({
          userId: user.id,
          rememberMe: input.rememberMe,
        });
        return {
          success: true as const,
          requiresTwoFactor: true as const,
          twoFactorToken: pendingToken,
        };
      }

      await setUserSession(user.id, input.rememberMe);

      return { success: true as const };
    }),

  /** List all families the current user belongs to. */
  listFamilies: userProcedure.query(async ({ ctx }) => {
    const members = await db.familyMember.findMany({
      where: { userId: ctx.session.userId },
      include: {
        family: {
          select: { id: true, name: true, defaultLocale: true, theme: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return members.map((m) => ({
      familyId: m.family.id,
      familyName: m.family.name,
      memberId: m.id,
      memberName: m.name,
      role: m.role,
      avatar: m.avatar,
      color: m.color,
    }));
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
      const user = await db.user.findUnique({ where: { email } });
      if (!user) {
        return { success: true };
      }

      const rawToken = await createEmailToken(user.id, "PASSWORD_RESET");
      const resetUrl = `${APP_URL}/reset-password?token=${rawToken}`;

      await enqueuePasswordResetEmail(email, user.defaultLocale, email, resetUrl);

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
        await tx.user.update({
          where: { id: tokenRecord.userId },
          data: { passwordHash: newHash },
        });

        await tx.emailToken.update({
          where: { id: tokenRecord.id },
          data: { usedAt: new Date() },
        });

        // Invalidate all sessions to force re-login with new password
        await tx.activeSession.deleteMany({
          where: { userId: tokenRecord.userId },
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
        await tx.user.update({
          where: { id: tokenRecord.userId },
          data: { emailVerified: true },
        });

        await tx.emailToken.update({
          where: { id: tokenRecord.id },
          data: { usedAt: new Date() },
        });
      });

      return { success: true };
    }),

  /** Resend verification email (requires user-level auth). */
  resendVerification: userProcedure.mutation(async ({ ctx }) => {
    try {
      await checkVerificationResendRateLimit(ctx.session.userId);
    } catch {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Too many resend requests. Please try again later.",
      });
    }

    const user = await db.user.findUnique({
      where: { id: ctx.session.userId },
    });

    if (!user) {
      throw new TRPCError({ code: "NOT_FOUND" });
    }

    if (user.emailVerified) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Email is already verified." });
    }

    let rawToken: string;
    try {
      rawToken = await createEmailToken(user.id, "VERIFICATION");
    } catch (err) {
      console.error("[resendVerification] Failed to create email token:", err);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create verification token.",
      });
    }

    const verifyUrl = `${APP_URL}/verify-email?token=${rawToken}`;

    try {
      await enqueueVerificationEmail(user.email, user.defaultLocale, user.email, verifyUrl);
    } catch (err) {
      console.error("[resendVerification] Failed to enqueue verification email:", err);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to send verification email. Please try again later.",
      });
    }

    return { success: true };
  }),

  /** Request password change email from account settings. */
  requestPasswordChange: userProcedure.mutation(async ({ ctx }) => {
    const user = await db.user.findUnique({
      where: { id: ctx.session.userId },
    });

    if (!user) {
      throw new TRPCError({ code: "NOT_FOUND" });
    }

    const rawToken = await createEmailToken(user.id, "PASSWORD_RESET");
    const resetUrl = `${APP_URL}/reset-password?token=${rawToken}`;

    await enqueuePasswordResetEmail(user.email, user.defaultLocale, user.email, resetUrl);

    return { success: true };
  }),

  /** Change account email. Sends notification to old + verification to new. */
  changeEmail: userProcedure
    .input(z.object({
      newEmail: z.string().email(),
      password: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const user = await db.user.findUnique({
        where: { id: ctx.session.userId },
      });

      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      // Verify password (OAuth-only accounts have no password)
      if (!user.passwordHash) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "OAUTH_ONLY_ACCOUNT",
        });
      }
      const valid = await bcrypt.compare(input.password, user.passwordHash);
      if (!valid) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Password is incorrect",
        });
      }

      const newEmail = input.newEmail.toLowerCase();

      // Check email not already taken
      const existing = await db.user.findUnique({
        where: { email: newEmail },
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Email already in use",
        });
      }

      const oldEmail = user.email;

      await db.user.update({
        where: { id: ctx.session.userId },
        data: {
          email: newEmail,
          emailVerified: false,
        },
      });

      // Notify old email about the change
      await enqueueEmailChangeNotification(ctx.session.userId, oldEmail, newEmail, oldEmail, user.defaultLocale);

      // Send verification to new email
      const rawToken = await createEmailToken(ctx.session.userId, "EMAIL_CHANGE", { newEmail });
      const verifyUrl = `${APP_URL}/verify-email?token=${rawToken}`;
      await enqueueEmailChangeVerification(newEmail, user.defaultLocale, newEmail, verifyUrl);

      return { success: true };
    }),

  /** Get active sessions for this user. */
  activeSessions: userProcedure.query(async ({ ctx }) => {
    return db.activeSession.findMany({
      where: {
        userId: ctx.session.userId,
        expiresAt: { gt: new Date() },
      },
      orderBy: { lastActivity: "desc" },
    });
  }),

  /** Invalidate a specific session. */
  invalidateSession: userProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await db.activeSession.deleteMany({
        where: {
          id: input.sessionId,
          userId: ctx.session.userId,
        },
      });
      return { success: true };
    }),

  /** Get recent login attempts. */
  loginAttempts: userProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
    }).optional())
    .query(async ({ ctx, input }) => {
      return db.loginAttempt.findMany({
        where: { userId: ctx.session.userId },
        orderBy: { createdAt: "desc" },
        take: input?.limit ?? 20,
      });
    }),

  // ─── Two-Factor Authentication ─────────────────────────────────────────────

  /** Verify TOTP or recovery code after login (no session yet). */
  verifyTwoFactor: publicProcedure
    .input(z.object({
      token: z.string(),
      code: z.string().min(6).max(9),
    }))
    .mutation(async ({ input }) => {
      const { ipAddress } = await getRequestMeta();

      try {
        await checkTotpRateLimit(ipAddress);
      } catch {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Too many verification attempts. Please try again later.",
        });
      }

      const pending = await consumePendingToken(input.token);
      if (!pending) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid or expired verification. Please log in again.",
        });
      }

      const user = await db.user.findUnique({
        where: { id: pending.userId },
        include: { twoFactorRecoveryCodes: true },
      });

      if (!user || !user.twoFactorSecret) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      }

      const secret = decryptTotpSecret(user.twoFactorSecret);
      const code = input.code.replace(/[-\s]/g, "");

      // Try TOTP first
      if (code.length === 6 && verifyTotpCode(code, secret)) {
        await resetTotpRateLimit(ipAddress);
        await setUserSession(pending.userId, pending.rememberMe);
        return { success: true, usedRecoveryCode: false };
      }

      // Try recovery code
      const matchedCodeId = await matchRecoveryCode(
        input.code,
        user.twoFactorRecoveryCodes
      );

      if (matchedCodeId) {
        await db.twoFactorRecoveryCode.update({
          where: { id: matchedCodeId },
          data: { usedAt: new Date() },
        });
        await resetTotpRateLimit(ipAddress);
        await setUserSession(pending.userId, pending.rememberMe);

        const remaining = user.twoFactorRecoveryCodes.filter(
          (c) => !c.usedAt && c.id !== matchedCodeId
        ).length;

        return { success: true, usedRecoveryCode: true, remainingCodes: remaining };
      }

      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid verification code.",
      });
    }),

  /** Start 2FA setup: generate secret and QR code. */
  setupTwoFactor: userProcedure.mutation(async ({ ctx }) => {
    const user = await db.user.findUnique({
      where: { id: ctx.session.userId },
    });

    if (!user) throw new TRPCError({ code: "NOT_FOUND" });

    if (!user.emailVerified) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Email must be verified before enabling 2FA.",
      });
    }

    if (user.twoFactorEnabled) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Two-factor authentication is already enabled.",
      });
    }

    const secret = generateTotpSecret();
    const otpauthUri = generateTotpUri(secret, user.email);
    const qrCodeDataUrl = await generateQrCodeDataUrl(otpauthUri);

    // Store encrypted secret (not enabled yet — enabled on confirm)
    await db.user.update({
      where: { id: user.id },
      data: { twoFactorSecret: encryptTotpSecret(secret) },
    });

    return { secret, qrCodeDataUrl };
  }),

  /** Confirm 2FA setup: verify TOTP code and generate recovery codes. */
  confirmTwoFactor: userProcedure
    .input(z.object({ code: z.string().length(6) }))
    .mutation(async ({ ctx, input }) => {
      const user = await db.user.findUnique({
        where: { id: ctx.session.userId },
      });

      if (!user || !user.twoFactorSecret) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No 2FA setup in progress." });
      }

      if (user.twoFactorEnabled) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "2FA is already enabled." });
      }

      const secret = decryptTotpSecret(user.twoFactorSecret);
      if (!verifyTotpCode(input.code, secret)) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid code. Please try again.",
        });
      }

      const { plain, hashed } = await generateRecoveryCodes();

      await db.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: user.id },
          data: { twoFactorEnabled: true },
        });

        await tx.twoFactorRecoveryCode.createMany({
          data: hashed.map((codeHash) => ({
            userId: user.id,
            codeHash,
          })),
        });
      });

      enqueueTwoFactorEnabledEmail(
        user.id, user.email, user.defaultLocale, user.email
      ).catch(() => {});

      return { recoveryCodes: plain };
    }),

  /** Disable 2FA. Requires valid TOTP code. */
  disableTwoFactor: userProcedure
    .input(z.object({ code: z.string().length(6) }))
    .mutation(async ({ ctx, input }) => {
      const user = await db.user.findUnique({
        where: { id: ctx.session.userId },
      });

      if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "2FA is not enabled." });
      }

      const secret = decryptTotpSecret(user.twoFactorSecret);
      if (!verifyTotpCode(input.code, secret)) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid code.",
        });
      }

      await db.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: user.id },
          data: { twoFactorEnabled: false, twoFactorSecret: null },
        });

        await tx.twoFactorRecoveryCode.deleteMany({
          where: { userId: user.id },
        });
      });

      enqueueTwoFactorDisabledEmail(
        user.id, user.email, user.defaultLocale, user.email
      ).catch(() => {});

      return { success: true };
    }),

  /** Regenerate recovery codes. Requires valid TOTP code. */
  regenerateRecoveryCodes: userProcedure
    .input(z.object({ code: z.string().length(6) }))
    .mutation(async ({ ctx, input }) => {
      const user = await db.user.findUnique({
        where: { id: ctx.session.userId },
      });

      if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "2FA is not enabled." });
      }

      const secret = decryptTotpSecret(user.twoFactorSecret);
      if (!verifyTotpCode(input.code, secret)) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid code." });
      }

      const { plain, hashed } = await generateRecoveryCodes();

      await db.$transaction(async (tx) => {
        await tx.twoFactorRecoveryCode.deleteMany({
          where: { userId: user.id },
        });

        await tx.twoFactorRecoveryCode.createMany({
          data: hashed.map((codeHash) => ({
            userId: user.id,
            codeHash,
          })),
        });
      });

      return { recoveryCodes: plain };
    }),

  /** Get 2FA status. */
  getTwoFactorStatus: userProcedure.query(async ({ ctx }) => {
    const user = await db.user.findUnique({
      where: { id: ctx.session.userId },
      include: {
        twoFactorRecoveryCodes: {
          select: { id: true, usedAt: true },
        },
      },
    });

    if (!user) throw new TRPCError({ code: "NOT_FOUND" });

    return {
      enabled: user.twoFactorEnabled,
      emailVerified: user.emailVerified,
      recoveryCodesRemaining: user.twoFactorRecoveryCodes.filter((c) => !c.usedAt).length,
      recoveryCodesTotal: user.twoFactorRecoveryCodes.length,
    };
  }),

  // ─── OAuth / Linked Accounts ──────────────────────────────────────────────

  /** Get linked OAuth accounts for this user. */
  getLinkedAccounts: userProcedure.query(async ({ ctx }) => {
    const [accounts, user] = await Promise.all([
      db.oAuthAccount.findMany({
        where: { userId: ctx.session.userId },
        select: {
          id: true,
          provider: true,
          email: true,
          displayName: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      }),
      db.user.findUnique({
        where: { id: ctx.session.userId },
        select: { passwordHash: true },
      }),
    ]);

    return {
      accounts,
      hasPassword: user?.passwordHash != null,
    };
  }),

  /** Unlink an OAuth account. Cannot remove last auth method. */
  unlinkOAuthAccount: userProcedure
    .input(z.object({ accountId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const user = await db.user.findUnique({
        where: { id: ctx.session.userId },
        include: { oauthAccounts: { select: { id: true } } },
      });

      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      // Prevent removing last auth method
      const hasPassword = user.passwordHash !== null;
      const oauthCount = user.oauthAccounts.length;

      if (!hasPassword && oauthCount <= 1) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "CANNOT_UNLINK_LAST",
        });
      }

      const accountToUnlink = await db.oAuthAccount.findFirst({
        where: { id: input.accountId, userId: ctx.session.userId },
        select: { provider: true, email: true },
      });

      await db.oAuthAccount.deleteMany({
        where: {
          id: input.accountId,
          userId: ctx.session.userId,
        },
      });

      if (accountToUnlink) {
        const providerName = accountToUnlink.provider === "GOOGLE" ? "Google" : "Microsoft";
        enqueueOAuthUnlinkedEmail(
          user.id, user.email, user.defaultLocale, user.email,
          providerName, accountToUnlink.email
        ).catch(() => {});
      }

      return { success: true };
    }),

  /** Set a password for an OAuth-only account. */
  setPassword: userProcedure
    .input(z.object({
      newPassword: z.string().min(8).max(128),
    }))
    .mutation(async ({ ctx, input }) => {
      const user = await db.user.findUnique({
        where: { id: ctx.session.userId },
      });

      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      if (user.passwordHash !== null) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Account already has a password. Use password reset instead.",
        });
      }

      const passwordHash = await bcrypt.hash(input.newPassword, 10);

      await db.user.update({
        where: { id: ctx.session.userId },
        data: { passwordHash },
      });

      return { success: true };
    }),

  /** Get email notification preferences. */
  getEmailPreferences: userProcedure.query(async ({ ctx }) => {
    return db.emailPreference.findMany({
      where: { userId: ctx.session.userId },
    });
  }),

  /** Update a single email notification preference. */
  updateEmailPreference: userProcedure
    .input(z.object({
      type: z.enum([
        "TWO_FACTOR_ENABLED",
        "TWO_FACTOR_DISABLED",
        "OAUTH_LINKED",
        "OAUTH_UNLINKED",
        "EMAIL_CHANGE_NOTIFICATION",
      ]),
      enabled: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      return db.emailPreference.upsert({
        where: {
          userId_type: {
            userId: ctx.session.userId,
            type: input.type,
          },
        },
        create: {
          userId: ctx.session.userId,
          type: input.type,
          enabled: input.enabled,
        },
        update: {
          enabled: input.enabled,
        },
      });
    }),

  /** Delete the current user account permanently. */
  deleteAccount: userProcedure
    .input(z.object({
      confirmText: z.string(),
      password: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.confirmText !== "DELETE" && input.confirmText !== "LÖSCHEN") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Confirmation text does not match",
        });
      }

      // Verify identity: require password if account has one
      const user = await db.user.findUnique({
        where: { id: ctx.session.userId },
        select: { passwordHash: true },
      });

      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      if (user.passwordHash) {
        if (!input.password) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "PASSWORD_REQUIRED",
          });
        }
        const valid = await bcrypt.compare(input.password, user.passwordHash);
        if (!valid) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "INVALID_PASSWORD",
          });
        }
      }

      // Check if user is the sole admin of any family
      const adminMemberships = await db.familyMember.findMany({
        where: {
          userId: ctx.session.userId,
          role: "ADMIN",
        },
        select: {
          familyId: true,
          family: { select: { name: true } },
        },
      });

      for (const membership of adminMemberships) {
        const otherAdmins = await db.familyMember.count({
          where: {
            familyId: membership.familyId,
            role: "ADMIN",
            userId: { not: ctx.session.userId },
          },
        });

        if (otherAdmins === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "SOLE_ADMIN",
          });
        }
      }

      // Delete user (cascades handle related records)
      await db.user.delete({
        where: { id: ctx.session.userId },
      });

      // Clear the session
      await clearSession();

      return { deleted: true };
    }),
});
