import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { getSession, type SessionData, type FamilySessionData, type FullSessionData, isFullSession, isFamilySession } from "@/lib/auth";
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

/** Rate-limits authenticated API requests per user. */
const rateLimitMiddleware = t.middleware(async ({ ctx, next }) => {
  const key = ctx.session?.familyId || ctx.session?.userId;
  if (key) {
    try {
      await checkApiRateLimit(key);
    } catch {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Rate limit exceeded. Please try again later.",
      });
    }
  }
  return next();
});

/** Requires user-level authentication (login completed). */
export const userProcedure = t.procedure.use(rateLimitMiddleware).use(async ({ ctx, next }) => {
  if (!ctx.session?.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: { session: ctx.session as SessionData & { userId: string } },
  });
});

/** @deprecated Use userProcedure instead. Kept for backward compatibility during migration. */
export const accountProcedure = userProcedure;

/** Requires user + family selected. */
export const familyProcedure = t.procedure.use(rateLimitMiddleware).use(async ({ ctx, next }) => {
  if (!ctx.session?.userId || !isFamilySession(ctx.session)) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: { session: ctx.session as FamilySessionData },
  });
});

/** Requires full authentication (user + family + member selected). */
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
