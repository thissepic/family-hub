import { NextResponse } from "next/server";
import { google } from "googleapis";
import { getSession } from "@/lib/auth";
import { sealData } from "iron-session";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.json(
      { error: "Google OAuth not configured" },
      { status: 500 }
    );
  }

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri
  );

  // Sign the state parameter with session secret to prevent CSRF
  const state = await sealData(
    { memberId: session.memberId, familyId: session.familyId },
    { password: process.env.SESSION_SECRET!, ttl: 600 } // 10 min expiry
  );

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/calendar.readonly",
      "https://www.googleapis.com/auth/calendar.events.readonly",
      "https://www.googleapis.com/auth/userinfo.email",
    ],
    state,
  });

  return NextResponse.json({ url });
}
