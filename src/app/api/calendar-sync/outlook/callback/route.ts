import { NextRequest, NextResponse } from "next/server";
import { ConfidentialClientApplication } from "@azure/msal-node";
import { unsealData } from "iron-session";
import { db } from "@/lib/db";
import { encryptToken } from "@/lib/calendar-sync/encryption";
import { enqueueSyncJob } from "@/lib/calendar-sync/queue";
import { fetchOutlookCalendarList } from "@/lib/calendar-sync/outlook";

interface OAuthState {
  memberId: string;
  familyId: string;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.url;
  const baseRedirect = "/settings?tab=calendars";

  if (error || !code || !state) {
    return NextResponse.redirect(
      new URL(`${baseRedirect}&error=outlook_auth_failed`, appUrl)
    );
  }

  try {
    // Verify CSRF state token
    const stateData = await unsealData<OAuthState>(state, {
      password: process.env.SESSION_SECRET!,
      ttl: 600,
    });

    if (!stateData.memberId || !stateData.familyId) {
      return NextResponse.redirect(
        new URL(`${baseRedirect}&error=outlook_auth_failed`, appUrl)
      );
    }

    const { memberId } = stateData;

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
      scopes: ["Calendars.Read", "User.Read", "offline_access"],
      redirectUri: process.env.MICROSOFT_REDIRECT_URI!,
    });

    if (!result.accessToken) {
      return NextResponse.redirect(
        new URL(`${baseRedirect}&error=outlook_auth_failed`, appUrl)
      );
    }

    // Extract refresh token from MSAL cache
    const cache = msalClient.getTokenCache().serialize();
    const cacheData = JSON.parse(cache);
    const refreshTokens = Object.values(
      cacheData.RefreshToken || {}
    ) as Array<{ secret: string }>;
    const refreshToken = refreshTokens[0]?.secret || null;

    // Get user display name / email for account label
    let accountLabel = "Outlook Calendar";
    try {
      const userRes = await fetch(
        "https://graph.microsoft.com/v1.0/me?$select=displayName,mail",
        {
          headers: { Authorization: `Bearer ${result.accessToken}` },
        }
      );
      if (userRes.ok) {
        const userData = (await userRes.json()) as {
          displayName?: string;
          mail?: string;
        };
        accountLabel =
          userData.mail ?? userData.displayName ?? "Outlook Calendar";
      }
    } catch {
      // Use default label
    }

    // Encrypt tokens
    const accessTokenEncrypted = encryptToken(result.accessToken);
    const refreshTokenEncrypted = refreshToken
      ? encryptToken(refreshToken)
      : null;

    // Fetch calendar list
    const calendars = await fetchOutlookCalendarList(result.accessToken);

    // Create connection + calendars
    const connection = await db.$transaction(async (tx) => {
      const conn = await tx.externalCalendarConnection.create({
        data: {
          memberId,
          provider: "OUTLOOK",
          accountLabel,
          accessTokenEncrypted,
          refreshTokenEncrypted,
          tokenExpiresAt: result.expiresOn,
          syncEnabled: true,
          status: "ACTIVE",
        },
      });

      // Create ExternalCalendar rows
      for (let i = 0; i < calendars.length; i++) {
        const cal = calendars[i];
        await tx.externalCalendar.create({
          data: {
            connectionId: conn.id,
            externalCalendarId: cal.id,
            name: cal.name,
            color: cal.color,
            syncEnabled: i === 0, // Default calendar enabled
            privacyMode: "FULL_DETAILS",
            syncDirection: "INBOUND_ONLY",
          },
        });
      }

      return conn;
    });

    // Enqueue initial sync
    try {
      await enqueueSyncJob(connection.id, true);
    } catch {
      console.warn("Failed to enqueue initial sync job for Outlook");
    }

    return NextResponse.redirect(
      new URL(`${baseRedirect}&connected=outlook`, appUrl)
    );
  } catch (err) {
    console.error("[CalSync] Outlook OAuth callback failed:", err instanceof Error ? err.message : "Unknown error");
    return NextResponse.redirect(
      new URL(`${baseRedirect}&error=outlook_auth_failed`, appUrl)
    );
  }
}
