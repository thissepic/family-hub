"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "sonner";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, RotateCcw } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  SHOPPING_CATEGORIES,
  SHOPPING_UNITS,
  CATEGORY_LABEL_KEYS,
  UNIT_LABEL_KEYS,
} from "@/lib/shopping/constants";
import type { ShoppingCategory, ShoppingUnit } from "@/lib/shopping/constants";

interface ItemData {
  id: string;
  name: string;
  quantity: string | null;
  unit: string | null;
  category: string | null;
  isRecurring: boolean;
}

interface ItemEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: ItemData | null;
}

export function ItemEditDialog({
  open,
  onOpenChange,
  item,
}: ItemEditDialogProps) {
  const t = useTranslations("shopping");
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("__none__");
  const [category, setCategory] = useState("__none__");
  const [isRecurring, setIsRecurring] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (item) {
      setName(item.name);
      setQuantity(item.quantity ?? "");
      setUnit(item.unit ?? "__none__");
      setCategory(item.category ?? "__none__");
      setIsRecurring(item.isRecurring);
    }
  }, [item]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [["shopping"]] });
  };

  const updateMutation = useMutation(
    trpc.shopping.updateItem.mutationOptions({
      onSuccess: () => {
        toast.success(t("itemUpdated"));
        invalidate();
        onOpenChange(false);
      },
    })
  );

  const deleteMutation = useMutation(
    trpc.shopping.deleteItem.mutationOptions({
      onSuccess: () => {
        toast.success(t("itemDeleted"));
        invalidate();
        onOpenChange(false);
        setShowDeleteConfirm(false);
      },
    })
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!item || !name.trim()) return;

    updateMutation.mutate({
      id: item.id,
      name: name.trim(),
      quantity: quantity.trim() || null,
      unit: unit === "__none__" ? null : unit || null,
      category: category === "__none__" ? null : category || null,
      isRecurring,
    });
  };

  const isPending = updateMutation.isPending || deleteMutation.isPending;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("editItem")}</DialogTitle>
          </DialogHeader>

          {item && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="item-name">{t("itemName")}</Label>
                <Input
                  id="item-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="item-qty">{t("quantity")}</Label>
                  <Input
                    id="item-qty"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder={t("quantityPlaceholder")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("unit")}</Label>
                  <Select value={unit} onValueChange={setUnit}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("noUnit")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">{t("noUnit")}</SelectItem>
                      {SHOPPING_UNITS.map((u) => (
                        <SelectItem key={u} value={u}>
                          {t(UNIT_LABEL_KEYS[u])}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>{t("category")}</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("selectCategory")} />
                  </SelectTrigger>
                  <SelectContent>
                    {SHOPPING_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {t(CATEGORY_LABEL_KEYS[cat as ShoppingCategory])}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between rounded-md border p-3">
                <div className="flex items-center gap-2">
                  <RotateCcw className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="is-recurring" className="cursor-pointer font-normal">
                    {t("recurring")}
                  </Label>
                </div>
                <Switch
                  id="is-recurring"
                  checked={isRecurring}
                  onCheckedChange={setIsRecurring}
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={!name.trim() || isPending}
              >
                {t("editItem")}
              </Button>
            </form>
          )}

          {item && (
            <div className="border-t pt-3">
              <Button
                type="button"
                variant="destructive"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isPending}
                className="w-full"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t("deleteItem")}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmDeleteItem")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("confirmDeleteItemDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => item && deleteMutation.mutate({ id: item.id })}
            >
              {t("deleteItem")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
