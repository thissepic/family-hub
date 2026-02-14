"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "sonner";
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
import { Trash2 } from "lucide-react";

interface ListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listId?: string | null;
  onListCreated?: (listId: string) => void;
}

export function ListDialog({
  open,
  onOpenChange,
  listId,
  onListCreated,
}: ListDialogProps) {
  const t = useTranslations("shopping");
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isEditing = !!listId;

  const { data: list } = useQuery(
    trpc.shopping.getList.queryOptions(
      { id: listId! },
      { enabled: !!listId && open }
    )
  );

  useEffect(() => {
    if (list) {
      setName(list.name);
    } else if (!isEditing) {
      setName("");
    }
  }, [list, isEditing, open]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [["shopping"]] });
  };

  const createMutation = useMutation(
    trpc.shopping.createList.mutationOptions({
      onSuccess: (data) => {
        toast.success(t("listCreated"));
        invalidate();
        onOpenChange(false);
        onListCreated?.(data.id);
      },
    })
  );

  const updateMutation = useMutation(
    trpc.shopping.updateList.mutationOptions({
      onSuccess: () => {
        toast.success(t("listUpdated"));
        invalidate();
        onOpenChange(false);
      },
    })
  );

  const deleteMutation = useMutation(
    trpc.shopping.deleteList.mutationOptions({
      onSuccess: () => {
        toast.success(t("listDeleted"));
        invalidate();
        onOpenChange(false);
        setShowDeleteConfirm(false);
      },
    })
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    if (isEditing && listId) {
      updateMutation.mutate({ id: listId, name: trimmed });
    } else {
      createMutation.mutate({ name: trimmed });
    }
  };

  const isPending =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? t("editList") : t("newList")}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="list-name">{t("listName")}</Label>
              <Input
                id="list-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("listNamePlaceholder")}
                autoFocus
                required
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={!name.trim() || isPending}
            >
              {isEditing ? t("editList") : t("newList")}
            </Button>
          </form>

          {isEditing && list && (
            <div className="border-t pt-3">
              <Button
                type="button"
                variant="destructive"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isPending}
                className="w-full"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t("deleteList")}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmDeleteList")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("confirmDeleteListDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => listId && deleteMutation.mutate({ id: listId })}
            >
              {t("deleteList")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
