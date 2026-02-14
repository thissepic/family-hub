import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const session = await getSession();

  if (!session?.memberId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
}
