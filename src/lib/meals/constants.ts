import { Sunrise, Sun, Sunset, Cookie, type LucideIcon } from "lucide-react";
import type { MealSlot } from "@prisma/client";

// ─── Meal Slots ─────────────────────────────────────────────────

export const MEAL_SLOTS: MealSlot[] = [
  "BREAKFAST",
  "LUNCH",
  "DINNER",
  "SNACK",
];

export const MEAL_SLOT_LABEL_KEYS: Record<MealSlot, string> = {
  BREAKFAST: "slotBreakfast",
  LUNCH: "slotLunch",
  DINNER: "slotDinner",
  SNACK: "slotSnack",
};

export const MEAL_SLOT_ICONS: Record<MealSlot, LucideIcon> = {
  BREAKFAST: Sunrise,
  LUNCH: Sun,
  DINNER: Sunset,
  SNACK: Cookie,
};

// ─── Recipe Tags ────────────────────────────────────────────────

export const RECIPE_TAGS = [
  "Vegetarian",
  "Vegan",
  "Quick",
  "Kid-Friendly",
  "Healthy",
  "Comfort Food",
  "Dessert",
  "Breakfast",
  "Gluten-Free",
] as const;

export type RecipeTag = (typeof RECIPE_TAGS)[number];

export const RECIPE_TAG_LABEL_KEYS: Record<RecipeTag, string> = {
  Vegetarian: "tagVegetarian",
  Vegan: "tagVegan",
  Quick: "tagQuick",
  "Kid-Friendly": "tagKidFriendly",
  Healthy: "tagHealthy",
  "Comfort Food": "tagComfortFood",
  Dessert: "tagDessert",
  Breakfast: "tagBreakfast",
  "Gluten-Free": "tagGlutenFree",
};

// ─── Ingredient Units ───────────────────────────────────────────

export const INGREDIENT_UNITS = [
  "pcs",
  "g",
  "kg",
  "ml",
  "L",
  "cup",
  "tbsp",
  "tsp",
  "oz",
  "lb",
  "bunch",
  "can",
  "pack",
  "clove",
  "pinch",
] as const;

export type IngredientUnit = (typeof INGREDIENT_UNITS)[number];
