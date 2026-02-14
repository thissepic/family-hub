"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ShoppingCart, ChevronDown, ChevronRight } from "lucide-react";
import { ShoppingItem } from "./shopping-item";
import { CATEGORY_LABEL_KEYS } from "@/lib/shopping/constants";
import type { ShoppingCategory } from "@/lib/shopping/constants";

interface Item {
  id: string;
  name: string;
  quantity: string | null;
  unit: string | null;
  category: string | null;
  checked: boolean;
  isRecurring: boolean;
  addedBy: { id: string; name: string; color: string } | null;
}

interface ItemListProps {
  items: Item[];
  onEditItem: (itemId: string) => void;
}

export function ItemList({ items, onEditItem }: ItemListProps) {
  const t = useTranslations("shopping");
  const [checkedExpanded, setCheckedExpanded] = useState(false);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12">
        <ShoppingCart className="mb-3 h-10 w-10 text-muted-foreground" />
        <p className="text-sm font-medium">{t("noItems")}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("noItemsDescription")}
        </p>
      </div>
    );
  }

  const unchecked = items.filter((i) => !i.checked);
  const checked = items.filter((i) => i.checked);

  // Group unchecked items by category
  const groups = new Map<string, Item[]>();
  for (const item of unchecked) {
    const cat = item.category || "Other";
    if (!groups.has(cat)) {
      groups.set(cat, []);
    }
    groups.get(cat)!.push(item);
  }

  // Sort groups alphabetically, but "Other" goes last
  const sortedGroups = Array.from(groups.entries()).sort(([a], [b]) => {
    if (a === "Other") return 1;
    if (b === "Other") return -1;
    return a.localeCompare(b);
  });

  // Sort items within each group alphabetically
  for (const [, groupItems] of sortedGroups) {
    groupItems.sort((a, b) => a.name.localeCompare(b.name));
  }

  return (
    <div className="space-y-4">
      {/* Unchecked items grouped by category */}
      {sortedGroups.map(([category, groupItems]) => {
        const labelKey =
          CATEGORY_LABEL_KEYS[category as ShoppingCategory] ?? "categoryOther";
        return (
          <div key={category}>
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t(labelKey)}
              </h3>
              <span className="text-xs text-muted-foreground">
                ({groupItems.length})
              </span>
            </div>
            <div className="space-y-1.5">
              {groupItems.map((item) => (
                <ShoppingItem
                  key={item.id}
                  item={item}
                  onEdit={onEditItem}
                />
              ))}
            </div>
          </div>
        );
      })}

      {/* Checked items section */}
      {checked.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setCheckedExpanded(!checkedExpanded)}
            className="flex items-center gap-1.5 mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
          >
            {checkedExpanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
            {t("checkedSection")}
            <span>({checked.length})</span>
          </button>
          {checkedExpanded && (
            <div className="space-y-1.5">
              {checked.map((item) => (
                <ShoppingItem
                  key={item.id}
                  item={item}
                  onEdit={onEditItem}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
