"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WeekPlanView } from "@/components/meals/week-plan-view";
import { RecipeList } from "@/components/meals/recipe-list";
import { RecipeDialog } from "@/components/meals/recipe-dialog";

export default function MealsPage() {
  const t = useTranslations("meals");

  const [recipeDialogOpen, setRecipeDialogOpen] = useState(false);
  const [editingRecipeId, setEditingRecipeId] = useState<string | null>(null);

  const handleNewRecipe = () => {
    setEditingRecipeId(null);
    setRecipeDialogOpen(true);
  };

  const handleEditRecipe = (id: string) => {
    setEditingRecipeId(id);
    setRecipeDialogOpen(true);
  };

  const handleDialogChange = (open: boolean) => {
    setRecipeDialogOpen(open);
    if (!open) setEditingRecipeId(null);
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <Button onClick={handleNewRecipe} size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          {t("newRecipe")}
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="weekPlan">
        <TabsList>
          <TabsTrigger value="weekPlan">{t("weekPlan")}</TabsTrigger>
          <TabsTrigger value="recipes">{t("recipes")}</TabsTrigger>
        </TabsList>

        <TabsContent value="weekPlan" className="mt-4">
          <WeekPlanView />
        </TabsContent>

        <TabsContent value="recipes" className="mt-4">
          <RecipeList onEditRecipe={handleEditRecipe} />
        </TabsContent>
      </Tabs>

      {/* Recipe Dialog */}
      <RecipeDialog
        open={recipeDialogOpen}
        onOpenChange={handleDialogChange}
        recipeId={editingRecipeId}
      />
    </div>
  );
}
