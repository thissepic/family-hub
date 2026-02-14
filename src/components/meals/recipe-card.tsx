"use client";

import { useTranslations } from "next-intl";
import { Star, Clock, Users, UtensilsCrossed } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RECIPE_TAG_LABEL_KEYS } from "@/lib/meals/constants";
import type { RecipeTag } from "@/lib/meals/constants";

interface RecipeCardProps {
  recipe: {
    id: string;
    title: string;
    tags: string[];
    servings: number | null;
    prepTime: number | null;
    cookTime: number | null;
    isFavorite: boolean;
    createdBy: { id: string; name: string; color: string } | null;
    _count: { mealPlans: number };
  };
  onEdit: (id: string) => void;
  onToggleFavorite: (id: string) => void;
}

export function RecipeCard({
  recipe,
  onEdit,
  onToggleFavorite,
}: RecipeCardProps) {
  const t = useTranslations("meals");

  const totalTime =
    (recipe.prepTime ?? 0) + (recipe.cookTime ?? 0) || null;

  return (
    <Card
      className="cursor-pointer transition-colors hover:bg-muted/50"
      onClick={() => onEdit(recipe.id)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <UtensilsCrossed className="h-4 w-4 shrink-0 text-muted-foreground" />
            <h3 className="font-medium truncate">{recipe.title}</h3>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(recipe.id);
            }}
          >
            <Star
              className={cn(
                "h-4 w-4",
                recipe.isFavorite
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-muted-foreground"
              )}
            />
          </Button>
        </div>

        {/* Tags */}
        {recipe.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {recipe.tags.map((tag) => {
              const labelKey =
                RECIPE_TAG_LABEL_KEYS[tag as RecipeTag] ?? tag;
              return (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {RECIPE_TAG_LABEL_KEYS[tag as RecipeTag]
                    ? t(labelKey)
                    : tag}
                </Badge>
              );
            })}
          </div>
        )}

        {/* Meta */}
        <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
          {totalTime && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {t("minutesShort", { min: String(totalTime) })}
            </span>
          )}
          {recipe.servings && (
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {recipe.servings}
            </span>
          )}
        </div>

        {/* Created by */}
        {recipe.createdBy && (
          <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
            <span
              className="h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: recipe.createdBy.color }}
            />
            {recipe.createdBy.name}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
