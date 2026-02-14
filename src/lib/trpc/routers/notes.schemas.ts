import { z } from "zod/v4";

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
  body: z.any().optional(), // Tiptap JSON document
  color: z.string().optional(),
  category: z.string().optional(),
  pinned: z.boolean().optional(),
});

export const updateNoteInput = z.object({
  id: z.string(),
  title: z.string().min(1).max(200).optional(),
  body: z.any().optional(),
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
