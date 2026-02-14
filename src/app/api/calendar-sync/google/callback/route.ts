import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { unsealData } from "iron-session";
import { db } from "@/lib/db";
import { encryptToken } from "@/lib/calendar-sync/encryption";
import { enqueueSyncJob } from "@/lib/calendar-sync/queue";

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
      new URL(`${baseRedirect}&error=google_auth_failed`, appUrl)
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
        new URL(`${baseRedirect}&error=google_auth_failed`, appUrl)
      );
    }

    const { memberId, familyId } = stateData;

    // Exchange code for tokens
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token) {
      return NextResponse.redirect(
        new URL(`${baseRedirect}&error=google_auth_failed`, appUrl)
      );
    }

    // Get user email for account label
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    const accountLabel = userInfo.data.email ?? "Google Calendar";

    // Encrypt tokens
    const accessTokenEncrypted = encryptToken(tokens.access_token);
    const refreshTokenEncrypted = tokens.refresh_token
      ? encryptToken(tokens.refresh_token)
      : null;

    // Create connection + fetch calendars in a transaction
    const connection = await db.$transaction(async (tx) => {
      const conn = await tx.externalCalendarConnection.create({
        data: {
          memberId,
          provider: "GOOGLE",
          accountLabel,
          accessTokenEncrypted,
          refreshTokenEncrypted,
          tokenExpiresAt: tokens.expiry_date
            ? new Date(tokens.expiry_date)
            : null,
          syncEnabled: true,
          status: "ACTIVE",
        },
      });

      // Fetch calendar list from Google
      const calendarApi = google.calendar({
        version: "v3",
        auth: oauth2Client,
      });
      const calendarList = await calendarApi.calendarList.list();
      const items = calendarList.data.items ?? [];

      // Create ExternalCalendar rows
      for (const cal of items) {
        if (!cal.id) continue;
        await tx.externalCalendar.create({
          data: {
            connectionId: conn.id,
            externalCalendarId: cal.id,
            name: cal.summary ?? cal.id,
            color: cal.backgroundColor ?? null,
            syncEnabled: cal.primary === true, // Only primary calendar enabled by default
            privacyMode: "FULL_DETAILS",
            syncDirection: "INBOUND_ONLY",
          },
        });
      }

      return conn;
    });

    // Enqueue initial sync job
    try {
      await enqueueSyncJob(connection.id, true);
    } catch {
      // Don't fail the redirect if queue isn't available
      console.warn("Failed to enqueue initial sync job");
    }

    return NextResponse.redirect(
      new URL(`${baseRedirect}&connected=google`, appUrl)
    );
  } catch (err) {
    console.error("Google OAuth callback error:", err);
    return NextResponse.redirect(
      new URL(`${baseRedirect}&error=google_auth_failed`, appUrl)
    );
  }
}
