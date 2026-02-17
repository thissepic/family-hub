import { NextRequest, NextResponse } from "next/server";
import { getSession, getFullSession, type SessionData, type FullSessionData } from "@/lib/auth";

/**
 * Wraps an API route handler with full session authentication (account + profile).
 * Returns 401 if the user is not fully authenticated.
 *
 * Usage:
 *   export const POST = withAuth(async (request, session) => {
 *     // session is guaranteed to have familyId + memberId
 *     return NextResponse.json({ ok: true });
 *   });
 */
export function withAuth(
  handler: (request: NextRequest, session: FullSessionData) => Promise<NextResponse>
) {
  return async (request: NextRequest, _routeContext?: unknown) => {
    const session = await getFullSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return handler(request, session);
  };
}

/**
 * Wraps an API route handler with account-level authentication.
 * Returns 401 if the user has no account session (familyId).
 *
 * Usage:
 *   export const POST = withAccountAuth(async (request, session) => {
 *     // session is guaranteed to have familyId
 *     return NextResponse.json({ ok: true });
 *   });
 */
export function withAccountAuth(
  handler: (request: NextRequest, session: SessionData) => Promise<NextResponse>
) {
  return async (request: NextRequest, _routeContext?: unknown) => {
    const session = await getSession();
    if (!session?.familyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return handler(request, session);
  };
}
