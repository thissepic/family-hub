"use client";

import { useTranslations } from "next-intl";
import { StickyNote } from "lucide-react";

interface NoteItem {
  id: string;
  title: string;
  bodyPreview: string | null;
  color: string | null;
  category: string | null;
}

interface NotesPanelProps {
  data: NoteItem[];
}

export function NotesPanel({ data }: NotesPanelProps) {
  const t = useTranslations("hub");

  if (!data || data.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-4">
        <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
          <StickyNote className="h-5 w-5" />
          {t("pinnedNotes")}
        </h3>
        <p className="text-sm text-muted-foreground">{t("noNotes")}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-4">
      <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
        <StickyNote className="h-5 w-5" />
        {t("pinnedNotes")}
      </h3>
      <div className="grid grid-cols-2 gap-2">
        {data.slice(0, 4).map((note) => (
          <div
            key={note.id}
            className="rounded-lg p-3 text-sm border"
            style={{
              backgroundColor: note.color
                ? `${note.color}20`
                : undefined,
              borderColor: note.color ?? undefined,
            }}
          >
            <p className="font-medium truncate text-xs">{note.title}</p>
            {note.bodyPreview && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {note.bodyPreview}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
