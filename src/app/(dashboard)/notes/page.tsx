"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NoteGrid } from "@/components/notes/note-grid";
import { NoteDialog } from "@/components/notes/note-dialog";

export default function NotesPage() {
  const t = useTranslations("notes");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);

  // Auto-open new note dialog from command palette (?new=1)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("new") === "1") {
      setEditingNoteId(null);
      setDialogOpen(true);
      window.history.replaceState({}, "", "/notes");
    }
  }, []);

  const handleNewNote = () => {
    setEditingNoteId(null);
    setDialogOpen(true);
  };

  const handleEditNote = (id: string) => {
    setEditingNoteId(id);
    setDialogOpen(true);
  };

  const handleDialogChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) setEditingNoteId(null);
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <Button onClick={handleNewNote} size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          {t("newNote")}
        </Button>
      </div>

      {/* Grid */}
      <NoteGrid onEditNote={handleEditNote} />

      {/* Dialog */}
      <NoteDialog
        open={dialogOpen}
        onOpenChange={handleDialogChange}
        noteId={editingNoteId}
      />
    </div>
  );
}
