"use client";

import { useState, useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { ChevronLeft, ChevronRight, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MealSlotCell } from "./meal-slot-cell";
import { GenerateShoppingDialog } from "./generate-shopping-dialog";
import {
  getMonday,
  getWeekDays,
  formatWeekRange,
  addWeeks,
  toDateString,
} from "@/lib/meals/week-helpers";
import {
  MEAL_SLOTS,
  MEAL_SLOT_LABEL_KEYS,
  MEAL_SLOT_ICONS,
} from "@/lib/meals/constants";
import type { MealSlot } from "@prisma/client";

export function WeekPlanView() {
  const t = useTranslations("meals");
  const locale = useLocale();
  const trpc = useTRPC();

  const [currentMonday, setCurrentMonday] = useState(() =>
    getMonday(new Date())
  );
  const [shoppingDialogOpen, setShoppingDialogOpen] = useState(false);

  const weekStart = toDateString(currentMonday);
  const days = getWeekDays(currentMonday);

  const { data: weekPlan } = useQuery(
    trpc.meals.getWeekPlan.queryOptions({ weekStart })
  );

  // Build lookup: dateStr -> slot -> meal
  type WeekPlanItem = NonNullable<typeof weekPlan>[number];
  const mealLookup = new Map<string, Map<MealSlot, WeekPlanItem>>();
  if (weekPlan) {
    for (const meal of weekPlan) {
      const dateStr = toDateString(new Date(meal.date));
      if (!mealLookup.has(dateStr)) {
        mealLookup.set(dateStr, new Map());
      }
      mealLookup.get(dateStr)!.set(meal.slot, meal);
    }
  }

  const dayFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { weekday: "short" }),
    [locale]
  );

  const goToday = () => setCurrentMonday(getMonday(new Date()));
  const goPrev = () => setCurrentMonday((m) => addWeeks(m, -1));
  const goNext = () => setCurrentMonday((m) => addWeeks(m, 1));

  const isThisWeek =
    toDateString(currentMonday) === toDateString(getMonday(new Date()));

  return (
    <div className="space-y-4">
      {/* Week Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={goPrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[160px] text-center">
            {formatWeekRange(currentMonday)}
          </span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={goNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          {!isThisWeek && (
            <Button variant="ghost" size="sm" className="text-xs" onClick={goToday}>
              {t("thisWeek")}
            </Button>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShoppingDialogOpen(true)}
        >
          <ShoppingCart className="mr-1.5 h-4 w-4" />
          {t("generateShoppingList")}
        </Button>
      </div>

      {/* Desktop: 7-column grid */}
      <div className="hidden md:block">
        <div className="grid grid-cols-[auto_repeat(7,1fr)] gap-1">
          {/* Header row */}
          <div /> {/* empty corner */}
          {days.map((day, i) => {
            const isToday =
              toDateString(day) === toDateString(new Date());
            return (
              <div
                key={i}
                className={`text-center text-xs font-medium pb-1 ${
                  isToday ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <div>{dayFormatter.format(day).slice(0, 2)}</div>
                <div className="text-[10px]">{day.getDate()}</div>
              </div>
            );
          })}

          {/* Slot rows */}
          {MEAL_SLOTS.map((slot) => {
            const Icon = MEAL_SLOT_ICONS[slot];
            return (
              <div key={slot} className="contents">
                <div className="flex items-center gap-1 pr-2 text-xs text-muted-foreground">
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden lg:inline">
                    {t(MEAL_SLOT_LABEL_KEYS[slot])}
                  </span>
                </div>
                {days.map((day, i) => {
                  const dateStr = toDateString(day);
                  const meal =
                    mealLookup.get(dateStr)?.get(slot) ?? null;
                  return (
                    <MealSlotCell
                      key={`${dateStr}-${slot}`}
                      date={day}
                      slot={slot}
                      meal={
                        meal
                          ? {
                              id: meal.id,
                              recipeId: meal.recipeId,
                              freeformName: meal.freeformName,
                              recipe: meal.recipe
                                ? {
                                    id: meal.recipe.id,
                                    title: meal.recipe.title,
                                    tags: meal.recipe.tags,
                                  }
                                : null,
                            }
                          : null
                      }
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile: stacked day cards */}
      <div className="md:hidden space-y-3">
        {days.map((day, i) => {
          const dateStr = toDateString(day);
          const isToday = dateStr === toDateString(new Date());
          return (
            <div
              key={dateStr}
              className={`rounded-lg border p-3 ${
                isToday ? "border-primary/50" : ""
              }`}
            >
              <h3
                className={`text-sm font-medium mb-2 ${
                  isToday ? "text-primary" : ""
                }`}
              >
                {dayFormatter.format(day).slice(0, 2)} {day.getDate()}
              </h3>
              <div className="grid grid-cols-2 gap-1.5">
                {MEAL_SLOTS.map((slot) => {
                  const meal =
                    mealLookup.get(dateStr)?.get(slot) ?? null;
                  const Icon = MEAL_SLOT_ICONS[slot];
                  return (
                    <div key={slot}>
                      <div className="flex items-center gap-1 mb-0.5 text-[10px] text-muted-foreground">
                        <Icon className="h-3 w-3" />
                        {t(MEAL_SLOT_LABEL_KEYS[slot])}
                      </div>
                      <MealSlotCell
                        date={day}
                        slot={slot}
                        meal={
                          meal
                            ? {
                                id: meal.id,
                                recipeId: meal.recipeId,
                                freeformName: meal.freeformName,
                                recipe: meal.recipe
                                  ? {
                                      id: meal.recipe.id,
                                      title: meal.recipe.title,
                                      tags: meal.recipe.tags,
                                    }
                                  : null,
                              }
                            : null
                        }
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <GenerateShoppingDialog
        open={shoppingDialogOpen}
        onOpenChange={setShoppingDialogOpen}
        weekStart={weekStart}
      />
    </div>
  );
}
