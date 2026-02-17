import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/api-handler";

export const POST = withAuth(async (request, session) => {
  const body = await request.json();
  const { endpoint, p256dh, auth } = body;

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json(
      { error: "Missing subscription fields" },
      { status: 400 }
    );
  }

  await db.pushSubscription.upsert({
    where: {
      memberId_endpoint: {
        memberId: session.memberId,
        endpoint,
      },
    },
    create: {
      memberId: session.memberId,
      endpoint,
      p256dh,
      auth,
    },
    update: {
      p256dh,
      auth,
    },
  });

  return NextResponse.json({ success: true });
});
