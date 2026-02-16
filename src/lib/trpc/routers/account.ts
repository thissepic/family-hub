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

      // OAuth-only account: no password set
      if (family.passwordHash === null) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "OAUTH_ONLY_ACCOUNT",
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

      // Success - reset rate limits
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

      // Check if 2FA is enabled
      if (family.twoFactorEnabled && family.twoFactorSecret) {
        const pendingToken = await createPendingToken({
          familyId: family.id,
          rememberMe: input.rememberMe,
        });
        return {
          success: true as const,
          familyName: family.name,
          requiresTwoFactor: true as const,
          twoFactorToken: pendingToken,
        };
      }

      await setAccountSession(family.id, input.rememberMe);

      return { success: true as const, familyName: family.name };
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

    let rawToken: string;
    try {
      rawToken = await createEmailToken(family.id, "VERIFICATION");
    } catch (err) {
      console.error("[resendVerification] Failed to create email token:", err);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create verification token.",
      });
    }

    const verifyUrl = `${APP_URL}/verify-email?token=${rawToken}`;

    try {
      await enqueueVerificationEmail(family.email, family.defaultLocale, family.name, verifyUrl);
    } catch (err) {
      console.error("[resendVerification] Failed to enqueue verification email:", err);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to send verification email. Please try again later.",
      });
    }

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

      // Verify password (OAuth-only accounts have no password)
      if (!family.passwordHash) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "OAUTH_ONLY_ACCOUNT",
        });
      }
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
      await enqueueEmailChangeNotification(ctx.session.familyId, oldEmail, newEmail, family.name, family.defaultLocale);

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

      const family = await db.family.findUnique({
        where: { id: pending.familyId },
        include: { twoFactorRecoveryCodes: true },
      });

      if (!family || !family.twoFactorSecret) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      }

      const secret = decryptTotpSecret(family.twoFactorSecret);
      const code = input.code.replace(/[-\s]/g, "");

      // Try TOTP first
      if (code.length === 6 && verifyTotpCode(code, secret)) {
        await resetTotpRateLimit(ipAddress);
        await setAccountSession(pending.familyId, pending.rememberMe);
        return { success: true, usedRecoveryCode: false };
      }

      // Try recovery code
      const matchedCodeId = await matchRecoveryCode(
        input.code,
        family.twoFactorRecoveryCodes
      );

      if (matchedCodeId) {
        await db.twoFactorRecoveryCode.update({
          where: { id: matchedCodeId },
          data: { usedAt: new Date() },
        });
        await resetTotpRateLimit(ipAddress);
        await setAccountSession(pending.familyId, pending.rememberMe);

        const remaining = family.twoFactorRecoveryCodes.filter(
          (c) => !c.usedAt && c.id !== matchedCodeId
        ).length;

        return { success: true, usedRecoveryCode: true, remainingCodes: remaining };
      }

      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid verification code.",
      });
    }),

  /** Start 2FA setup: generate secret and QR code (admin only). */
  setupTwoFactor: adminProcedure.mutation(async ({ ctx }) => {
    const family = await db.family.findUnique({
      where: { id: ctx.session.familyId },
    });

    if (!family) throw new TRPCError({ code: "NOT_FOUND" });

    if (!family.emailVerified) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Email must be verified before enabling 2FA.",
      });
    }

    if (family.twoFactorEnabled) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Two-factor authentication is already enabled.",
      });
    }

    const secret = generateTotpSecret();
    const otpauthUri = generateTotpUri(secret, family.email);
    const qrCodeDataUrl = await generateQrCodeDataUrl(otpauthUri);

    // Store encrypted secret (not enabled yet — enabled on confirm)
    await db.family.update({
      where: { id: family.id },
      data: { twoFactorSecret: encryptTotpSecret(secret) },
    });

    return { secret, qrCodeDataUrl };
  }),

  /** Confirm 2FA setup: verify TOTP code and generate recovery codes (admin only). */
  confirmTwoFactor: adminProcedure
    .input(z.object({ code: z.string().length(6) }))
    .mutation(async ({ ctx, input }) => {
      const family = await db.family.findUnique({
        where: { id: ctx.session.familyId },
      });

      if (!family || !family.twoFactorSecret) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No 2FA setup in progress." });
      }

      if (family.twoFactorEnabled) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "2FA is already enabled." });
      }

      const secret = decryptTotpSecret(family.twoFactorSecret);
      if (!verifyTotpCode(input.code, secret)) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid code. Please try again.",
        });
      }

      const { plain, hashed } = await generateRecoveryCodes();

      await db.$transaction(async (tx) => {
        await tx.family.update({
          where: { id: family.id },
          data: { twoFactorEnabled: true },
        });

        await tx.twoFactorRecoveryCode.createMany({
          data: hashed.map((codeHash) => ({
            familyId: family.id,
            codeHash,
          })),
        });
      });

      enqueueTwoFactorEnabledEmail(
        family.id, family.email, family.defaultLocale, family.name
      ).catch(() => {});

      return { recoveryCodes: plain };
    }),

  /** Disable 2FA (admin only). Requires valid TOTP code. */
  disableTwoFactor: adminProcedure
    .input(z.object({ code: z.string().length(6) }))
    .mutation(async ({ ctx, input }) => {
      const family = await db.family.findUnique({
        where: { id: ctx.session.familyId },
      });

      if (!family || !family.twoFactorEnabled || !family.twoFactorSecret) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "2FA is not enabled." });
      }

      const secret = decryptTotpSecret(family.twoFactorSecret);
      if (!verifyTotpCode(input.code, secret)) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid code.",
        });
      }

      await db.$transaction(async (tx) => {
        await tx.family.update({
          where: { id: family.id },
          data: { twoFactorEnabled: false, twoFactorSecret: null },
        });

        await tx.twoFactorRecoveryCode.deleteMany({
          where: { familyId: family.id },
        });
      });

      enqueueTwoFactorDisabledEmail(
        family.id, family.email, family.defaultLocale, family.name
      ).catch(() => {});

      return { success: true };
    }),

  /** Regenerate recovery codes (admin only). Requires valid TOTP code. */
  regenerateRecoveryCodes: adminProcedure
    .input(z.object({ code: z.string().length(6) }))
    .mutation(async ({ ctx, input }) => {
      const family = await db.family.findUnique({
        where: { id: ctx.session.familyId },
      });

      if (!family || !family.twoFactorEnabled || !family.twoFactorSecret) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "2FA is not enabled." });
      }

      const secret = decryptTotpSecret(family.twoFactorSecret);
      if (!verifyTotpCode(input.code, secret)) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid code." });
      }

      const { plain, hashed } = await generateRecoveryCodes();

      await db.$transaction(async (tx) => {
        await tx.twoFactorRecoveryCode.deleteMany({
          where: { familyId: family.id },
        });

        await tx.twoFactorRecoveryCode.createMany({
          data: hashed.map((codeHash) => ({
            familyId: family.id,
            codeHash,
          })),
        });
      });

      return { recoveryCodes: plain };
    }),

  /** Get 2FA status (admin only). */
  getTwoFactorStatus: adminProcedure.query(async ({ ctx }) => {
    const family = await db.family.findUnique({
      where: { id: ctx.session.familyId },
      include: {
        twoFactorRecoveryCodes: {
          select: { id: true, usedAt: true },
        },
      },
    });

    if (!family) throw new TRPCError({ code: "NOT_FOUND" });

    return {
      enabled: family.twoFactorEnabled,
      emailVerified: family.emailVerified,
      recoveryCodesRemaining: family.twoFactorRecoveryCodes.filter((c) => !c.usedAt).length,
      recoveryCodesTotal: family.twoFactorRecoveryCodes.length,
    };
  }),

  // ─── OAuth / Linked Accounts ──────────────────────────────────────────────

  /** Get linked OAuth accounts for this family (admin only). */
  getLinkedAccounts: adminProcedure.query(async ({ ctx }) => {
    const [accounts, family] = await Promise.all([
      db.oAuthAccount.findMany({
        where: { familyId: ctx.session.familyId },
        select: {
          id: true,
          provider: true,
          email: true,
          displayName: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      }),
      db.family.findUnique({
        where: { id: ctx.session.familyId },
        select: { passwordHash: true },
      }),
    ]);

    return {
      accounts,
      hasPassword: family?.passwordHash != null,
    };
  }),

  /** Unlink an OAuth account (admin only). Cannot remove last auth method. */
  unlinkOAuthAccount: adminProcedure
    .input(z.object({ accountId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const family = await db.family.findUnique({
        where: { id: ctx.session.familyId },
        include: { oauthAccounts: { select: { id: true } } },
      });

      if (!family) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      // Prevent removing last auth method
      const hasPassword = family.passwordHash !== null;
      const oauthCount = family.oauthAccounts.length;

      if (!hasPassword && oauthCount <= 1) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "CANNOT_UNLINK_LAST",
        });
      }

      const accountToUnlink = await db.oAuthAccount.findFirst({
        where: { id: input.accountId, familyId: ctx.session.familyId },
        select: { provider: true, email: true },
      });

      await db.oAuthAccount.deleteMany({
        where: {
          id: input.accountId,
          familyId: ctx.session.familyId,
        },
      });

      if (accountToUnlink) {
        const providerName = accountToUnlink.provider === "GOOGLE" ? "Google" : "Microsoft";
        enqueueOAuthUnlinkedEmail(
          family.id, family.email, family.defaultLocale, family.name,
          providerName, accountToUnlink.email
        ).catch(() => {});
      }

      return { success: true };
    }),

  /** Set a password for an OAuth-only account (admin only). */
  setPassword: adminProcedure
    .input(z.object({
      newPassword: z.string().min(8).max(128),
    }))
    .mutation(async ({ ctx, input }) => {
      const family = await db.family.findUnique({
        where: { id: ctx.session.familyId },
      });

      if (!family) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      if (family.passwordHash !== null) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Account already has a password. Use password reset instead.",
        });
      }

      const passwordHash = await bcrypt.hash(input.newPassword, 10);

      await db.family.update({
        where: { id: ctx.session.familyId },
        data: { passwordHash },
      });

      return { success: true };
    }),

  /** Get email notification preferences (admin only). */
  getEmailPreferences: adminProcedure.query(async ({ ctx }) => {
    return db.emailPreference.findMany({
      where: { familyId: ctx.session.familyId },
    });
  }),

  /** Update a single email notification preference (admin only). */
  updateEmailPreference: adminProcedure
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
          familyId_type: {
            familyId: ctx.session.familyId,
            type: input.type,
          },
        },
        create: {
          familyId: ctx.session.familyId,
          type: input.type,
          enabled: input.enabled,
        },
        update: {
          enabled: input.enabled,
        },
      });
    }),
});
