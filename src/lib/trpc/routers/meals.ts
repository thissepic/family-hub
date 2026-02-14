import { TRPCError } from "@trpc/server";
import type { Prisma } from "@prisma/client";
import { router, protectedProcedure } from "../init";
import { db } from "@/lib/db";
import {
  listRecipesInput,
  getRecipeInput,
  createRecipeInput,
  updateRecipeInput,
  deleteRecipeInput,
  toggleFavoriteInput,
  getWeekPlanInput,
  setMealInput,
  clearMealInput,
  generateShoppingListInput,
} from "./meals.schemas";

const recipeInclude = {
  createdBy: { select: { id: true, name: true, color: true } },
  ingredients: true,
  _count: { select: { mealPlans: true } },
} as const;

export const mealsRouter = router({
  // ─── Recipe Management ──────────────────────────────────────────

  listRecipes: protectedProcedure
    .input(listRecipesInput)
    .query(async ({ ctx, input }) => {
      const { familyId } = ctx.session;

      const where: Prisma.RecipeWhereInput = {
        familyId,
      };

      if (input.search) {
        where.title = { contains: input.search, mode: "insensitive" };
      }

      if (input.tag) {
        where.tags = { has: input.tag };
      }

      if (input.favoritesOnly) {
        where.isFavorite = true;
      }

      return db.recipe.findMany({
        where,
        include: recipeInclude,
        orderBy: { title: "asc" },
      });
    }),

  getRecipe: protectedProcedure
    .input(getRecipeInput)
    .query(async ({ ctx, input }) => {
      const recipe = await db.recipe.findUnique({
        where: { id: input.id },
        include: recipeInclude,
      });

      if (!recipe || recipe.familyId !== ctx.session.familyId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return recipe;
    }),

  createRecipe: protectedProcedure
    .input(createRecipeInput)
    .mutation(async ({ ctx, input }) => {
      const { familyId, memberId } = ctx.session;
      const { ingredients, ...recipeData } = input;

      return db.$transaction(async (tx) => {
        const recipe = await tx.recipe.create({
          data: {
            familyId,
            ...recipeData,
            createdById: memberId,
          },
        });

        if (ingredients.length > 0) {
          await tx.recipeIngredient.createMany({
            data: ingredients.map((ing) => ({
              recipeId: recipe.id,
              name: ing.name,
              quantity: ing.quantity,
              unit: ing.unit,
            })),
          });
        }

        await tx.activityEvent.create({
          data: {
            familyId,
            memberId,
            type: "MEAL_PLANNED",
            description: `Added recipe: ${recipe.title}`,
            sourceModule: "meals",
            sourceId: recipe.id,
          },
        });

        return tx.recipe.findUniqueOrThrow({
          where: { id: recipe.id },
          include: recipeInclude,
        });
      });
    }),

  updateRecipe: protectedProcedure
    .input(updateRecipeInput)
    .mutation(async ({ ctx, input }) => {
      const { id, ingredients, ...updateData } = input;

      const existing = await db.recipe.findUnique({ where: { id } });
      if (!existing || existing.familyId !== ctx.session.familyId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return db.$transaction(async (tx) => {
        await tx.recipe.update({
          where: { id },
          data: updateData,
        });

        // Replace all ingredients if provided
        if (ingredients !== undefined) {
          await tx.recipeIngredient.deleteMany({
            where: { recipeId: id },
          });

          if (ingredients.length > 0) {
            await tx.recipeIngredient.createMany({
              data: ingredients.map((ing) => ({
                recipeId: id,
                name: ing.name,
                quantity: ing.quantity,
                unit: ing.unit,
              })),
            });
          }
        }

        return tx.recipe.findUniqueOrThrow({
          where: { id },
          include: recipeInclude,
        });
      });
    }),

  deleteRecipe: protectedProcedure
    .input(deleteRecipeInput)
    .mutation(async ({ ctx, input }) => {
      const recipe = await db.recipe.findUnique({
        where: { id: input.id },
      });

      if (!recipe || recipe.familyId !== ctx.session.familyId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      await db.recipe.delete({ where: { id: input.id } });
      return { id: input.id };
    }),

  toggleFavorite: protectedProcedure
    .input(toggleFavoriteInput)
    .mutation(async ({ ctx, input }) => {
      const recipe = await db.recipe.findUnique({
        where: { id: input.id },
      });

      if (!recipe || recipe.familyId !== ctx.session.familyId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return db.recipe.update({
        where: { id: input.id },
        data: { isFavorite: !recipe.isFavorite },
        include: recipeInclude,
      });
    }),

  // ─── Meal Planning ──────────────────────────────────────────────

  getWeekPlan: protectedProcedure
    .input(getWeekPlanInput)
    .query(async ({ ctx, input }) => {
      const { familyId } = ctx.session;
      const weekStart = new Date(input.weekStart);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      return db.mealPlan.findMany({
        where: {
          familyId,
          date: {
            gte: weekStart,
            lte: weekEnd,
          },
        },
        include: {
          recipe: {
            include: {
              ingredients: true,
            },
          },
        },
        orderBy: [{ date: "asc" }, { slot: "asc" }],
      });
    }),

  setMeal: protectedProcedure
    .input(setMealInput)
    .mutation(async ({ ctx, input }) => {
      const { familyId } = ctx.session;
      const date = new Date(input.date);

      const data = {
        recipeId: input.recipeId ?? null,
        freeformName: input.recipeId ? null : (input.freeformName ?? null),
      };

      return db.mealPlan.upsert({
        where: {
          familyId_date_slot: {
            familyId,
            date,
            slot: input.slot,
          },
        },
        create: {
          familyId,
          date,
          slot: input.slot,
          ...data,
        },
        update: data,
        include: {
          recipe: true,
        },
      });
    }),

  clearMeal: protectedProcedure
    .input(clearMealInput)
    .mutation(async ({ ctx, input }) => {
      const { familyId } = ctx.session;
      const date = new Date(input.date);

      await db.mealPlan.deleteMany({
        where: {
          familyId,
          date,
          slot: input.slot,
        },
      });

      return { success: true };
    }),

  // ─── Shopping List Integration ──────────────────────────────────

  generateShoppingList: protectedProcedure
    .input(generateShoppingListInput)
    .mutation(async ({ ctx, input }) => {
      const { familyId, memberId } = ctx.session;

      // Verify shopping list ownership
      const list = await db.shoppingList.findUnique({
        where: { id: input.shoppingListId },
      });
      if (!list || list.familyId !== familyId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      // Fetch all meals for the week with recipes + ingredients
      const weekStart = new Date(input.weekStart);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      const meals = await db.mealPlan.findMany({
        where: {
          familyId,
          date: { gte: weekStart, lte: weekEnd },
          recipeId: { not: null },
        },
        include: {
          recipe: {
            include: { ingredients: true },
          },
        },
      });

      // Aggregate ingredients by name (case-insensitive) + unit
      const aggregated = new Map<
        string,
        { name: string; quantity: number; unit: string | null }
      >();

      for (const meal of meals) {
        if (!meal.recipe) continue;
        for (const ing of meal.recipe.ingredients) {
          const key = `${ing.name.toLowerCase()}|${(ing.unit ?? "").toLowerCase()}`;
          const existing = aggregated.get(key);
          const qty = ing.quantity ? parseFloat(ing.quantity) || 0 : 0;

          if (existing) {
            existing.quantity += qty;
          } else {
            aggregated.set(key, {
              name: ing.name,
              quantity: qty,
              unit: ing.unit,
            });
          }
        }
      }

      // Fetch existing items on the list to avoid duplicates
      const existingItems = await db.shoppingItem.findMany({
        where: { listId: input.shoppingListId },
        select: { name: true, unit: true },
      });

      const existingKeys = new Set(
        existingItems.map(
          (i) => `${i.name.toLowerCase()}|${(i.unit ?? "").toLowerCase()}`
        )
      );

      // Filter out already-existing items
      const toAdd = Array.from(aggregated.entries())
        .filter(([key]) => !existingKeys.has(key))
        .map(([, val]) => ({
          listId: input.shoppingListId,
          name: val.name,
          quantity: val.quantity > 0 ? String(val.quantity) : null,
          unit: val.unit,
          addedById: memberId,
        }));

      if (toAdd.length > 0) {
        await db.shoppingItem.createMany({ data: toAdd });
      }

      return { addedCount: toAdd.length };
    }),
});
