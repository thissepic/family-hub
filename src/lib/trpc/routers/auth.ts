import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { cookies } from "next/headers";
import { router, publicProcedure, userProcedure, familyProcedure } from "../init";
import { db } from "@/lib/db";
import {
  selectFamily,
  upgradeSession,
  clearSession,
  downgradeToFamily,
  downgradeToUser,
} from "@/lib/auth";
import { checkPinRateLimit, resetPinRateLimit } from "@/lib/rate-limit";
import bcrypt from "bcryptjs";

export const authRouter = router({
  /**
   * Select a family after login (Layer 2).
   * Auto-resolves the member if the user is linked to a FamilyMember in that family.
   * Returns { autoResolved: true, memberId, role } or { autoResolved: false }.
   */
  selectFamily: userProcedure
    .input(z.object({ familyId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify the user has a linked member in this family
      const membership = await db.familyMember.findUnique({
        where: { familyId_userId: { familyId: input.familyId, userId: ctx.session.userId } },
      });

      if (!membership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not a member of this family",
        });
      }

      const result = await selectFamily(input.familyId);

      if (result) {
        // Set locale cookie
        const member = await db.familyMember.findUnique({
          where: { id: result.memberId },
          include: { family: { select: { defaultLocale: true } } },
        });
        if (member) {
          const cookieStore = await cookies();
          const locale = member.locale || member.family.defaultLocale;
          cookieStore.set("locale", locale, {
            path: "/",
            maxAge: 60 * 60 * 24 * 365,
            sameSite: "lax",
          });
        }

        return { autoResolved: true as const, memberId: result.memberId, role: result.role };
      }

      return { autoResolved: false as const };
    }),

  /**
   * Select a profile and verify PIN (Layer 3).
   * Used when auto-resolve didn't work (user not linked to a member in this family).
   * Requires family-level session.
   */
  selectProfile: familyProcedure
    .input(z.object({
      memberId: z.string(),
      pin: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const member = await db.familyMember.findUnique({
        where: { id: input.memberId },
        include: { family: { select: { defaultLocale: true } } },
      });

      if (!member || member.familyId !== ctx.session.familyId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Member not found" });
      }

      // If the member is linked to this user, no PIN needed
      const isOwnProfile = member.userId === ctx.session.userId;

      // Verify PIN if the member has one set and it's not the user's own linked profile
      if (member.pinHash && !isOwnProfile) {
        if (!input.pin) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "PIN required" });
        }

        // Rate limit PIN attempts per member
        const pinRateLimitKey = `${ctx.session.familyId}:${input.memberId}`;
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

        // Reset rate limit on success
        await resetPinRateLimit(pinRateLimitKey);
      }

      // Upgrade family session to full session
      await upgradeSession(member.id, member.role);

      // Set locale cookie
      const cookieStore = await cookies();
      const locale = member.locale || member.family.defaultLocale;
      cookieStore.set("locale", locale, {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
        sameSite: "lax",
      });

      return { success: true };
    }),

  /** Switch profile: downgrade to family-level session (back to profile selection). */
  switchProfile: familyProcedure.mutation(async () => {
    await downgradeToFamily();
    return { success: true };
  }),

  /** Switch family: downgrade to user-level session (back to family selection). */
  switchFamily: userProcedure.mutation(async () => {
    await downgradeToUser();
    return { success: true };
  }),

  /** Log out completely (clear session). */
  logout: publicProcedure.mutation(async () => {
    await clearSession();
    return { success: true };
  }),

  /** Get the current session state. */
  getSession: publicProcedure.query(async ({ ctx }) => {
    return ctx.session;
  }),

  /** Check if any user has been set up. */
  hasFamily: publicProcedure.query(async () => {
    const count = await db.user.count();
    return count > 0;
  }),
});
