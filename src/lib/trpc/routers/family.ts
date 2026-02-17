import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, userProcedure, familyProcedure, adminProcedure } from "../init";
import { db } from "@/lib/db";
import { clearSession, setUserSession, downgradeToUser, getRequestMeta } from "@/lib/auth";
import { checkRegistrationRateLimit } from "@/lib/rate-limit";
import { createEmailToken } from "@/lib/email/tokens";
import { enqueueVerificationEmail } from "@/lib/email/queue";
import { consumeOAuthPending } from "@/lib/oauth-auth";
import type { OAuthProvider } from "@prisma/client";
import bcrypt from "bcryptjs";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const familyRouter = router({
  /** Get current family details with members. Requires family-level session. */
  get: familyProcedure.query(async ({ ctx }) => {
    return db.family.findUnique({
      where: { id: ctx.session.familyId },
      include: {
        members: {
          select: {
            id: true,
            name: true,
            avatar: true,
            color: true,
            role: true,
            locale: true,
            userId: true,
            createdAt: true,
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });
  }),

  /** Register a new user account (email + password). No family created yet. */
  registerUser: publicProcedure
    .input(z.object({
      email: z.string().email(),
      password: z.string().min(8).max(128),
      defaultLocale: z.enum(["en", "de"]).default("en"),
    }))
    .mutation(async ({ input }) => {
      const { ipAddress } = await getRequestMeta();
      await checkRegistrationRateLimit(ipAddress);

      const email = input.email.toLowerCase();

      // Check email uniqueness
      const existingUser = await db.user.findUnique({
        where: { email },
      });
      if (existingUser) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "EMAIL_TAKEN",
        });
      }

      const passwordHash = await bcrypt.hash(input.password, 10);

      const user = await db.user.create({
        data: {
          email,
          passwordHash,
          defaultLocale: input.defaultLocale,
        },
      });

      await setUserSession(user.id, false);

      // Send verification email
      try {
        const rawToken = await createEmailToken(user.id, "VERIFICATION");
        const verifyUrl = `${APP_URL}/verify-email?token=${rawToken}`;
        await enqueueVerificationEmail(email, input.defaultLocale, email, verifyUrl);
      } catch (err) {
        console.warn("[Registration] Failed to enqueue verification email:", err);
      }

      return {
        success: true as const,
        userId: user.id,
      };
    }),

  /** Register a new user account via OAuth (no password needed). */
  registerUserWithOAuth: publicProcedure
    .input(z.object({
      defaultLocale: z.enum(["en", "de"]).default("en"),
    }))
    .mutation(async ({ input }) => {
      const { ipAddress } = await getRequestMeta();
      await checkRegistrationRateLimit(ipAddress);

      // Consume the OAuth pending cookie
      const oauthData = await consumeOAuthPending();
      if (!oauthData) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No OAuth session found. Please try signing in again.",
        });
      }

      const email = oauthData.email.toLowerCase();

      // Check email uniqueness
      const existingUser = await db.user.findUnique({
        where: { email },
      });
      if (existingUser) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "EMAIL_TAKEN",
        });
      }

      const user = await db.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            email,
            emailVerified: oauthData.emailVerified,
            defaultLocale: input.defaultLocale,
          },
        });

        await tx.oAuthAccount.create({
          data: {
            userId: newUser.id,
            provider: oauthData.provider as OAuthProvider,
            providerAccountId: oauthData.providerAccountId,
            email,
            displayName: oauthData.displayName,
          },
        });

        return newUser;
      });

      await setUserSession(user.id, false);

      return {
        success: true as const,
        userId: user.id,
      };
    }),

  /** Create a new family (requires logged-in user). */
  createFamily: userProcedure
    .input(z.object({
      familyName: z.string().min(1).max(100),
      defaultLocale: z.enum(["en", "de"]).default("en"),
      adminName: z.string().min(1).max(50),
      adminPin: z.string().min(4).max(8).regex(/^\d+$/).optional(),
      adminColor: z.string().default("#3b82f6"),
    }))
    .mutation(async ({ ctx, input }) => {
      const pinHash = input.adminPin
        ? await bcrypt.hash(input.adminPin, 10)
        : null;

      const result = await db.$transaction(async (tx) => {
        const family = await tx.family.create({
          data: {
            name: input.familyName,
            defaultLocale: input.defaultLocale,
            theme: "AUTO",
          },
        });

        const admin = await tx.familyMember.create({
          data: {
            familyId: family.id,
            userId: ctx.session.userId,
            name: input.adminName,
            color: input.adminColor,
            pinHash,
            role: "ADMIN",
            locale: input.defaultLocale,
          },
        });

        await tx.memberXpProfile.create({
          data: { memberId: admin.id },
        });

        return { familyId: family.id, adminMemberId: admin.id };
      });

      return {
        success: true as const,
        familyId: result.familyId,
        adminMemberId: result.adminMemberId,
      };
    }),

  /** List all families the current user belongs to. */
  listFamilies: userProcedure.query(async ({ ctx }) => {
    const memberships = await db.familyMember.findMany({
      where: { userId: ctx.session.userId },
      include: {
        family: {
          select: {
            id: true,
            name: true,
            defaultLocale: true,
            theme: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return memberships.map((m) => ({
      familyId: m.family.id,
      familyName: m.family.name,
      defaultLocale: m.family.defaultLocale,
      theme: m.family.theme,
      memberName: m.name,
      memberRole: m.role,
      memberColor: m.color,
      memberAvatar: m.avatar,
    }));
  }),

  /** Update family settings. */
  update: adminProcedure
    .input(z.object({
      name: z.string().min(1).max(100).optional(),
      defaultLocale: z.enum(["en", "de"]).optional(),
      theme: z.enum(["LIGHT", "DARK", "AUTO"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return db.family.update({
        where: { id: ctx.session.familyId },
        data: input,
      });
    }),

  /** Delete a family permanently. */
  deleteFamily: adminProcedure
    .input(z.object({
      confirmName: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const family = await db.family.findUnique({
        where: { id: ctx.session.familyId },
      });

      if (!family) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Family not found" });
      }

      if (input.confirmName !== family.name) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Family name does not match",
        });
      }

      await db.family.delete({
        where: { id: ctx.session.familyId },
      });

      // Downgrade to user-level session (not full logout)
      await downgradeToUser();

      return { deleted: true };
    }),
});
