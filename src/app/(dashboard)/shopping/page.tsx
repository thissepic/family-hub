"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, ShoppingCart, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useTRPC } from "@/lib/trpc/client";
import { ListSelector } from "@/components/shopping/list-selector";
import { QuickAdd } from "@/components/shopping/quick-add";
import { ItemList } from "@/components/shopping/item-list";
import { ListDialog } from "@/components/shopping/list-dialog";
import { ItemEditDialog } from "@/components/shopping/item-edit-dialog";

export default function ShoppingPage() {
  const t = useTranslations("shopping");
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // List state
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [listDialogOpen, setListDialogOpen] = useState(false);
  const [editingListId, setEditingListId] = useState<string | null>(null);

  // Item edit state
  const [editingItem, setEditingItem] = useState<{
    id: string;
    name: string;
    quantity: string | null;
    unit: string | null;
    category: string | null;
    isRecurring: boolean;
  } | null>(null);

  // Queries
  const { data: lists } = useQuery(
    trpc.shopping.lists.queryOptions({})
  );

  const { data: activeList } = useQuery(
    trpc.shopping.getList.queryOptions(
      { id: activeListId! },
      { enabled: !!activeListId }
    )
  );

  // Auto-focus quick add from command palette (?new=1)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("new") === "1") {
      window.history.replaceState({}, "", "/shopping");
      // Focus the quick-add input after a short delay for rendering
      setTimeout(() => {
        const input = document.querySelector<HTMLInputElement>(
          'input[type="text"]'
        );
        input?.focus();
      }, 300);
    }
  }, []);

  // Auto-select first list
  useEffect(() => {
    if (lists && lists.length > 0 && !activeListId) {
      setActiveListId(lists[0].id);
    }
    // If active list was deleted, select first remaining
    if (lists && lists.length > 0 && activeListId) {
      const exists = lists.some((l) => l.id === activeListId);
      if (!exists) {
        setActiveListId(lists[0].id);
      }
    }
    // If all lists deleted
    if (lists && lists.length === 0) {
      setActiveListId(null);
    }
  }, [lists, activeListId]);

  // Clear checked mutation
  const clearCheckedMutation = useMutation(
    trpc.shopping.clearChecked.mutationOptions({
      onSuccess: (data) => {
        toast.success(t("checkedCleared", { count: String(data.deletedCount) }));
        queryClient.invalidateQueries({ queryKey: [["shopping"]] });
      },
    })
  );

  const handleNewList = () => {
    setEditingListId(null);
    setListDialogOpen(true);
  };

  const handleEditList = (listId: string) => {
    setEditingListId(listId);
    setListDialogOpen(true);
  };

  const handleListDialogChange = (open: boolean) => {
    setListDialogOpen(open);
    if (!open) setEditingListId(null);
  };

  const handleEditItem = (itemId: string) => {
    const item = activeList?.items.find((i) => i.id === itemId);
    if (item) {
      setEditingItem({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        category: item.category,
        isRecurring: item.isRecurring,
      });
    }
  };

  const checkedCount = activeList?.items.filter((i) => i.checked).length ?? 0;

  // No lists at all
  if (lists && lists.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <Button onClick={handleNewList} size="sm">
            <Plus className="mr-1.5 h-4 w-4" />
            {t("newList")}
          </Button>
        </div>
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12">
          <ShoppingCart className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm font-medium">{t("noLists")}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("noListsDescription")}
          </p>
          <Button className="mt-4" size="sm" onClick={handleNewList}>
            <Plus className="mr-1.5 h-4 w-4" />
            {t("newList")}
          </Button>
        </div>
        <ListDialog
          open={listDialogOpen}
          onOpenChange={handleListDialogChange}
          listId={editingListId}
          onListCreated={setActiveListId}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <Button onClick={handleNewList} size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          {t("newList")}
        </Button>
      </div>

      {/* List Selector */}
      {lists && (
        <ListSelector
          lists={lists}
          activeListId={activeListId}
          onSelect={setActiveListId}
          onCreateNew={handleNewList}
          onEditList={handleEditList}
        />
      )}

      {/* Quick Add */}
      {activeListId && <QuickAdd listId={activeListId} />}

      {/* Item List */}
      {activeList && (
        <ItemList
          items={activeList.items}
          onEditItem={handleEditItem}
        />
      )}

      {/* Clear Checked */}
      {checkedCount > 0 && activeListId && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              clearCheckedMutation.mutate({ listId: activeListId })
            }
            disabled={clearCheckedMutation.isPending}
          >
            <Trash2 className="mr-1.5 h-4 w-4" />
            {t("clearChecked")} ({checkedCount})
          </Button>
        </div>
      )}

      {/* Dialogs */}
      <ListDialog
        open={listDialogOpen}
        onOpenChange={handleListDialogChange}
        listId={editingListId}
        onListCreated={setActiveListId}
      />
      <ItemEditDialog
        open={!!editingItem}
        onOpenChange={(open) => {
          if (!open) setEditingItem(null);
        }}
        item={editingItem}
      />
    </div>
  );
}
