"use client";

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
import { useState } from "react";
import { TaskForm, type TaskFormData } from "./task-form";
import type { TaskPriority } from "@prisma/client";

interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId?: string | null;
}

export function TaskDialog({ open, onOpenChange, taskId }: TaskDialogProps) {
  const t = useTranslations("tasks");
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isEditing = !!taskId;

  const { data: task, isLoading } = useQuery(
    trpc.tasks.getById.queryOptions(
      { id: taskId! },
      { enabled: !!taskId && open }
    )
  );

  const invalidateTasks = () => {
    queryClient.invalidateQueries({ queryKey: [["tasks"]] });
  };

  const createMutation = useMutation(
    trpc.tasks.create.mutationOptions({
      onSuccess: () => {
        toast.success(t("taskCreated"));
        invalidateTasks();
        onOpenChange(false);
      },
    })
  );

  const updateMutation = useMutation(
    trpc.tasks.update.mutationOptions({
      onSuccess: () => {
        toast.success(t("taskUpdated"));
        invalidateTasks();
        onOpenChange(false);
      },
    })
  );

  const deleteMutation = useMutation(
    trpc.tasks.delete.mutationOptions({
      onSuccess: () => {
        toast.success(t("taskDeleted"));
        invalidateTasks();
        onOpenChange(false);
        setShowDeleteConfirm(false);
      },
    })
  );

  const handleSubmit = (data: TaskFormData) => {
    if (isEditing && taskId) {
      updateMutation.mutate({
        id: taskId,
        title: data.title,
        description: data.description,
        priority: data.priority,
        recurrenceRule: data.recurrenceRule ?? null,
        assigneeIds: data.assigneeIds,
      });
    } else {
      createMutation.mutate({
        title: data.title,
        description: data.description,
        priority: data.priority,
        recurrenceRule: data.recurrenceRule,
        assigneeIds: data.assigneeIds,
      });
    }
  };

  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    if (!taskId) return;
    deleteMutation.mutate({ id: taskId });
  };

  const initialData = task
    ? {
        title: task.title,
        description: task.description ?? undefined,
        priority: task.priority as TaskPriority,
        recurrenceRule: task.recurrenceRule ?? undefined,
        assigneeIds: task.assignees.map(
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
              {isEditing ? t("editTask") : t("newTask")}
            </DialogTitle>
          </DialogHeader>

          {isEditing && isLoading ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-muted-foreground">{t("taskDetails")}...</p>
            </div>
          ) : (
            <TaskForm
              key={taskId ?? "new"}
              initialData={initialData}
              onSubmit={handleSubmit}
              isSubmitting={
                createMutation.isPending || updateMutation.isPending
              }
              submitLabel={isEditing ? t("editTask") : t("newTask")}
            />
          )}

          {/* Delete button for edit mode */}
          {isEditing && task && (
            <div className="border-t pt-3">
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="w-full"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t("deleteTask")}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
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
              {t("deleteTask")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
