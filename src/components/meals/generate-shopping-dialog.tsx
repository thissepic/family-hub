"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ShoppingCart } from "lucide-react";

interface GenerateShoppingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  weekStart: string;
}

export function GenerateShoppingDialog({
  open,
  onOpenChange,
  weekStart,
}: GenerateShoppingDialogProps) {
  const t = useTranslations("meals");
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [selectedListId, setSelectedListId] = useState<string>("");

  const { data: shoppingLists } = useQuery(
    trpc.shopping.lists.queryOptions({}, { enabled: open })
  );

  // Auto-select first list
  if (shoppingLists && shoppingLists.length > 0 && !selectedListId) {
    setSelectedListId(shoppingLists[0].id);
  }

  const generateMutation = useMutation(
    trpc.meals.generateShoppingList.mutationOptions({
      onSuccess: (data) => {
        toast.success(
          t("generatedCount", { count: String(data.addedCount) })
        );
        queryClient.invalidateQueries({ queryKey: [["shopping"]] });
        onOpenChange(false);
      },
    })
  );

  const handleGenerate = () => {
    if (!selectedListId) return;
    generateMutation.mutate({
      weekStart,
      shoppingListId: selectedListId,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            {t("generateShoppingList")}
          </DialogTitle>
          <DialogDescription>
            {t("generateShoppingListDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t("shoppingListTarget")}</Label>
            <Select
              value={selectedListId}
              onValueChange={setSelectedListId}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {shoppingLists?.map((list) => (
                  <SelectItem key={list.id} value={list.id}>
                    {list.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            className="w-full"
            onClick={handleGenerate}
            disabled={
              !selectedListId || generateMutation.isPending
            }
          >
            {t("generateShoppingList")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
