"use client";

import { useState } from "react";
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
import { Trash2 } from "lucide-react";
import { ChoreForm, type ChoreFormData } from "./chore-form";
import type {
  ChoreDifficulty,
  RotationPattern,
} from "@prisma/client";

interface ChoreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  choreId?: string | null;
}

export function ChoreDialog({ open, onOpenChange, choreId }: ChoreDialogProps) {
  const t = useTranslations("chores");
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isEditing = !!choreId;

  const { data: chore, isLoading } = useQuery(
    trpc.chores.getById.queryOptions(
      { id: choreId! },
      { enabled: !!choreId && open }
    )
  );

  const invalidateChores = () => {
    queryClient.invalidateQueries({ queryKey: [["chores"]] });
  };

  const createMutation = useMutation(
    trpc.chores.create.mutationOptions({
      onSuccess: () => {
        toast.success(t("choreCreated"));
        invalidateChores();
        onOpenChange(false);
      },
    })
  );

  const updateMutation = useMutation(
    trpc.chores.update.mutationOptions({
      onSuccess: () => {
        toast.success(t("choreUpdated"));
        invalidateChores();
        onOpenChange(false);
      },
    })
  );

  const deleteMutation = useMutation(
    trpc.chores.delete.mutationOptions({
      onSuccess: () => {
        toast.success(t("choreDeleted"));
        invalidateChores();
        onOpenChange(false);
        setShowDeleteConfirm(false);
      },
    })
  );

  const handleSubmit = (data: ChoreFormData) => {
    if (isEditing && choreId) {
      updateMutation.mutate({
        id: choreId,
        title: data.title,
        description: data.description,
        category: data.category,
        recurrenceRule: data.recurrenceRule,
        difficulty: data.difficulty,
        estimatedMinutes: data.estimatedMinutes,
        needsVerification: data.needsVerification,
        rotationPattern: data.rotationPattern,
        assigneeIds: data.assigneeIds,
      });
    } else {
      createMutation.mutate({
        title: data.title,
        description: data.description,
        category: data.category,
        recurrenceRule: data.recurrenceRule,
        difficulty: data.difficulty,
        estimatedMinutes: data.estimatedMinutes,
        needsVerification: data.needsVerification,
        rotationPattern: data.rotationPattern,
        assigneeIds: data.assigneeIds,
      });
    }
  };

  const confirmDelete = () => {
    if (!choreId) return;
    deleteMutation.mutate({ id: choreId });
  };

  const initialData = chore
    ? {
        title: chore.title,
        description: chore.description ?? undefined,
        category: chore.category,
        recurrenceRule: chore.recurrenceRule,
        difficulty: chore.difficulty as ChoreDifficulty,
        estimatedMinutes: chore.estimatedMinutes ?? undefined,
        needsVerification: chore.needsVerification,
        rotationPattern: chore.rotationPattern as RotationPattern,
        assigneeIds: chore.assignees.map(
          (a: { member: { id: string } }) => a.member.id
        ),
      }
    : undefined;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? t("editChore") : t("newChore")}
            </DialogTitle>
          </DialogHeader>

          {isEditing && isLoading ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-muted-foreground">{t("choreDetails")}...</p>
            </div>
          ) : (
            <ChoreForm
              initialData={initialData}
              onSubmit={handleSubmit}
              isSubmitting={
                createMutation.isPending || updateMutation.isPending
              }
              submitLabel={isEditing ? t("editChore") : t("newChore")}
            />
          )}

          {isEditing && chore && (
            <div className="border-t pt-3">
              <Button
                type="button"
                variant="destructive"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={deleteMutation.isPending}
                className="w-full"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t("deleteChore")}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmDelete")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("confirmDeleteDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>
              {t("deleteChore")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
