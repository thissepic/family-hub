import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../init";
import { db } from "@/lib/db";
import { emitToFamily } from "@/lib/socket/server";
import {
  listListsInput,
  getListInput,
  createListInput,
  updateListInput,
  deleteListInput,
  addItemInput,
  updateItemInput,
  deleteItemInput,
  toggleItemInput,
  clearCheckedInput,
} from "./shopping.schemas";

const itemInclude = {
  addedBy: { select: { id: true, name: true, color: true } },
  checkedBy: { select: { id: true, name: true, color: true } },
} as const;

export const shoppingRouter = router({
  // ─── List Management ───────────────────────────────────────────

  lists: protectedProcedure.input(listListsInput).query(async ({ ctx }) => {
    const { familyId } = ctx.session;

    return db.shoppingList.findMany({
      where: { familyId },
      include: {
        _count: {
          select: {
            items: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
  }),

  getList: protectedProcedure
    .input(getListInput)
    .query(async ({ ctx, input }) => {
      const list = await db.shoppingList.findUnique({
        where: { id: input.id },
        include: {
          items: {
            include: itemInclude,
            orderBy: [
              { checked: "asc" },
              { category: "asc" },
              { name: "asc" },
            ],
          },
        },
      });

      if (!list || list.familyId !== ctx.session.familyId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return list;
    }),

  createList: protectedProcedure
    .input(createListInput)
    .mutation(async ({ ctx, input }) => {
      const { familyId } = ctx.session;

      return db.shoppingList.create({
        data: {
          familyId,
          name: input.name,
        },
        include: {
          _count: { select: { items: true } },
        },
      });
    }),

  updateList: protectedProcedure
    .input(updateListInput)
    .mutation(async ({ ctx, input }) => {
      const existing = await db.shoppingList.findUnique({
        where: { id: input.id },
      });

      if (!existing || existing.familyId !== ctx.session.familyId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return db.shoppingList.update({
        where: { id: input.id },
        data: { name: input.name },
      });
    }),

  deleteList: protectedProcedure
    .input(deleteListInput)
    .mutation(async ({ ctx, input }) => {
      const existing = await db.shoppingList.findUnique({
        where: { id: input.id },
      });

      if (!existing || existing.familyId !== ctx.session.familyId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      await db.shoppingList.delete({ where: { id: input.id } });
      return { id: input.id };
    }),

  // ─── Item Management ───────────────────────────────────────────

  addItem: protectedProcedure
    .input(addItemInput)
    .mutation(async ({ ctx, input }) => {
      const { memberId, familyId } = ctx.session;

      const list = await db.shoppingList.findUnique({
        where: { id: input.listId },
      });

      if (!list || list.familyId !== familyId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return db.$transaction(async (tx) => {
        const item = await tx.shoppingItem.create({
          data: {
            listId: input.listId,
            name: input.name,
            quantity: input.quantity,
            unit: input.unit,
            category: input.category,
            isRecurring: input.isRecurring ?? false,
            addedById: memberId,
          },
          include: itemInclude,
        });

        await tx.activityEvent.create({
          data: {
            familyId,
            memberId,
            type: "SHOPPING_ITEM_ADDED",
            description: `Added "${input.name}" to ${list.name}`,
            sourceModule: "shopping",
            sourceId: item.id,
          },
        });

        emitToFamily(familyId, "shopping:item-added", {
          listId: input.listId,
          item: { id: item.id, listId: item.listId, name: item.name, quantity: item.quantity, unit: item.unit, category: item.category, checked: item.checked, isRecurring: item.isRecurring },
        });
        emitToFamily(familyId, "hub:data-changed", { modules: ["shopping"] });

        return item;
      });
    }),

  updateItem: protectedProcedure
    .input(updateItemInput)
    .mutation(async ({ ctx, input }) => {
      const item = await db.shoppingItem.findUnique({
        where: { id: input.id },
        include: { list: { select: { familyId: true } } },
      });

      if (!item || item.list.familyId !== ctx.session.familyId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return db.shoppingItem.update({
        where: { id: input.id },
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.quantity !== undefined && { quantity: input.quantity }),
          ...(input.unit !== undefined && { unit: input.unit }),
          ...(input.category !== undefined && { category: input.category }),
          ...(input.isRecurring !== undefined && { isRecurring: input.isRecurring }),
        },
        include: itemInclude,
      });
    }),

  deleteItem: protectedProcedure
    .input(deleteItemInput)
    .mutation(async ({ ctx, input }) => {
      const item = await db.shoppingItem.findUnique({
        where: { id: input.id },
        include: { list: { select: { familyId: true } } },
      });

      if (!item || item.list.familyId !== ctx.session.familyId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const { familyId } = ctx.session;
      await db.shoppingItem.delete({ where: { id: input.id } });
      emitToFamily(familyId, "shopping:item-deleted", { listId: item.listId, itemId: input.id });
      emitToFamily(familyId, "hub:data-changed", { modules: ["shopping"] });
      return { id: input.id };
    }),

  toggleItem: protectedProcedure
    .input(toggleItemInput)
    .mutation(async ({ ctx, input }) => {
      const { memberId } = ctx.session;

      const item = await db.shoppingItem.findUnique({
        where: { id: input.id },
        include: { list: { select: { familyId: true } } },
      });

      if (!item || item.list.familyId !== ctx.session.familyId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const updated = await db.shoppingItem.update({
        where: { id: input.id },
        data: {
          checked: input.checked,
          checkedById: input.checked ? memberId : null,
        },
        include: itemInclude,
      });

      emitToFamily(ctx.session.familyId, "shopping:item-toggled", { listId: item.listId, itemId: input.id, checked: input.checked });
      emitToFamily(ctx.session.familyId, "hub:data-changed", { modules: ["shopping"] });
      return updated;
    }),

  clearChecked: protectedProcedure
    .input(clearCheckedInput)
    .mutation(async ({ ctx, input }) => {
      const list = await db.shoppingList.findUnique({
        where: { id: input.listId },
      });

      if (!list || list.familyId !== ctx.session.familyId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const result = await db.$transaction(async (tx) => {
        // Find recurring items before deleting
        const recurringItems = await tx.shoppingItem.findMany({
          where: {
            listId: input.listId,
            checked: true,
            isRecurring: true,
          },
        });

        // Delete all checked items
        const deleted = await tx.shoppingItem.deleteMany({
          where: {
            listId: input.listId,
            checked: true,
          },
        });

        // Re-create recurring items as unchecked
        if (recurringItems.length > 0) {
          await tx.shoppingItem.createMany({
            data: recurringItems.map((item) => ({
              listId: item.listId,
              name: item.name,
              quantity: item.quantity,
              unit: item.unit,
              category: item.category,
              addedById: item.addedById,
              isRecurring: true,
            })),
          });
        }

        return { deletedCount: deleted.count, recurringRestored: recurringItems.length };
      });

      emitToFamily(ctx.session.familyId, "shopping:checked-cleared", { listId: input.listId });
      emitToFamily(ctx.session.familyId, "hub:data-changed", { modules: ["shopping"] });
      return result;
    }),
});
