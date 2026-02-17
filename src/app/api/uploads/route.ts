import { type NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { withAuth } from "@/lib/api-handler";
import { db } from "@/lib/db";
import { checkUploadRateLimit } from "@/lib/rate-limit";

const ALLOWED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
];

// Derive file extension from validated MIME type (not from user-supplied filename)
const MIME_TO_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// Magic bytes for file type validation (prevents MIME type spoofing)
const MAGIC_BYTES: Record<string, number[][]> = {
  "image/png": [[0x89, 0x50, 0x4e, 0x47]],
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  "image/gif": [[0x47, 0x49, 0x46, 0x38]],
  "application/pdf": [[0x25, 0x50, 0x44, 0x46]], // %PDF
};

function validateMagicBytes(buffer: Buffer, mimeType: string): boolean {
  // WebP requires extended validation: RIFF header (bytes 0-3) + WEBP signature (bytes 8-11)
  if (mimeType === "image/webp") {
    if (buffer.length < 12) return false;
    return (
      buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 && // RIFF
      buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50   // WEBP
    );
  }

  const expected = MAGIC_BYTES[mimeType];
  if (!expected) return false;
  return expected.some((magic) =>
    magic.every((byte, i) => buffer[i] === byte)
  );
}
const UPLOAD_DIR = join(process.cwd(), "uploads");

export const POST = withAuth(async (request, session) => {
  // Rate limit file uploads per member
  try {
    await checkUploadRateLimit(session.memberId);
  } catch {
    return NextResponse.json({ error: "Too many uploads. Please try again later." }, { status: 429 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const noteId = formData.get("noteId") as string | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "File type not allowed" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File too large (max 5MB)" }, { status: 400 });
  }

  // Verify note belongs to family
  if (noteId) {
    const note = await db.note.findFirst({
      where: { id: noteId, familyId: session.familyId },
    });
    if (!note) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }
  }

  // Ensure upload dir exists
  await mkdir(UPLOAD_DIR, { recursive: true });

  // Generate unique filename with extension derived from validated MIME type
  const ext = MIME_TO_EXT[file.type] || "bin";
  const uniqueFilename = `${randomUUID()}.${ext}`;
  const filePath = join(UPLOAD_DIR, uniqueFilename);

  // Write file
  const buffer = Buffer.from(await file.arrayBuffer());

  // Validate file content matches declared MIME type
  if (!validateMagicBytes(buffer, file.type)) {
    return NextResponse.json({ error: "File content does not match type" }, { status: 400 });
  }

  await writeFile(filePath, buffer);

  // Create DB record if noteId provided
  let attachment = null;
  if (noteId) {
    attachment = await db.noteAttachment.create({
      data: {
        noteId,
        filename: file.name,
        path: uniqueFilename,
        mimeType: file.type,
      },
    });
  }

  return NextResponse.json({
    filename: uniqueFilename,
    originalName: file.name,
    mimeType: file.type,
    attachment,
  });
});
