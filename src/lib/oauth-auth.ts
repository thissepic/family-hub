import { db } from "@/lib/db";
import { setAccountSession, getRequestMeta } from "@/lib/auth";
import { sealData } from "iron-session";
import { cookies } from "next/headers";
import type { Family, OAuthProvider } from "@prisma/client";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OAuthUserInfo {
  provider: OAuthProvider;
  providerAccountId: string;
  email: string;
  emailVerified: boolean;
  displayName: string | null;
}

export interface OAuthStateData {
  nonce: string;
  familyId?: string; // present when linking from settings
}

type ProcessResult =
  | { action: "login"; familyId: string }
  | { action: "link_and_login"; familyId: string }
  | { action: "register" };

// ─── Core Processing ──────────────────────────────────────────────────────────

/**
 * Process an OAuth callback and determine the appropriate action.
 * Handles three scenarios: login, link+login, or new registration.
 */
export async function processOAuthCallback(
  userInfo: OAuthUserInfo,
  linkToFamilyId?: string
): Promise<ProcessResult> {
  // If linking from settings (user already logged in)
  if (linkToFamilyId) {
    await db.oAuthAccount.create({
      data: {
        familyId: linkToFamilyId,
        provider: userInfo.provider,
        providerAccountId: userInfo.providerAccountId,
        email: userInfo.email,
        displayName: userInfo.displayName,
      },
    });
    return { action: "login", familyId: linkToFamilyId };
  }

  // 1. Check if this OAuth identity is already linked
  const existingOAuth = await db.oAuthAccount.findUnique({
    where: {
      provider_providerAccountId: {
        provider: userInfo.provider,
        providerAccountId: userInfo.providerAccountId,
      },
    },
  });

  if (existingOAuth) {
    return { action: "login", familyId: existingOAuth.familyId };
  }

  // 2. Check if a Family with this email exists (account linking)
  if (userInfo.email && userInfo.emailVerified) {
    const existingFamily = await db.family.findUnique({
      where: { email: userInfo.email.toLowerCase() },
    });

    if (existingFamily) {
      // Auto-link: same verified email
      await db.oAuthAccount.create({
        data: {
          familyId: existingFamily.id,
          provider: userInfo.provider,
          providerAccountId: userInfo.providerAccountId,
          email: userInfo.email,
          displayName: userInfo.displayName,
        },
      });

      // Auto-verify email if not already
      if (!existingFamily.emailVerified) {
        await db.family.update({
          where: { id: existingFamily.id },
          data: { emailVerified: true },
        });
      }

      return { action: "link_and_login", familyId: existingFamily.id };
    }
  }

  // 3. New user → needs registration
  return { action: "register" };
}

// ─── Session Helpers ──────────────────────────────────────────────────────────

/**
 * Create an account session after OAuth login and record the login attempt.
 */
export async function handleOAuthLogin(familyId: string, email: string): Promise<void> {
  await setAccountSession(familyId, false);

  const { ipAddress, userAgent } = await getRequestMeta();
  await db.loginAttempt.create({
    data: {
      familyId,
      email,
      ipAddress,
      userAgent,
      success: true,
    },
  });
}

/**
 * Store OAuth user info in a sealed cookie for the registration wizard to consume.
 */
export async function storeOAuthPending(userInfo: OAuthUserInfo): Promise<void> {
  const sealed = await sealData(userInfo, {
    password: process.env.SESSION_SECRET!,
    ttl: 600, // 10 minutes
  });

  const cookieStore = await cookies();
  cookieStore.set("oauth-pending", sealed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
}

/**
 * Consume the OAuth pending cookie and return the user info.
 */
export async function consumeOAuthPending(): Promise<OAuthUserInfo | null> {
  const { unsealData } = await import("iron-session");
  const cookieStore = await cookies();
  const cookie = cookieStore.get("oauth-pending");

  if (!cookie?.value) return null;

  try {
    const data = await unsealData<OAuthUserInfo>(cookie.value, {
      password: process.env.SESSION_SECRET!,
      ttl: 600,
    });

    cookieStore.delete("oauth-pending");
    return data;
  } catch {
    cookieStore.delete("oauth-pending");
    return null;
  }
}
