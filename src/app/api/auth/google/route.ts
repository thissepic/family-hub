import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { sealData } from "iron-session";
import { getSession } from "@/lib/auth";
import { checkOAuthRateLimit } from "@/lib/rate-limit";
import { headers } from "next/headers";
import crypto from "crypto";
import type { OAuthStateData } from "@/lib/oauth-auth";

export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  // Rate limit
  const headerStore = await headers();
  const forwarded = headerStore.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || headerStore.get("x-real-ip") || "unknown";

  try {
    await checkOAuthRateLimit(ip);
  } catch {
    return NextResponse.redirect(new URL("/login?error=too_many_attempts", appUrl));
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_AUTH_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.redirect(new URL("/login?error=oauth_not_configured", appUrl));
  }

  // Check if user is linking from settings (already has a session)
  const session = await getSession();
  const stateData: OAuthStateData = {
    nonce: crypto.randomBytes(16).toString("hex"),
  };

  if (session?.userId && request.nextUrl.searchParams.get("action") === "link") {
    stateData.userId = session.userId;
  }

  // Preserve redirect parameter for post-auth redirect (e.g., invite flow)
  const redirectParam = request.nextUrl.searchParams.get("redirect");
  if (redirectParam && redirectParam.startsWith("/") && !redirectParam.startsWith("//")) {
    stateData.redirectTo = redirectParam;
  }

  const state = await sealData(stateData, {
    password: process.env.SESSION_SECRET!,
    ttl: 600, // 10 min
  });

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  const url = oauth2Client.generateAuthUrl({
    access_type: "online",
    prompt: "select_account",
    scope: ["openid", "email", "profile"],
    state,
  });

  return NextResponse.redirect(url);
}
