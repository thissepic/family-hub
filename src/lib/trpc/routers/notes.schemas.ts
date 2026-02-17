import { z } from "zod/v4";

// ─── Tiptap JSON Validation ─────────────────────────────────
// Validates Tiptap StarterKit JSON structure to prevent arbitrary data injection.
// Allowed node/mark types match the extensions configured in tiptap-editor.tsx.

const ALLOWED_NODE_TYPES = new Set([
  "doc", "paragraph", "text", "heading", "bulletList",
  "orderedList", "listItem", "codeBlock", "blockquote",
  "hardBreak", "horizontalRule",
]);

const ALLOWED_MARK_TYPES = new Set([
  "bold", "italic", "strike", "code", "link",
]);

/** Recursively validate that a Tiptap JSON node only contains allowed types. */
function validateTiptapNode(node: unknown): boolean {
  if (typeof node !== "object" || node === null) return false;
  const n = node as Record<string, unknown>;

  // Every node must have a valid type
  if (typeof n.type !== "string" || !ALLOWED_NODE_TYPES.has(n.type)) return false;

  // Validate marks if present
  if (n.marks != null) {
    if (!Array.isArray(n.marks)) return false;
    for (const mark of n.marks) {
      if (typeof mark !== "object" || mark === null) return false;
      const m = mark as Record<string, unknown>;
      if (typeof m.type !== "string" || !ALLOWED_MARK_TYPES.has(m.type)) return false;
    }
  }

  // Recursively validate child nodes
  if (n.content != null) {
    if (!Array.isArray(n.content)) return false;
    for (const child of n.content) {
      if (!validateTiptapNode(child)) return false;
    }
  }

  return true;
}

// Use z.record() for Prisma JSON compatibility, with refinement for Tiptap structure
const tiptapBody = z.record(z.string(), z.unknown()).refine(
  (val) => val.type === "doc" && validateTiptapNode(val),
  { message: "Invalid Tiptap document structure" },
);

// ─── List / Get ──────────────────────────────────────────────

export const listNotesInput = z.object({
  search: z.string().optional(),
  category: z.string().optional(),
  pinnedOnly: z.boolean().optional(),
});

export const getNoteInput = z.object({
  id: z.string(),
});

// ─── Create / Update ─────────────────────────────────────────

export const createNoteInput = z.object({
  title: z.string().min(1).max(200),
  body: tiptapBody.optional(),
  color: z.string().optional(),
  category: z.string().optional(),
  pinned: z.boolean().optional(),
});

export const updateNoteInput = z.object({
  id: z.string(),
  title: z.string().min(1).max(200).optional(),
  body: tiptapBody.optional(),
  color: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  pinned: z.boolean().optional(),
});

// ─── Delete / Toggle Pin ─────────────────────────────────────

export const deleteNoteInput = z.object({
  id: z.string(),
});

export const togglePinInput = z.object({
  id: z.string(),
});
