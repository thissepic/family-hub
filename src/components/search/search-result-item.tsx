"use client";

import { useRouter } from "next/navigation";
import {
  Calendar,
  CheckSquare,
  Sparkles,
  StickyNote,
  ShoppingCart,
  UtensilsCrossed,
  Users,
} from "lucide-react";
import { Command } from "cmdk";
import type { SearchResultItem } from "@/lib/trpc/routers/search.schemas";

const MODULE_ICONS: Record<string, React.ElementType> = {
  calendar: Calendar,
  tasks: CheckSquare,
  chores: Sparkles,
  recipes: UtensilsCrossed,
  notes: StickyNote,
  shopping: ShoppingCart,
  members: Users,
};

/**
 * Safely render a search snippet that may contain <mark> tags from
 * PostgreSQL ts_headline(). Strips all HTML except <mark>/<mark> to
 * prevent XSS while preserving search-term highlighting.
 */
function renderSnippet(html: string): React.ReactNode[] {
  // Split on <mark> and </mark> tags, keeping the delimiters
  const parts = html.replace(/<[^>]*(?<!mark)>/gi, "").split(/(<\/?mark>)/gi);

  const nodes: React.ReactNode[] = [];
  let inMark = false;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part.toLowerCase() === "<mark>") {
      inMark = true;
      continue;
    }
    if (part.toLowerCase() === "</mark>") {
      inMark = false;
      continue;
    }
    if (!part) continue;

    if (inMark) {
      nodes.push(
        <mark key={i} className="bg-yellow-200 text-foreground dark:bg-yellow-800">
          {part}
        </mark>
      );
    } else {
      nodes.push(part);
    }
  }

  return nodes;
}

interface SearchResultItemViewProps {
  item: SearchResultItem;
  onSelect: () => void;
}

export function SearchResultItemView({
  item,
  onSelect,
}: SearchResultItemViewProps) {
  const router = useRouter();
  const Icon = MODULE_ICONS[item.module] ?? CheckSquare;

  return (
    <Command.Item
      value={`${item.module}-${item.id}-${item.title}`}
      onSelect={() => {
        router.push(item.url);
        onSelect();
      }}
      className="flex items-center gap-3 rounded-md px-2 py-2 text-sm cursor-pointer hover:bg-accent aria-selected:bg-accent"
    >
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <p className="truncate font-medium text-sm">{item.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {renderSnippet(item.snippet)}
        </p>
      </div>
    </Command.Item>
  );
}
