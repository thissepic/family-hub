import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const session = await getSession();

  if (!session?.memberId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
}
