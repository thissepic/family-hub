"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toDateString } from "@/lib/meals/week-helpers";
import type { MealSlot } from "@prisma/client";

interface MealData {
  id: string;
  recipeId: string | null;
  freeformName: string | null;
  recipe: {
    id: string;
    title: string;
    tags: string[];
  } | null;
}

interface MealSlotCellProps {
  date: Date;
  slot: MealSlot;
  meal: MealData | null;
}

export function MealSlotCell({ date, slot, meal }: MealSlotCellProps) {
  const t = useTranslations("meals");
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [freeform, setFreeform] = useState("");
  const [recipeSearch, setRecipeSearch] = useState("");

  const { data: recipes } = useQuery(
    trpc.meals.listRecipes.queryOptions(
      { search: recipeSearch || undefined },
      { enabled: open }
    )
  );

  const setMealMutation = useMutation(
    trpc.meals.setMeal.mutationOptions({
      onSuccess: () => {
        toast.success(t("mealSet"));
        queryClient.invalidateQueries({ queryKey: [["meals"]] });
        setOpen(false);
        setFreeform("");
        setRecipeSearch("");
      },
    })
  );

  const clearMealMutation = useMutation(
    trpc.meals.clearMeal.mutationOptions({
      onSuccess: () => {
        toast.success(t("mealCleared"));
        queryClient.invalidateQueries({ queryKey: [["meals"]] });
        setOpen(false);
      },
    })
  );

  const dateStr = toDateString(date);

  const handleSetFreeform = () => {
    const trimmed = freeform.trim();
    if (!trimmed) return;
    setMealMutation.mutate({ date: dateStr, slot, freeformName: trimmed });
  };

  const handleSetRecipe = (recipeId: string) => {
    setMealMutation.mutate({ date: dateStr, slot, recipeId });
  };

  const handleClear = () => {
    clearMealMutation.mutate({ date: dateStr, slot });
  };

  const displayName = meal?.recipe?.title ?? meal?.freeformName;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "w-full min-h-[3rem] rounded-md border p-1.5 text-left text-xs transition-colors hover:bg-muted/50",
            !displayName && "border-dashed"
          )}
        >
          {displayName ? (
            <span className="line-clamp-2 font-medium">{displayName}</span>
          ) : (
            <span className="flex items-center justify-center h-full text-muted-foreground">
              <Plus className="h-3 w-3" />
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        <div className="space-y-3">
          {/* Freeform input */}
          <div>
            <p className="text-xs font-medium mb-1.5">{t("freeformName")}</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSetFreeform();
              }}
              className="flex items-center gap-1.5"
            >
              <Input
                value={freeform}
                onChange={(e) => setFreeform(e.target.value)}
                placeholder={t("freeformPlaceholder")}
                className="h-8 text-xs"
                autoFocus
              />
              <Button
                type="submit"
                size="sm"
                className="h-8 px-2"
                disabled={
                  !freeform.trim() || setMealMutation.isPending
                }
              >
                {t("setMeal")}
              </Button>
            </form>
          </div>

          <div className="flex items-center gap-2">
            <Separator className="flex-1" />
            <span className="text-[10px] text-muted-foreground uppercase">
              {t("orPickRecipe")}
            </span>
            <Separator className="flex-1" />
          </div>

          {/* Recipe search */}
          <Input
            value={recipeSearch}
            onChange={(e) => setRecipeSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="h-8 text-xs"
          />

          <ScrollArea className="max-h-36">
            <div className="space-y-0.5">
              {recipes?.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className="w-full rounded-sm px-2 py-1.5 text-left text-xs hover:bg-muted transition-colors"
                  onClick={() => handleSetRecipe(r.id)}
                >
                  {r.title}
                </button>
              ))}
              {recipes && recipes.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  {t("noRecipes")}
                </p>
              )}
            </div>
          </ScrollArea>

          {/* Clear button */}
          {meal && (
            <>
              <Separator />
              <Button
                variant="ghost"
                size="sm"
                className="w-full h-7 text-xs text-destructive"
                onClick={handleClear}
                disabled={clearMealMutation.isPending}
              >
                <X className="mr-1 h-3 w-3" />
                {t("clearMeal")}
              </Button>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
