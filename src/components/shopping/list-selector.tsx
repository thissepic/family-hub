"use client";

import { useTranslations } from "next-intl";
import { Plus, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ShoppingList {
  id: string;
  name: string;
  _count: { items: number };
}

interface ListSelectorProps {
  lists: ShoppingList[];
  activeListId: string | null;
  onSelect: (listId: string) => void;
  onCreateNew: () => void;
  onEditList: (listId: string) => void;
}

export function ListSelector({
  lists,
  activeListId,
  onSelect,
  onCreateNew,
  onEditList,
}: ListSelectorProps) {
  const t = useTranslations("shopping");

  if (lists.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
      {lists.map((list) => {
        const isActive = list.id === activeListId;
        return (
          <div key={list.id} className="relative group shrink-0">
            <button
              type="button"
              onClick={() => onSelect(list.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors whitespace-nowrap",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {list.name}
              <Badge
                variant={isActive ? "secondary" : "outline"}
                className="h-5 min-w-5 justify-center px-1.5 text-[10px]"
              >
                {list._count.items}
              </Badge>
            </button>
            {isActive && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-background border shadow-sm md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  onEditList(list.id);
                }}
              >
                <Pencil className="h-2.5 w-2.5" />
              </Button>
            )}
          </div>
        );
      })}
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8 rounded-full shrink-0"
        onClick={onCreateNew}
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}
