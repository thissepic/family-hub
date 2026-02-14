"use client";

import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "sonner";
import { Pencil, X, RotateCcw } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ShoppingItemProps {
  item: {
    id: string;
    name: string;
    quantity: string | null;
    unit: string | null;
    category: string | null;
    checked: boolean;
    isRecurring: boolean;
    addedBy: { id: string; name: string; color: string } | null;
  };
  onEdit: (itemId: string) => void;
}

export function ShoppingItem({ item, onEdit }: ShoppingItemProps) {
  const t = useTranslations("shopping");
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [["shopping"]] });
  };

  const toggleMutation = useMutation(
    trpc.shopping.toggleItem.mutationOptions({
      onSettled: invalidate,
    })
  );

  const deleteMutation = useMutation(
    trpc.shopping.deleteItem.mutationOptions({
      onSuccess: () => {
        toast.success(t("itemDeleted"));
      },
      onSettled: invalidate,
    })
  );

  const isPending = toggleMutation.isPending || deleteMutation.isPending;

  const quantityLabel = [item.quantity, item.unit]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={cn(
        "group flex items-center gap-3 rounded-md border p-2.5 transition-colors",
        item.checked && "bg-muted/50"
      )}
    >
      {/* Checkbox */}
      <Checkbox
        checked={item.checked}
        onCheckedChange={(checked) =>
          toggleMutation.mutate({ id: item.id, checked: !!checked })
        }
        disabled={isPending}
        className="shrink-0"
      />

      {/* Content */}
      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onEdit(item.id)}>
        <div className="flex items-center gap-2">
          <p
            className={cn(
              "text-sm font-medium truncate",
              item.checked && "line-through text-muted-foreground"
            )}
          >
            {item.name}
          </p>
          {quantityLabel && (
            <span
              className={cn(
                "text-xs text-muted-foreground shrink-0",
                item.checked && "line-through"
              )}
            >
              {quantityLabel}
            </span>
          )}
          {item.isRecurring && (
            <span title={t("recurring")}><RotateCcw className="h-3 w-3 text-muted-foreground shrink-0" /></span>
          )}
        </div>
        {item.addedBy && (
          <span className="text-[11px] text-muted-foreground">
            {t("addedBy", { name: item.addedBy.name })}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => onEdit(item.id)}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={() => deleteMutation.mutate({ id: item.id })}
          disabled={isPending}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
