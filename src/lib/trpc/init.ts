import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { getSession, type SessionData, type FullSessionData, isFullSession } from "@/lib/auth";
import { checkApiRateLimit } from "@/lib/rate-limit";

export type TRPCContext = {
  session: SessionData | null;
};

export async function createTRPCContext(): Promise<TRPCContext> {
  const session = await getSession();
  return { session };
}

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

/** Rate-limits authenticated API requests per family. */
const rateLimitMiddleware = t.middleware(async ({ ctx, next }) => {
  if (ctx.session?.familyId) {
    try {
      await checkApiRateLimit(ctx.session.familyId);
    } catch {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Rate limit exceeded. Please try again later.",
      });
    }
  }
  return next();
});

/** Requires account-level authentication (email/password login completed). */
export const accountProcedure = t.procedure.use(rateLimitMiddleware).use(async ({ ctx, next }) => {
  if (!ctx.session?.familyId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: { session: ctx.session as SessionData },
  });
});

/** Requires full authentication (account + profile selected). */
export const protectedProcedure = t.procedure.use(rateLimitMiddleware).use(async ({ ctx, next }) => {
  if (!ctx.session || !isFullSession(ctx.session)) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: { session: ctx.session as FullSessionData },
  });
});

/** Requires full authentication + ADMIN role. */
export const adminProcedure = t.procedure.use(rateLimitMiddleware).use(async ({ ctx, next }) => {
  if (!ctx.session || !isFullSession(ctx.session) || ctx.session.role !== "ADMIN") {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return next({
    ctx: { session: ctx.session as FullSessionData },
  });
});
