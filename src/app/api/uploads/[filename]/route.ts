import { NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import { join, resolve, sep } from "path";
import { getFullSession } from "@/lib/auth";
import { db } from "@/lib/db";

const UPLOAD_DIR = join(process.cwd(), "uploads");

const MIME_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  pdf: "application/pdf",
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  // AUTH: This route uses manual auth because of the params argument pattern
  const session = await getFullSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { filename } = await params;

  // Prevent path traversal: resolve the path and verify it stays within UPLOAD_DIR
  const resolvedBase = resolve(UPLOAD_DIR) + sep;
  const filePath = resolve(UPLOAD_DIR, filename);

  if (!filePath.startsWith(resolvedBase)) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  // Verify the file belongs to the user's family
  const attachment = await db.noteAttachment.findFirst({
    where: {
      path: filename,
      note: { familyId: session.familyId },
    },
    select: { filename: true },
  });
  if (!attachment) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  try {
    await stat(filePath);
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const buffer = await readFile(filePath);
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  // Force download for PDFs to prevent embedded JS execution in browser
  const disposition = contentType === "application/pdf" ? "attachment" : "inline";
  // Sanitize filename to prevent header injection
  const safeFilename = attachment.filename.replace(/["\r\n]/g, "_");

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=86400",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": `${disposition}; filename="${safeFilename}"`,
    },
  });
}
