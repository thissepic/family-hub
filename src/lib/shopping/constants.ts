// ─── Categories ──────────────────────────────────────────────────

export const SHOPPING_CATEGORIES = [
  "Produce",
  "Dairy",
  "Meat & Fish",
  "Bakery",
  "Frozen",
  "Beverages",
  "Snacks",
  "Canned & Jarred",
  "Household",
  "Health & Beauty",
  "Baby",
  "Pet",
  "Other",
] as const;

export type ShoppingCategory = (typeof SHOPPING_CATEGORIES)[number];

export const DEFAULT_CATEGORY: ShoppingCategory = "Other";

// i18n label keys for categories
export const CATEGORY_LABEL_KEYS: Record<ShoppingCategory, string> = {
  Produce: "categoryProduce",
  Dairy: "categoryDairy",
  "Meat & Fish": "categoryMeatFish",
  Bakery: "categoryBakery",
  Frozen: "categoryFrozen",
  Beverages: "categoryBeverages",
  Snacks: "categorySnacks",
  "Canned & Jarred": "categoryCanned",
  Household: "categoryHousehold",
  "Health & Beauty": "categoryHealthBeauty",
  Baby: "categoryBaby",
  Pet: "categoryPet",
  Other: "categoryOther",
};

// ─── Units ───────────────────────────────────────────────────────

export const SHOPPING_UNITS = [
  "pcs",
  "kg",
  "g",
  "lb",
  "oz",
  "L",
  "ml",
  "pack",
  "bottle",
  "can",
  "bag",
  "box",
  "bunch",
  "dozen",
] as const;

export type ShoppingUnit = (typeof SHOPPING_UNITS)[number];
