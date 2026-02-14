import { z } from "zod/v4";

// ─── List schemas ────────────────────────────────────────────────

export const listListsInput = z.object({});

export const getListInput = z.object({
  id: z.string(),
});

export const createListInput = z.object({
  name: z.string().min(1).max(100),
});

export const updateListInput = z.object({
  id: z.string(),
  name: z.string().min(1).max(100),
});

export const deleteListInput = z.object({
  id: z.string(),
});

// ─── Item schemas ────────────────────────────────────────────────

export const addItemInput = z.object({
  listId: z.string(),
  name: z.string().min(1).max(200),
  quantity: z.string().optional(),
  unit: z.string().optional(),
  category: z.string().optional(),
  isRecurring: z.boolean().optional(),
});

export const updateItemInput = z.object({
  id: z.string(),
  name: z.string().min(1).max(200).optional(),
  quantity: z.string().nullable().optional(),
  unit: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  isRecurring: z.boolean().optional(),
});

export const deleteItemInput = z.object({
  id: z.string(),
});

export const toggleItemInput = z.object({
  id: z.string(),
  checked: z.boolean(),
});

export const clearCheckedInput = z.object({
  listId: z.string(),
});
