"use client";

import { useTranslations } from "next-intl";
import { ShoppingCart } from "lucide-react";

interface ShoppingData {
  items: {
    id: string;
    name: string;
    quantity: string | null;
    unit: string | null;
    category: string | null;
  }[];
  totalUnchecked: number;
}

interface ShoppingPanelProps {
  data: ShoppingData;
}

const MAX_DISPLAY = 10;

export function ShoppingPanel({ data }: ShoppingPanelProps) {
  const t = useTranslations("hub");

  const items = data?.items ?? [];
  const total = data?.totalUnchecked ?? 0;
  const hasMore = total > MAX_DISPLAY;
  const displayItems = items.slice(0, MAX_DISPLAY);

  return (
    <div className="rounded-xl border bg-card p-4">
      <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
        <ShoppingCart className="h-5 w-5" />
        {t("shoppingList")}
        {total > 0 && (
          <span className="ml-auto text-sm font-normal text-muted-foreground">
            {t("itemCount", { count: total })}
          </span>
        )}
      </h3>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noItems")}</p>
      ) : (
        <>
          <div className="space-y-1">
            {displayItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-2 text-sm rounded-lg p-1.5"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                <span className="flex-1 truncate">{item.name}</span>
                {(item.quantity || item.unit) && (
                  <span className="text-xs text-muted-foreground shrink-0">
                    {[item.quantity, item.unit].filter(Boolean).join(" ")}
                  </span>
                )}
              </div>
            ))}
          </div>
          {hasMore && (
            <p className="text-xs text-muted-foreground mt-2">
              {t("moreItems", { count: total - MAX_DISPLAY })}
            </p>
          )}
        </>
      )}
    </div>
  );
}
