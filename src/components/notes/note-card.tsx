"use client";

import { useTranslations } from "next-intl";
import { Pin, StickyNote } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { NOTE_CATEGORY_LABEL_KEYS } from "@/lib/notes/constants";

interface NoteCardProps {
  note: {
    id: string;
    title: string;
    body: unknown;
    color: string | null;
    pinned: boolean;
    category: string | null;
    createdBy: { id: string; name: string; color: string } | null;
  };
  onEdit: (id: string) => void;
  onTogglePin: (id: string) => void;
}

/** Recursively walk Tiptap JSON and extract a plain-text preview (max `limit` chars). */
function extractTextPreview(body: unknown, limit = 100): string {
  if (!body || typeof body !== "object") return "";
  const parts: string[] = [];

  function walk(node: unknown) {
    if (!node || typeof node !== "object") return;
    const n = node as { type?: string; text?: string; content?: unknown[] };
    if (n.text) {
      parts.push(n.text);
      return;
    }
    if (Array.isArray(n.content)) {
      for (const child of n.content) {
        walk(child);
      }
      // Add space between block-level nodes for readability
      if (n.type && n.type !== "doc") parts.push(" ");
    }
  }

  walk(body);
  const joined = parts.join("").replace(/\s+/g, " ").trim();
  return joined.length > limit ? joined.slice(0, limit) + "..." : joined;
}

export function NoteCard({ note, onEdit, onTogglePin }: NoteCardProps) {
  const t = useTranslations("notes");
  const preview = extractTextPreview(note.body);

  return (
    <Card
      className="cursor-pointer transition-colors hover:opacity-90"
      style={{
        backgroundColor: note.color ?? undefined,
        color: note.color ? "#111827" : undefined,
      }}
      onClick={() => onEdit(note.id)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <StickyNote className={cn("h-4 w-4 shrink-0", note.color ? "text-gray-500" : "text-muted-foreground")} />
            <h3 className="font-medium truncate">{note.title}</h3>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onTogglePin(note.id);
            }}
          >
            <Pin
              className={cn(
                "h-4 w-4",
                note.pinned
                  ? note.color ? "fill-gray-700 text-gray-700" : "fill-foreground text-foreground"
                  : note.color ? "text-gray-400" : "text-muted-foreground"
              )}
            />
          </Button>
        </div>

        {/* Body preview */}
        {preview && (
          <p className={cn("mt-1.5 text-xs line-clamp-2", note.color ? "text-gray-600" : "text-muted-foreground")}>
            {preview}
          </p>
        )}

        {/* Category badge */}
        {note.category && (
          <div className="mt-2">
            <Badge variant="secondary" className={cn("text-xs", note.color && "bg-black/10 text-gray-700 hover:bg-black/15")}>
              {NOTE_CATEGORY_LABEL_KEYS[note.category]
                ? t(NOTE_CATEGORY_LABEL_KEYS[note.category])
                : note.category}
            </Badge>
          </div>
        )}

        {/* Created by */}
        {note.createdBy && (
          <div className={cn("flex items-center gap-1.5 mt-2 text-xs", note.color ? "text-gray-600" : "text-muted-foreground")}>
            <span
              className="h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: note.createdBy.color }}
            />
            {note.createdBy.name}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
