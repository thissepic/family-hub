"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "sonner";
import { Search, UtensilsCrossed } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Toggle } from "@/components/ui/toggle";
import { RecipeCard } from "./recipe-card";

interface RecipeListProps {
  onEditRecipe: (id: string) => void;
}

export function RecipeList({ onEditRecipe }: RecipeListProps) {
  const t = useTranslations("meals");
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  const { data: recipes } = useQuery(
    trpc.meals.listRecipes.queryOptions({
      search: search || undefined,
      favoritesOnly: favoritesOnly || undefined,
    })
  );

  const toggleFavMutation = useMutation(
    trpc.meals.toggleFavorite.mutationOptions({
      onSuccess: () => {
        toast.success(t("favoriteToggled"));
        queryClient.invalidateQueries({ queryKey: [["meals"]] });
      },
    })
  );

  if (recipes && recipes.length === 0 && !search && !favoritesOnly) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12">
        <UtensilsCrossed className="mb-3 h-10 w-10 text-muted-foreground" />
        <p className="text-sm font-medium">{t("noRecipes")}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("noRecipesDescription")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search & Filter */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="pl-9"
          />
        </div>
        <Toggle
          pressed={favoritesOnly}
          onPressedChange={setFavoritesOnly}
          size="sm"
        >
          {t("favoritesOnly")}
        </Toggle>
      </div>

      {/* Recipe Grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {recipes?.map((recipe) => (
          <RecipeCard
            key={recipe.id}
            recipe={recipe}
            onEdit={onEditRecipe}
            onToggleFavorite={(id) => toggleFavMutation.mutate({ id })}
          />
        ))}
      </div>

      {recipes && recipes.length === 0 && (search || favoritesOnly) && (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12">
          <UtensilsCrossed className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm font-medium">{t("noRecipes")}</p>
        </div>
      )}
    </div>
  );
}
