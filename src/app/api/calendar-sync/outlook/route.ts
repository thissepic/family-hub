import { NextRequest, NextResponse } from "next/server";
import { ConfidentialClientApplication } from "@azure/msal-node";
import { sealData } from "iron-session";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const baseRedirect = "/settings?tab=calendars";

  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const redirectUri = process.env.MICROSOFT_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.redirect(
      new URL(`${baseRedirect}&error=outlook_not_configured`, request.url)
    );
  }

  try {
    const session = await getSession();
    if (!session?.memberId || !session?.familyId) {
      return NextResponse.redirect(
        new URL(`${baseRedirect}&error=outlook_auth_failed`, request.url)
      );
    }

    const state = await sealData(
      {
        memberId: session.memberId,
        familyId: session.familyId,
      },
      { password: process.env.SESSION_SECRET!, ttl: 600 }
    );

    const msalClient = new ConfidentialClientApplication({
      auth: {
        clientId,
        clientSecret,
        authority: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID || "common"}`,
      },
    });

    const authUrl = await msalClient.getAuthCodeUrl({
      scopes: ["Calendars.Read", "User.Read", "offline_access"],
      redirectUri,
      state,
    });

    return NextResponse.redirect(authUrl);
  } catch (err) {
    console.error("Outlook OAuth initiation error:", err);
    return NextResponse.redirect(
      new URL(`${baseRedirect}&error=outlook_auth_failed`, request.url)
    );
  }
}
