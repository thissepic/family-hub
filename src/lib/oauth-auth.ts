import { db } from "@/lib/db";
import { setUserSession, getRequestMeta } from "@/lib/auth";
import { sealData } from "iron-session";
import { cookies } from "next/headers";
import type { OAuthProvider } from "@prisma/client";
import { enqueueOAuthLinkedEmail } from "@/lib/email/queue";

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
  userId?: string; // present when linking from account settings
}

type ProcessResult =
  | { action: "login"; userId: string }
  | { action: "link_and_login"; userId: string }
  | { action: "register" };

// ─── Core Processing ──────────────────────────────────────────────────────────

/**
 * Process an OAuth callback and determine the appropriate action.
 * Handles three scenarios: login, link+login, or new registration.
 */
export async function processOAuthCallback(
  userInfo: OAuthUserInfo,
  linkToUserId?: string
): Promise<ProcessResult> {
  // If linking from account settings (user already logged in)
  if (linkToUserId) {
    await db.oAuthAccount.create({
      data: {
        userId: linkToUserId,
        provider: userInfo.provider,
        providerAccountId: userInfo.providerAccountId,
        email: userInfo.email,
        displayName: userInfo.displayName,
      },
    });

    const linkingUser = await db.user.findUnique({
      where: { id: linkToUserId },
      select: { email: true, defaultLocale: true },
    });
    if (linkingUser) {
      const providerName = userInfo.provider === "GOOGLE" ? "Google" : "Microsoft";
      enqueueOAuthLinkedEmail(
        linkToUserId, linkingUser.email, linkingUser.defaultLocale, linkToUserId,
        providerName, userInfo.email
      ).catch(() => {});
    }

    return { action: "login", userId: linkToUserId };
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
    return { action: "login", userId: existingOAuth.userId };
  }

  // 2. Check if a User with this email exists (account linking)
  if (userInfo.email && userInfo.emailVerified) {
    const existingUser = await db.user.findUnique({
      where: { email: userInfo.email.toLowerCase() },
    });

    if (existingUser) {
      // Auto-link: same verified email
      await db.oAuthAccount.create({
        data: {
          userId: existingUser.id,
          provider: userInfo.provider,
          providerAccountId: userInfo.providerAccountId,
          email: userInfo.email,
          displayName: userInfo.displayName,
        },
      });

      // Auto-verify email if not already
      if (!existingUser.emailVerified) {
        await db.user.update({
          where: { id: existingUser.id },
          data: { emailVerified: true },
        });
      }

      const providerName = userInfo.provider === "GOOGLE" ? "Google" : "Microsoft";
      enqueueOAuthLinkedEmail(
        existingUser.id, existingUser.email, existingUser.defaultLocale, existingUser.id,
        providerName, userInfo.email
      ).catch(() => {});

      return { action: "link_and_login", userId: existingUser.id };
    }
  }

  // 3. New user → needs registration
  return { action: "register" };
}

// ─── Session Helpers ──────────────────────────────────────────────────────────

/**
 * Create a user session after OAuth login and record the login attempt.
 */
export async function handleOAuthLogin(userId: string, email: string): Promise<void> {
  await setUserSession(userId, false);

  const { ipAddress, userAgent } = await getRequestMeta();
  await db.loginAttempt.create({
    data: {
      userId,
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
