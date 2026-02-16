import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure, adminProcedure } from "../init";
import { db } from "@/lib/db";
import { clearSession, setAccountSession, getRequestMeta } from "@/lib/auth";
import { checkRegistrationRateLimit } from "@/lib/rate-limit";
import { createEmailToken } from "@/lib/email/tokens";
import { enqueueVerificationEmail } from "@/lib/email/queue";
import { consumeOAuthPending } from "@/lib/oauth-auth";
import type { OAuthProvider } from "@prisma/client";
import bcrypt from "bcryptjs";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const familyRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
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
            createdAt: true,
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });
  }),

  register: publicProcedure
    .input(z.object({
      email: z.string().email(),
      password: z.string().min(8).max(128),
      familyName: z.string().min(1).max(100),
      defaultLocale: z.enum(["en", "de"]).default("en"),
      adminName: z.string().min(1).max(50),
      adminPin: z.string().min(4).max(8).regex(/^\d+$/),
      adminColor: z.string().default("#3b82f6"),
    }))
    .mutation(async ({ input }) => {
      const { ipAddress } = await getRequestMeta();
      await checkRegistrationRateLimit(ipAddress);

      const email = input.email.toLowerCase();

      // Check email uniqueness before transaction
      const existingFamily = await db.family.findUnique({
        where: { email },
      });
      if (existingFamily) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "EMAIL_TAKEN",
        });
      }

      const [passwordHash, pinHash] = await Promise.all([
        bcrypt.hash(input.password, 10),
        bcrypt.hash(input.adminPin, 10),
      ]);

      const result = await db.$transaction(async (tx) => {
        const family = await tx.family.create({
          data: {
            name: input.familyName,
            email,
            passwordHash,
            defaultLocale: input.defaultLocale,
            theme: "AUTO",
          },
        });

        const admin = await tx.familyMember.create({
          data: {
            familyId: family.id,
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

      await setAccountSession(result.familyId, false);

      // Send verification email
      try {
        const rawToken = await createEmailToken(result.familyId, "VERIFICATION");
        const verifyUrl = `${APP_URL}/verify-email?token=${rawToken}`;
        await enqueueVerificationEmail(email, input.defaultLocale, input.familyName, verifyUrl);
      } catch (err) {
        // Don't fail registration if email sending fails
        console.warn("[Registration] Failed to enqueue verification email:", err);
      }

      return {
        success: true as const,
        familyId: result.familyId,
        adminMemberId: result.adminMemberId,
      };
    }),

  /** Register a new family via OAuth (no password needed). */
  registerWithOAuth: publicProcedure
    .input(z.object({
      familyName: z.string().min(1).max(100),
      defaultLocale: z.enum(["en", "de"]).default("en"),
      adminName: z.string().min(1).max(50),
      adminPin: z.string().min(4).max(8).regex(/^\d+$/),
      adminColor: z.string().default("#3b82f6"),
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
      const existingFamily = await db.family.findUnique({
        where: { email },
      });
      if (existingFamily) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "EMAIL_TAKEN",
        });
      }

      const pinHash = await bcrypt.hash(input.adminPin, 10);

      const result = await db.$transaction(async (tx) => {
        const family = await tx.family.create({
          data: {
            name: input.familyName,
            email,
            passwordHash: null,
            emailVerified: oauthData.emailVerified,
            defaultLocale: input.defaultLocale,
            theme: "AUTO",
          },
        });

        const admin = await tx.familyMember.create({
          data: {
            familyId: family.id,
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

        await tx.oAuthAccount.create({
          data: {
            familyId: family.id,
            provider: oauthData.provider as OAuthProvider,
            providerAccountId: oauthData.providerAccountId,
            email,
            displayName: oauthData.displayName,
          },
        });

        return { familyId: family.id, adminMemberId: admin.id };
      });

      await setAccountSession(result.familyId, false);

      return {
        success: true as const,
        familyId: result.familyId,
        adminMemberId: result.adminMemberId,
      };
    }),

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

      await clearSession();

      return { deleted: true };
    }),
});
