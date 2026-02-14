import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { unsealData } from "iron-session";

const PUBLIC_PATHS = ["/login", "/register", "/setup", "/hub", "/api", "/_next", "/favicon.ico", "/manifest.json", "/sw.js", "/offline", "/icons"];
const ACCOUNT_PATHS = ["/profiles"];

interface UnsealedSession {
  familyId?: string;
  memberId?: string;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Parse session cookie
  const sessionCookie = request.cookies.get("family-hub-session")?.value;
  let session: UnsealedSession | null = null;

  if (sessionCookie) {
    try {
      const unsealed = await unsealData(sessionCookie, {
        password: process.env.SESSION_SECRET!,
      });
      if (unsealed && typeof unsealed === "object" && "familyId" in unsealed) {
        session = unsealed as UnsealedSession;
      }
    } catch {
      // Invalid cookie
    }
  }

  // Account-only paths (e.g. /profiles): require account session
  if (ACCOUNT_PATHS.some((path) => pathname.startsWith(path))) {
    if (!session?.familyId) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    // If already fully authenticated, redirect to dashboard
    if (session.memberId) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  // Protected paths: require full session (account + profile)
  if (!session?.familyId) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (!session.memberId) {
    // Has account session but no profile → go to profile selection
    return NextResponse.redirect(new URL("/profiles", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icons/).*)"],
};
