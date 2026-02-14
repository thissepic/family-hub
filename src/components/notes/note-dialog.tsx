"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "sonner";
import { Trash2, Paperclip, X, FileText, ImageIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TiptapEditor } from "./tiptap-editor";
import { NoteColorPicker } from "./note-color-picker";
import {
  NOTE_CATEGORIES,
  NOTE_CATEGORY_LABEL_KEYS,
} from "@/lib/notes/constants";

interface NoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  noteId?: string | null;
}

export function NoteDialog({ open, onOpenChange, noteId }: NoteDialogProps) {
  const t = useTranslations("notes");
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState<unknown>(null);
  const [color, setColor] = useState<string | null>(null);
  const [category, setCategory] = useState<string>("");
  const [pinned, setPinned] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isEditing = !!noteId;

  const { data: note } = useQuery(
    trpc.notes.get.queryOptions(
      { id: noteId! },
      { enabled: !!noteId && open }
    )
  );

  useEffect(() => {
    if (note && isEditing) {
      setTitle(note.title);
      setBody(note.body);
      setColor(note.color);
      setCategory(note.category ?? "");
      setPinned(note.pinned);
    } else if (!isEditing && open) {
      setTitle("");
      setBody(null);
      setColor(null);
      setCategory("");
      setPinned(false);
    }
  }, [note, isEditing, open]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [["notes"]] });
  };

  const createMutation = useMutation(
    trpc.notes.create.mutationOptions({
      onSuccess: () => {
        toast.success(t("noteCreated"));
        invalidate();
        onOpenChange(false);
      },
    })
  );

  const updateMutation = useMutation(
    trpc.notes.update.mutationOptions({
      onSuccess: () => {
        toast.success(t("noteUpdated"));
        invalidate();
        onOpenChange(false);
      },
    })
  );

  const deleteMutation = useMutation(
    trpc.notes.delete.mutationOptions({
      onSuccess: () => {
        toast.success(t("noteDeleted"));
        invalidate();
        onOpenChange(false);
        setShowDeleteConfirm(false);
      },
    })
  );

  const deleteAttachmentMutation = useMutation(
    trpc.notes.deleteAttachment.mutationOptions({
      onSuccess: () => {
        invalidate();
      },
    })
  );

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !noteId) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error(t("maxFileSize"));
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("noteId", noteId);

      const res = await fetch("/api/uploads", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");

      invalidate();
      toast.success(t("attachmentAdded"));
    } catch {
      toast.error(t("uploadFailed"));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;

    const data = {
      title: trimmed,
      body: body ?? undefined,
      color: color ?? undefined,
      category: category || undefined,
      pinned,
    };

    if (isEditing && noteId) {
      updateMutation.mutate({
        id: noteId,
        ...data,
        color: color, // allow null to clear
        category: category || null,
      });
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending ||
    uploading;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? t("editNote") : t("newNote")}
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="flex-1 -mx-6 px-5">
            <form
              id="note-form"
              onSubmit={handleSubmit}
              className="space-y-4 pb-4 px-1"
            >
              {/* Title */}
              <div className="space-y-1.5">
                <Label htmlFor="note-title">{t("noteTitle")}</Label>
                <Input
                  id="note-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t("noteTitlePlaceholder")}
                  autoFocus
                  required
                />
              </div>

              {/* Color */}
              <div className="space-y-1.5">
                <Label>{t("color")}</Label>
                <NoteColorPicker value={color} onChange={setColor} />
              </div>

              {/* Category */}
              <div className="space-y-1.5">
                <Label>{t("category")}</Label>
                <Select
                  value={category}
                  onValueChange={(v) =>
                    setCategory(v === "__none__" ? "" : v)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("noCategory")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">
                      {t("noCategory")}
                    </SelectItem>
                    {NOTE_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {t(NOTE_CATEGORY_LABEL_KEYS[cat])}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Pinned */}
              <div className="flex items-center justify-between">
                <Label htmlFor="note-pinned">{t("pinned")}</Label>
                <Switch
                  id="note-pinned"
                  checked={pinned}
                  onCheckedChange={setPinned}
                />
              </div>

              {/* Body (rich text) */}
              <div className="space-y-1.5">
                <Label>{t("body")}</Label>
                <TiptapEditor
                  content={body}
                  onChange={setBody}
                  placeholder={t("bodyPlaceholder")}
                />
              </div>

              {/* Attachments (only when editing) */}
              {isEditing && noteId && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>{t("attachments")}</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                    >
                      <Paperclip className="mr-1.5 h-3.5 w-3.5" />
                      {t("addAttachment")}
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      accept="image/*,application/pdf"
                      onChange={handleFileUpload}
                    />
                  </div>
                  {note?.attachments && note.attachments.length > 0 && (
                    <div className="space-y-1.5 rounded-md border p-2">
                      {note.attachments.map((att) => (
                        <div key={att.id} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2 min-w-0">
                            {att.mimeType.startsWith("image/") ? (
                              <ImageIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            ) : (
                              <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            )}
                            <a
                              href={`/api/uploads/${att.path}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="truncate hover:underline"
                            >
                              {att.filename}
                            </a>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0"
                            onClick={() => deleteAttachmentMutation.mutate({ id: att.id })}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </form>
          </ScrollArea>

          <div className="space-y-2 pt-2 border-t">
            <Button
              type="submit"
              form="note-form"
              className="w-full"
              disabled={!title.trim() || isPending}
            >
              {isEditing ? t("save") : t("newNote")}
            </Button>

            {isEditing && noteId && (
              <Button
                type="button"
                variant="destructive"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isPending}
                className="w-full"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t("deleteNote")}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmDeleteNote")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("confirmDeleteNoteDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                noteId && deleteMutation.mutate({ id: noteId })
              }
            >
              {t("deleteNote")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
