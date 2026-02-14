"use client";

import { useTranslations } from "next-intl";
import { UtensilsCrossed, Coffee, Sun, Moon, Cookie } from "lucide-react";

interface MealItem {
  id: string;
  slot: string;
  recipeName: string | null;
  freeformName: string | null;
}

interface MealsPanelProps {
  data: MealItem[];
}

const SLOT_ICONS: Record<string, React.ElementType> = {
  BREAKFAST: Coffee,
  LUNCH: Sun,
  DINNER: Moon,
  SNACK: Cookie,
};

const SLOT_LABEL_KEYS: Record<string, string> = {
  BREAKFAST: "breakfast",
  LUNCH: "lunch",
  DINNER: "dinner",
  SNACK: "snack",
};

export function MealsPanel({ data }: MealsPanelProps) {
  const t = useTranslations("hub");

  const slots = ["BREAKFAST", "LUNCH", "DINNER", "SNACK"];

  return (
    <div className="rounded-xl border bg-card p-4">
      <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
        <UtensilsCrossed className="h-5 w-5" />
        {t("mealPlan")}
      </h3>
      {!data || data.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noMeals")}</p>
      ) : (
        <div className="space-y-2">
          {slots.map((slot) => {
            const meal = data.find((m) => m.slot === slot);
            if (!meal) return null;
            const Icon = SLOT_ICONS[slot] ?? UtensilsCrossed;
            const name = meal.recipeName || meal.freeformName || "—";

            return (
              <div
                key={slot}
                className="flex items-center gap-3 rounded-lg p-2 bg-accent/20"
              >
                <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-xs font-medium text-muted-foreground w-16 shrink-0">
                  {t(SLOT_LABEL_KEYS[slot] as "breakfast")}
                </span>
                <span className="text-sm truncate">{name}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
