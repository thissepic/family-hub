"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { UtensilsCrossed } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTRPC } from "@/lib/trpc/client";
import Link from "next/link";
import { MEAL_SLOT_LABEL_KEYS } from "@/lib/meals/constants";
import type { MealSlot } from "@prisma/client";

function getWeekStart(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  return monday.toISOString().split("T")[0];
}

export function MealOfDayWidget() {
  const t = useTranslations("dashboard");
  const tMeals = useTranslations("meals");
  const trpc = useTRPC();

  const weekStart = getWeekStart();

  const { data: meals, isLoading } = useQuery(
    trpc.meals.getWeekPlan.queryOptions({ weekStart })
  );

  const todayStr = new Date().toISOString().split("T")[0];
  const todayMeals = meals?.filter((m) => {
    const mealDate = new Date(m.date).toISOString().split("T")[0];
    return mealDate === todayStr;
  }) ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{t("mealOfDay")}</CardTitle>
        <UtensilsCrossed className="h-4 w-4 text-red-500" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ) : !todayMeals.length ? (
          <p className="text-sm text-muted-foreground">{t("noMeals")}</p>
        ) : (
          <div className="space-y-2">
            {todayMeals.map((meal) => (
              <div key={meal.id} className="text-sm">
                <span className="text-xs font-medium text-muted-foreground uppercase">
                  {tMeals(MEAL_SLOT_LABEL_KEYS[meal.slot as MealSlot])}
                </span>
                <p className="truncate">
                  {meal.recipe?.title || meal.freeformName || "—"}
                </p>
              </div>
            ))}
            <Link href="/meals" className="block text-xs text-muted-foreground hover:underline">
              {t("viewAll")}
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
