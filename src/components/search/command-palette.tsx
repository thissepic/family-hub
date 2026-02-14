"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { Command } from "cmdk";
import {
  Calendar,
  CheckSquare,
  Sparkles,
  StickyNote,
  ShoppingCart,
  UtensilsCrossed,
  Trophy,
  Activity,
  Search,
  Plus,
  Loader2,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { SearchResultItemView } from "./search-result-item";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const t = useTranslations("search");
  const tNav = useTranslations("nav");
  const trpc = useTRPC();

  const [inputValue, setInputValue] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce the search query
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (inputValue.length >= 2) {
      debounceRef.current = setTimeout(() => {
        setDebouncedQuery(inputValue);
      }, 300);
    } else {
      setDebouncedQuery("");
    }

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [inputValue]);

  // Reset state when palette closes
  useEffect(() => {
    if (!open) {
      setInputValue("");
      setDebouncedQuery("");
    }
  }, [open]);

  // Keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, onOpenChange]);

  // Search query
  const shouldSearch = debouncedQuery.length >= 2;
  const { data: searchResults, isFetching } = useQuery({
    ...trpc.search.global.queryOptions({ query: debouncedQuery, limit: 5 }),
    enabled: shouldSearch,
    staleTime: 30_000,
  });

  const runCommand = (command: () => void) => {
    onOpenChange(false);
    command();
  };

  const hasSearchResults =
    searchResults && searchResults.modules.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 max-w-lg">
        <DialogTitle className="sr-only">{tNav("searchPlaceholder")}</DialogTitle>
        <Command
          shouldFilter={!shouldSearch}
          className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3"
        >
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <Command.Input
              placeholder={tNav("searchPlaceholder")}
              value={inputValue}
              onValueChange={setInputValue}
              className="flex h-12 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
            {isFetching && (
              <Loader2 className="ml-2 h-4 w-4 shrink-0 animate-spin opacity-50" />
            )}
          </div>
          <Command.List className="max-h-[400px] overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              {shouldSearch ? t("noResults") : null}
            </Command.Empty>

            {/* Search Results */}
            {hasSearchResults &&
              searchResults.modules.map((group) => (
                <Command.Group
                  key={group.module}
                  heading={`${t(group.labelKey as "moduleCalendar")} (${group.results.length})`}
                >
                  {group.results.map((item) => (
                    <SearchResultItemView
                      key={item.id}
                      item={item}
                      onSelect={() => onOpenChange(false)}
                    />
                  ))}
                </Command.Group>
              ))}

            {/* Loading indicator */}
            {isFetching && !hasSearchResults && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                {t("searching")}
              </div>
            )}

            {/* Quick Actions — Navigation */}
            {!shouldSearch && (
              <Command.Group heading={t("quickActions")}>
                <Command.Item
                  onSelect={() =>
                    runCommand(() => router.push("/calendar"))
                  }
                  className="flex items-center gap-2 rounded-md px-2 py-2 text-sm cursor-pointer hover:bg-accent"
                >
                  <Calendar className="h-4 w-4" />
                  <span>{t("goToCalendar")}</span>
                </Command.Item>
                <Command.Item
                  onSelect={() => runCommand(() => router.push("/tasks"))}
                  className="flex items-center gap-2 rounded-md px-2 py-2 text-sm cursor-pointer hover:bg-accent"
                >
                  <CheckSquare className="h-4 w-4" />
                  <span>{t("goToTasks")}</span>
                </Command.Item>
                <Command.Item
                  onSelect={() => runCommand(() => router.push("/chores"))}
                  className="flex items-center gap-2 rounded-md px-2 py-2 text-sm cursor-pointer hover:bg-accent"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>{t("goToChores")}</span>
                </Command.Item>
                <Command.Item
                  onSelect={() =>
                    runCommand(() => router.push("/shopping"))
                  }
                  className="flex items-center gap-2 rounded-md px-2 py-2 text-sm cursor-pointer hover:bg-accent"
                >
                  <ShoppingCart className="h-4 w-4" />
                  <span>{t("goToShopping")}</span>
                </Command.Item>
                <Command.Item
                  onSelect={() => runCommand(() => router.push("/meals"))}
                  className="flex items-center gap-2 rounded-md px-2 py-2 text-sm cursor-pointer hover:bg-accent"
                >
                  <UtensilsCrossed className="h-4 w-4" />
                  <span>{t("goToMeals")}</span>
                </Command.Item>
                <Command.Item
                  onSelect={() => runCommand(() => router.push("/notes"))}
                  className="flex items-center gap-2 rounded-md px-2 py-2 text-sm cursor-pointer hover:bg-accent"
                >
                  <StickyNote className="h-4 w-4" />
                  <span>{t("goToNotes")}</span>
                </Command.Item>
                <Command.Item
                  onSelect={() =>
                    runCommand(() => router.push("/rewards"))
                  }
                  className="flex items-center gap-2 rounded-md px-2 py-2 text-sm cursor-pointer hover:bg-accent"
                >
                  <Trophy className="h-4 w-4" />
                  <span>{t("goToRewards")}</span>
                </Command.Item>
                <Command.Item
                  onSelect={() =>
                    runCommand(() => router.push("/activity"))
                  }
                  className="flex items-center gap-2 rounded-md px-2 py-2 text-sm cursor-pointer hover:bg-accent"
                >
                  <Activity className="h-4 w-4" />
                  <span>{t("goToActivity")}</span>
                </Command.Item>
              </Command.Group>
            )}

            {/* Quick Actions — Create */}
            {!shouldSearch && (
              <Command.Group heading={t("createActions")}>
                <Command.Item
                  onSelect={() =>
                    runCommand(() => router.push("/calendar?new=1"))
                  }
                  className="flex items-center gap-2 rounded-md px-2 py-2 text-sm cursor-pointer hover:bg-accent"
                >
                  <Plus className="h-4 w-4" />
                  <span>{t("newEvent")}</span>
                </Command.Item>
                <Command.Item
                  onSelect={() =>
                    runCommand(() => router.push("/tasks?new=1"))
                  }
                  className="flex items-center gap-2 rounded-md px-2 py-2 text-sm cursor-pointer hover:bg-accent"
                >
                  <Plus className="h-4 w-4" />
                  <span>{t("newTask")}</span>
                </Command.Item>
                <Command.Item
                  onSelect={() =>
                    runCommand(() => router.push("/notes?new=1"))
                  }
                  className="flex items-center gap-2 rounded-md px-2 py-2 text-sm cursor-pointer hover:bg-accent"
                >
                  <Plus className="h-4 w-4" />
                  <span>{t("newNote")}</span>
                </Command.Item>
                <Command.Item
                  onSelect={() =>
                    runCommand(() => router.push("/shopping?new=1"))
                  }
                  className="flex items-center gap-2 rounded-md px-2 py-2 text-sm cursor-pointer hover:bg-accent"
                >
                  <Plus className="h-4 w-4" />
                  <span>{t("newShoppingItem")}</span>
                </Command.Item>
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
