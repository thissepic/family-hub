import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { unsealData } from "iron-session";
import {
  processOAuthCallback,
  handleOAuthLogin,
  storeOAuthPending,
} from "@/lib/oauth-auth";
import type { OAuthStateData, OAuthUserInfo } from "@/lib/oauth-auth";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.url;

  if (error || !code || !state) {
    return NextResponse.redirect(new URL("/login?error=oauth_failed", appUrl));
  }

  try {
    // Verify CSRF state
    const stateData = await unsealData<OAuthStateData>(state, {
      password: process.env.SESSION_SECRET!,
      ttl: 600,
    });

    if (!stateData.nonce) {
      return NextResponse.redirect(new URL("/login?error=oauth_failed", appUrl));
    }

    // Exchange code for tokens
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_AUTH_REDIRECT_URI
    );

    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.id_token) {
      return NextResponse.redirect(new URL("/login?error=oauth_failed", appUrl));
    }

    // Decode id_token (received directly from Google over HTTPS, no verification needed)
    const payload = JSON.parse(
      Buffer.from(tokens.id_token.split(".")[1], "base64url").toString()
    );

    const userInfo: OAuthUserInfo = {
      provider: "GOOGLE",
      providerAccountId: payload.sub,
      email: (payload.email as string)?.toLowerCase(),
      emailVerified: payload.email_verified === true,
      displayName: (payload.name as string) || null,
    };

    if (!userInfo.email || !userInfo.providerAccountId) {
      return NextResponse.redirect(new URL("/login?error=oauth_failed", appUrl));
    }

    // Process the OAuth callback
    const result = await processOAuthCallback(userInfo, stateData.userId);

    if (result.action === "login" || result.action === "link_and_login") {
      // If linking from account settings, redirect back to account settings
      if (stateData.userId) {
        return NextResponse.redirect(
          new URL("/account?linked=google", appUrl)
        );
      }

      await handleOAuthLogin(result.userId, userInfo.email);
      return NextResponse.redirect(new URL("/families", appUrl));
    }

    // New user → store pending data and redirect to registration
    await storeOAuthPending(userInfo);
    return NextResponse.redirect(new URL("/register?oauth=google", appUrl));
  } catch (err) {
    console.error("[OAuth] Google auth callback failed:", err instanceof Error ? err.message : "Unknown error");
    return NextResponse.redirect(new URL("/login?error=oauth_failed", appUrl));
  }
}
