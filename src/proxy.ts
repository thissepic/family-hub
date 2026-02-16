import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { unsealData } from "iron-session";

const PUBLIC_PATHS = ["/setup", "/hub", "/api", "/_next", "/favicon.ico", "/manifest.json", "/sw.js", "/offline", "/icons"];
const AUTH_PATHS = ["/login", "/register"];
const TOKEN_PATHS = ["/verify-email", "/reset-password", "/forgot-password", "/verify-2fa"];
const ACCOUNT_PATHS = ["/profiles"];

interface UnsealedSession {
  familyId?: string;
  memberId?: string;
}

function redirectUrl(path: string, request: NextRequest): URL {
  const base = process.env.NEXT_PUBLIC_APP_URL || request.url;
  return new URL(path, base);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths (static assets, API, etc.)
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

  // Token-based paths (verify-email, reset-password, forgot-password): always accessible
  if (TOKEN_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Auth paths (login/register): redirect logged-in users away
  if (AUTH_PATHS.some((path) => pathname.startsWith(path))) {
    if (session?.memberId) {
      return NextResponse.redirect(redirectUrl("/", request));
    }
    if (session?.familyId) {
      return NextResponse.redirect(redirectUrl("/profiles", request));
    }
    return NextResponse.next();
  }

  // Account-only paths (e.g. /profiles): require account session
  if (ACCOUNT_PATHS.some((path) => pathname.startsWith(path))) {
    if (!session?.familyId) {
      return NextResponse.redirect(redirectUrl("/login", request));
    }
    // If already fully authenticated, redirect to dashboard
    if (session.memberId) {
      return NextResponse.redirect(redirectUrl("/", request));
    }
    return NextResponse.next();
  }

  // Protected paths: require full session (account + profile)
  if (!session?.familyId) {
    return NextResponse.redirect(redirectUrl("/login", request));
  }

  if (!session.memberId) {
    // Has account session but no profile → go to profile selection
    return NextResponse.redirect(redirectUrl("/profiles", request));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icons/).*)"],
};
