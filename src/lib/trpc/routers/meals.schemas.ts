import { z } from "zod/v4";

// ─── Recipe schemas ─────────────────────────────────────────────

export const listRecipesInput = z.object({
  search: z.string().optional(),
  tag: z.string().optional(),
  favoritesOnly: z.boolean().optional(),
});

export const getRecipeInput = z.object({
  id: z.string(),
});

const ingredientSchema = z.object({
  name: z.string().min(1).max(200),
  quantity: z.string().optional(),
  unit: z.string().optional(),
});

export const createRecipeInput = z.object({
  title: z.string().min(1).max(200),
  instructions: z.string().optional(),
  servings: z.number().int().min(1).optional(),
  prepTime: z.number().int().min(0).optional(),
  cookTime: z.number().int().min(0).optional(),
  tags: z.array(z.string()).default([]),
  ingredients: z.array(ingredientSchema).default([]),
});

export const updateRecipeInput = z.object({
  id: z.string(),
  title: z.string().min(1).max(200).optional(),
  instructions: z.string().nullable().optional(),
  servings: z.number().int().min(1).nullable().optional(),
  prepTime: z.number().int().min(0).nullable().optional(),
  cookTime: z.number().int().min(0).nullable().optional(),
  tags: z.array(z.string()).optional(),
  ingredients: z.array(ingredientSchema).optional(),
});

export const deleteRecipeInput = z.object({
  id: z.string(),
});

export const toggleFavoriteInput = z.object({
  id: z.string(),
});

// ─── Meal plan schemas ──────────────────────────────────────────

const mealSlotEnum = z.enum(["BREAKFAST", "LUNCH", "DINNER", "SNACK"]);

export const getWeekPlanInput = z.object({
  weekStart: z.string(), // ISO date string (Monday)
});

export const setMealInput = z.object({
  date: z.string(), // ISO date string
  slot: mealSlotEnum,
  recipeId: z.string().optional(),
  freeformName: z.string().min(1).max(200).optional(),
});

export const clearMealInput = z.object({
  date: z.string(),
  slot: mealSlotEnum,
});

// ─── Shopping list generation ───────────────────────────────────

export const generateShoppingListInput = z.object({
  weekStart: z.string(),
  shoppingListId: z.string(),
});
