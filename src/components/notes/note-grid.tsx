"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "sonner";
import { Search, StickyNote } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Toggle } from "@/components/ui/toggle";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NoteCard } from "./note-card";
import {
  NOTE_CATEGORIES,
  NOTE_CATEGORY_LABEL_KEYS,
} from "@/lib/notes/constants";

interface NoteGridProps {
  onEditNote: (id: string) => void;
}

export function NoteGrid({ onEditNote }: NoteGridProps) {
  const t = useTranslations("notes");
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("");
  const [pinnedOnly, setPinnedOnly] = useState(false);

  const { data: notes } = useQuery(
    trpc.notes.list.queryOptions({
      search: search || undefined,
      category: category || undefined,
      pinnedOnly: pinnedOnly || undefined,
    })
  );

  const togglePinMutation = useMutation(
    trpc.notes.togglePin.mutationOptions({
      onSuccess: (data) => {
        toast.success(data.pinned ? t("notePinned") : t("noteUnpinned"));
        queryClient.invalidateQueries({ queryKey: [["notes"]] });
      },
    })
  );

  const hasFilters = !!search || !!category || pinnedOnly;

  // Empty state: no notes at all
  if (notes && notes.length === 0 && !hasFilters) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12">
        <StickyNote className="mb-3 h-10 w-10 text-muted-foreground" />
        <p className="text-sm font-medium">{t("noNotes")}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("noNotesDescription")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search & Filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="pl-9"
          />
        </div>
        <Select
          value={category}
          onValueChange={(v) => setCategory(v === "__all__" ? "" : v)}
        >
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder={t("allCategories")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t("allCategories")}</SelectItem>
            {NOTE_CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {t(NOTE_CATEGORY_LABEL_KEYS[cat])}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Toggle
          pressed={pinnedOnly}
          onPressedChange={setPinnedOnly}
          size="sm"
        >
          {t("pinnedOnly")}
        </Toggle>
      </div>

      {/* Note Grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {notes?.map((note) => (
          <NoteCard
            key={note.id}
            note={note}
            onEdit={onEditNote}
            onTogglePin={(id) => togglePinMutation.mutate({ id })}
          />
        ))}
      </div>

      {/* Empty state: no results from filter */}
      {notes && notes.length === 0 && hasFilters && (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12">
          <StickyNote className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm font-medium">{t("noResults")}</p>
        </div>
      )}
    </div>
  );
}
