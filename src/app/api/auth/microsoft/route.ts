import { NextRequest, NextResponse } from "next/server";
import { ConfidentialClientApplication } from "@azure/msal-node";
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

  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const redirectUri = process.env.MICROSOFT_AUTH_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.redirect(new URL("/login?error=oauth_not_configured", appUrl));
  }

  try {
    // Check if user is linking from settings
    const session = await getSession();
    const stateData: OAuthStateData = {
      nonce: crypto.randomBytes(16).toString("hex"),
    };

    if (session?.userId && request.nextUrl.searchParams.get("action") === "link") {
      stateData.userId = session.userId;
    }

    const state = await sealData(stateData, {
      password: process.env.SESSION_SECRET!,
      ttl: 600,
    });

    const msalClient = new ConfidentialClientApplication({
      auth: {
        clientId,
        clientSecret,
        authority: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID || "common"}`,
      },
    });

    const authUrl = await msalClient.getAuthCodeUrl({
      scopes: ["openid", "email", "profile", "User.Read"],
      redirectUri,
      state,
      prompt: "select_account",
    });

    return NextResponse.redirect(authUrl);
  } catch (err) {
    console.error("Microsoft OAuth initiation error:", err);
    return NextResponse.redirect(new URL("/login?error=oauth_failed", appUrl));
  }
}
