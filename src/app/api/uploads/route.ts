import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

const ALLOWED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// Magic bytes for file type validation (prevents MIME type spoofing)
const MAGIC_BYTES: Record<string, number[][]> = {
  "image/png": [[0x89, 0x50, 0x4e, 0x47]],
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  "image/gif": [[0x47, 0x49, 0x46, 0x38]],
  "image/webp": [[0x52, 0x49, 0x46, 0x46]], // RIFF header
  "application/pdf": [[0x25, 0x50, 0x44, 0x46]], // %PDF
};

function validateMagicBytes(buffer: Buffer, mimeType: string): boolean {
  const expected = MAGIC_BYTES[mimeType];
  if (!expected) return false;
  return expected.some((magic) =>
    magic.every((byte, i) => buffer[i] === byte)
  );
}
const UPLOAD_DIR = join(process.cwd(), "uploads");

export async function POST(request: NextRequest) {
  const session = await getSession();

  if (!session?.memberId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  // Generate unique filename
  const ext = file.name.split(".").pop() || "bin";
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
}
