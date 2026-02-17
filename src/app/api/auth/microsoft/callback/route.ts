import { NextRequest, NextResponse } from "next/server";
import { ConfidentialClientApplication } from "@azure/msal-node";
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
    const msalClient = new ConfidentialClientApplication({
      auth: {
        clientId: process.env.MICROSOFT_CLIENT_ID!,
        clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
        authority: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID || "common"}`,
      },
    });

    const result = await msalClient.acquireTokenByCode({
      code,
      scopes: ["openid", "email", "profile", "User.Read"],
      redirectUri: process.env.MICROSOFT_AUTH_REDIRECT_URI!,
    });

    if (!result.accessToken) {
      return NextResponse.redirect(new URL("/login?error=oauth_failed", appUrl));
    }

    // Get user info from Microsoft Graph
    const userRes = await fetch(
      "https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName",
      {
        headers: { Authorization: `Bearer ${result.accessToken}` },
      }
    );

    if (!userRes.ok) {
      return NextResponse.redirect(new URL("/login?error=oauth_failed", appUrl));
    }

    const userData = (await userRes.json()) as {
      id: string;
      displayName?: string;
      mail?: string;
      userPrincipalName?: string;
    };

    const email = (userData.mail || userData.userPrincipalName || "")?.toLowerCase();

    if (!email || !userData.id) {
      return NextResponse.redirect(new URL("/login?error=oauth_failed", appUrl));
    }

    const userInfo: OAuthUserInfo = {
      provider: "MICROSOFT",
      providerAccountId: userData.id,
      email,
      emailVerified: true, // Microsoft verifies emails for managed accounts
      displayName: userData.displayName || null,
    };

    // Process the OAuth callback
    const processResult = await processOAuthCallback(userInfo, stateData.userId);

    if (processResult.action === "login" || processResult.action === "link_and_login") {
      // If linking from account settings, redirect back to account settings
      if (stateData.userId) {
        return NextResponse.redirect(
          new URL("/account?linked=microsoft", appUrl)
        );
      }

      await handleOAuthLogin(processResult.userId, userInfo.email);
      return NextResponse.redirect(new URL("/families", appUrl));
    }

    // New user → store pending data and redirect to registration
    await storeOAuthPending(userInfo);
    return NextResponse.redirect(new URL("/register?oauth=microsoft", appUrl));
  } catch (err) {
    console.error("[OAuth] Microsoft auth callback failed:", err instanceof Error ? err.message : "Unknown error");
    return NextResponse.redirect(new URL("/login?error=oauth_failed", appUrl));
  }
}
