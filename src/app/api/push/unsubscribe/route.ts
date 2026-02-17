import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/api-handler";

export const POST = withAuth(async (request, session) => {
  const body = await request.json();
  const { endpoint } = body;

  if (!endpoint) {
    return NextResponse.json(
      { error: "Missing endpoint" },
      { status: 400 }
    );
  }

  await db.pushSubscription.deleteMany({
    where: {
      memberId: session.memberId,
      endpoint,
    },
  });

  return NextResponse.json({ success: true });
});
