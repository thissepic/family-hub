"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "sonner";
import { Plus, Trash2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import {
  RECIPE_TAGS,
  RECIPE_TAG_LABEL_KEYS,
  INGREDIENT_UNITS,
} from "@/lib/meals/constants";

interface Ingredient {
  name: string;
  quantity: string;
  unit: string;
}

interface RecipeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipeId?: string | null;
}

export function RecipeDialog({
  open,
  onOpenChange,
  recipeId,
}: RecipeDialogProps) {
  const t = useTranslations("meals");
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [servings, setServings] = useState("");
  const [prepTime, setPrepTime] = useState("");
  const [cookTime, setCookTime] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isEditing = !!recipeId;

  const { data: recipe } = useQuery(
    trpc.meals.getRecipe.queryOptions(
      { id: recipeId! },
      { enabled: !!recipeId && open }
    )
  );

  useEffect(() => {
    if (recipe && isEditing) {
      setTitle(recipe.title);
      setInstructions(recipe.instructions ?? "");
      setServings(recipe.servings?.toString() ?? "");
      setPrepTime(recipe.prepTime?.toString() ?? "");
      setCookTime(recipe.cookTime?.toString() ?? "");
      setTags(recipe.tags);
      setIngredients(
        recipe.ingredients.map((ing) => ({
          name: ing.name,
          quantity: ing.quantity ?? "",
          unit: ing.unit ?? "",
        }))
      );
    } else if (!isEditing && open) {
      setTitle("");
      setInstructions("");
      setServings("");
      setPrepTime("");
      setCookTime("");
      setTags([]);
      setIngredients([]);
    }
  }, [recipe, isEditing, open]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [["meals"]] });
  };

  const createMutation = useMutation(
    trpc.meals.createRecipe.mutationOptions({
      onSuccess: () => {
        toast.success(t("recipeCreated"));
        invalidate();
        onOpenChange(false);
      },
    })
  );

  const updateMutation = useMutation(
    trpc.meals.updateRecipe.mutationOptions({
      onSuccess: () => {
        toast.success(t("recipeUpdated"));
        invalidate();
        onOpenChange(false);
      },
    })
  );

  const deleteMutation = useMutation(
    trpc.meals.deleteRecipe.mutationOptions({
      onSuccess: () => {
        toast.success(t("recipeDeleted"));
        invalidate();
        onOpenChange(false);
        setShowDeleteConfirm(false);
      },
    })
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;

    const data = {
      title: trimmed,
      instructions: instructions.trim() || undefined,
      servings: servings ? parseInt(servings) : undefined,
      prepTime: prepTime ? parseInt(prepTime) : undefined,
      cookTime: cookTime ? parseInt(cookTime) : undefined,
      tags,
      ingredients: ingredients
        .filter((ing) => ing.name.trim())
        .map((ing) => ({
          name: ing.name.trim(),
          quantity: ing.quantity || undefined,
          unit: ing.unit || undefined,
        })),
    };

    if (isEditing && recipeId) {
      updateMutation.mutate({ id: recipeId, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  const toggleTag = (tag: string) => {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const addIngredient = () => {
    setIngredients((prev) => [...prev, { name: "", quantity: "", unit: "" }]);
  };

  const updateIngredient = (
    index: number,
    field: keyof Ingredient,
    value: string
  ) => {
    setIngredients((prev) =>
      prev.map((ing, i) => (i === index ? { ...ing, [field]: value } : ing))
    );
  };

  const removeIngredient = (index: number) => {
    setIngredients((prev) => prev.filter((_, i) => i !== index));
  };

  const isPending =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? t("editRecipe") : t("newRecipe")}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto -mx-6 px-6">
            <form
              id="recipe-form"
              onSubmit={handleSubmit}
              className="space-y-4 pb-4"
            >
              {/* Title */}
              <div className="space-y-1.5">
                <Label htmlFor="recipe-title">{t("recipeTitle")}</Label>
                <Input
                  id="recipe-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t("recipeTitlePlaceholder")}
                  autoFocus
                  required
                />
              </div>

              {/* Servings / Prep / Cook */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="servings">{t("servings")}</Label>
                  <Input
                    id="servings"
                    type="number"
                    min={1}
                    value={servings}
                    onChange={(e) => setServings(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="prep-time">{t("prepTime")}</Label>
                  <Input
                    id="prep-time"
                    type="number"
                    min={0}
                    value={prepTime}
                    onChange={(e) => setPrepTime(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cook-time">{t("cookTime")}</Label>
                  <Input
                    id="cook-time"
                    type="number"
                    min={0}
                    value={cookTime}
                    onChange={(e) => setCookTime(e.target.value)}
                  />
                </div>
              </div>

              {/* Tags */}
              <div className="space-y-1.5">
                <Label>{t("tags")}</Label>
                <div className="flex flex-wrap gap-1.5">
                  {RECIPE_TAGS.map((tag) => (
                    <Toggle
                      key={tag}
                      size="sm"
                      pressed={tags.includes(tag)}
                      onPressedChange={() => toggleTag(tag)}
                      className="text-xs"
                    >
                      {t(RECIPE_TAG_LABEL_KEYS[tag])}
                    </Toggle>
                  ))}
                </div>
              </div>

              {/* Ingredients */}
              <div className="space-y-1.5">
                <Label>{t("ingredients")}</Label>
                <div className="space-y-2">
                  {ingredients.map((ing, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        value={ing.name}
                        onChange={(e) =>
                          updateIngredient(i, "name", e.target.value)
                        }
                        placeholder={t("ingredientNamePlaceholder")}
                        className="flex-1"
                      />
                      <Input
                        value={ing.quantity}
                        onChange={(e) =>
                          updateIngredient(i, "quantity", e.target.value)
                        }
                        placeholder={t("ingredientQuantity")}
                        className="w-16"
                      />
                      <Select
                        value={ing.unit}
                        onValueChange={(v) =>
                          updateIngredient(i, "unit", v === "__none__" ? "" : v)
                        }
                      >
                        <SelectTrigger className="w-20">
                          <SelectValue placeholder={t("ingredientUnit")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">
                            {t("noUnit")}
                          </SelectItem>
                          {INGREDIENT_UNITS.map((u) => (
                            <SelectItem key={u} value={u}>
                              {u}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => removeIngredient(i)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addIngredient}
                  >
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    {t("addIngredient")}
                  </Button>
                </div>
              </div>

              {/* Instructions */}
              <div className="space-y-1.5">
                <Label htmlFor="instructions">{t("instructions")}</Label>
                <Textarea
                  id="instructions"
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder={t("instructionsPlaceholder")}
                  rows={4}
                />
              </div>
            </form>

            <div className="sticky bottom-0 space-y-2 pt-2 pb-1 border-t bg-background">
              <Button
                type="submit"
                form="recipe-form"
                className="w-full"
                disabled={!title.trim() || isPending}
              >
                {isEditing ? t("editRecipe") : t("newRecipe")}
              </Button>

              {isEditing && recipeId && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isPending}
                  className="w-full"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t("deleteRecipe")}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmDeleteRecipe")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("confirmDeleteRecipeDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                recipeId && deleteMutation.mutate({ id: recipeId })
              }
            >
              {t("deleteRecipe")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
