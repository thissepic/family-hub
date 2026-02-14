import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { cookies } from "next/headers";
import { router, publicProcedure, accountProcedure } from "../init";
import { db } from "@/lib/db";
import { upgradeSession, clearSession, downgradeSession } from "@/lib/auth";
import { checkPinRateLimit, resetPinRateLimit } from "@/lib/rate-limit";
import bcrypt from "bcryptjs";

export const authRouter = router({
  /** Select a profile and verify PIN (Layer 2). Requires account session. */
  selectProfile: accountProcedure
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

      // Verify PIN if the member has one set
      if (member.pinHash) {
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

      // Upgrade account session to full session
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

  /** Switch profile: downgrade to account-level session (back to profile selection). */
  switchProfile: accountProcedure.mutation(async () => {
    await downgradeSession();
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

  /** Check if a family has been set up. */
  hasFamily: publicProcedure.query(async () => {
    const count = await db.family.count();
    return count > 0;
  }),
});
