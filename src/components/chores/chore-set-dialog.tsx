"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface ChoreSetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingSet?: { id: string; name: string; description: string | null } | null;
}

export function ChoreSetDialog({ open, onOpenChange, editingSet }: ChoreSetDialogProps) {
  const t = useTranslations("chores");
  const tCommon = useTranslations("common");
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [name, setName] = useState(editingSet?.name ?? "");
  const [description, setDescription] = useState(editingSet?.description ?? "");

  const isEditing = !!editingSet;

  const createMutation = useMutation(
    trpc.chores.createSet.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [["chores", "listSets"]] });
        toast.success(t("setCreated"));
        onOpenChange(false);
      },
      onError: () => toast.error(tCommon("error")),
    })
  );

  const updateMutation = useMutation(
    trpc.chores.updateSet.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [["chores", "listSets"]] });
        toast.success(t("setSaved"));
        onOpenChange(false);
      },
      onError: () => toast.error(tCommon("error")),
    })
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditing) {
      updateMutation.mutate({ id: editingSet.id, name, description: description || null });
    } else {
      createMutation.mutate({ name, description: description || undefined });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? t("editSet") : t("newSet")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="set-name">{tCommon("name")}</Label>
            <Input
              id="set-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={200}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="set-desc">{tCommon("description")}</Label>
            <Textarea
              id="set-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={isPending || !name.trim()}>
              {isEditing ? tCommon("save") : tCommon("create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
