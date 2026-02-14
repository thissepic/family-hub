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
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Trash2, Cloud, MapPin, Clock, Users } from "lucide-react";
import { format } from "date-fns";
import { EventForm, type EventFormData } from "./event-form";
import { CategoryBadge } from "./category-badge";
import type { CalendarEventCategory } from "@/lib/calendar/constants";

interface EventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId?: string | null;
  defaultDate?: Date;
  instanceDate?: Date | null;
  isRecurringInstance?: boolean;
}

export function EventDialog({
  open,
  onOpenChange,
  eventId,
  defaultDate,
  instanceDate,
  isRecurringInstance,
}: EventDialogProps) {
  const t = useTranslations("calendar");
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [editMode, setEditMode] = useState<"THIS" | "ALL">("ALL");
  const [deleteMode, setDeleteMode] = useState<"THIS" | "ALL">("ALL");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRecurringChoice, setShowRecurringChoice] = useState(false);

  const isEditing = !!eventId;

  const { data: event, isLoading } = useQuery(
    trpc.calendar.getById.queryOptions(
      { id: eventId! },
      { enabled: !!eventId && open }
    )
  );

  const invalidateCalendar = () => {
    queryClient.invalidateQueries({ queryKey: [["calendar"]] });
  };

  const createMutation = useMutation(
    trpc.calendar.create.mutationOptions({
      onSuccess: () => {
        toast.success(t("eventCreated"));
        invalidateCalendar();
        onOpenChange(false);
      },
    })
  );

  const updateMutation = useMutation(
    trpc.calendar.update.mutationOptions({
      onSuccess: () => {
        toast.success(t("eventUpdated"));
        invalidateCalendar();
        onOpenChange(false);
      },
    })
  );

  const deleteMutation = useMutation(
    trpc.calendar.delete.mutationOptions({
      onSuccess: () => {
        toast.success(t("eventDeleted"));
        invalidateCalendar();
        onOpenChange(false);
        setShowDeleteConfirm(false);
      },
    })
  );

  const handleSubmit = (data: EventFormData) => {
    if (isEditing && eventId) {
      updateMutation.mutate({
        id: eventId,
        title: data.title,
        description: data.description || undefined,
        location: data.location || undefined,
        startAt: data.startAt,
        endAt: data.endAt,
        allDay: data.allDay,
        recurrenceRule: data.recurrenceRule ?? null,
        category: data.category,
        assigneeIds: data.assigneeIds,
        editMode: isRecurringInstance ? editMode : "ALL",
        instanceDate: instanceDate ?? undefined,
      });
    } else {
      createMutation.mutate({
        title: data.title,
        description: data.description || undefined,
        location: data.location || undefined,
        startAt: data.startAt,
        endAt: data.endAt,
        allDay: data.allDay,
        recurrenceRule: data.recurrenceRule,
        category: data.category,
        assigneeIds: data.assigneeIds,
      });
    }
  };

  const handleDelete = () => {
    if (!eventId) return;

    if (isRecurringInstance && event?.recurrenceRule) {
      setShowRecurringChoice(true);
    } else {
      setShowDeleteConfirm(true);
    }
  };

  const confirmDelete = () => {
    if (!eventId) return;
    deleteMutation.mutate({
      id: eventId,
      deleteMode: isRecurringInstance ? deleteMode : "ALL",
      instanceDate: instanceDate ?? undefined,
    });
  };

  const initialData = event
    ? {
        title: event.title,
        description: event.description ?? "",
        location: event.location ?? "",
        startAt: instanceDate ?? event.startAt,
        endAt: instanceDate
          ? new Date(
              instanceDate.getTime() +
                (event.endAt.getTime() - event.startAt.getTime())
            )
          : event.endAt,
        allDay: event.allDay,
        recurrenceRule: event.recurrenceRule ?? undefined,
        category: event.category as CalendarEventCategory,
        assigneeIds: event.assignees.map((a) => a.member.id),
      }
    : undefined;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {isEditing
                ? event?.isReadOnly
                  ? t("eventDetails")
                  : t("editEvent")
                : t("newEvent")}
            </DialogTitle>
          </DialogHeader>

          {/* Read-only view for synced events */}
          {isEditing && event?.isReadOnly ? (
            <div className="space-y-4">
              {/* Source badge */}
              <Badge
                variant="secondary"
                className="gap-1.5"
              >
                <Cloud className="h-3 w-3" />
                {t("syncedFrom", {
                  source:
                    event.source === "GOOGLE"
                      ? "Google Calendar"
                      : event.source,
                })}
              </Badge>

              {/* Title */}
              <h3 className="text-lg font-semibold">{event.title}</h3>

              {/* Time */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>
                  {event.allDay
                    ? format(event.startAt, "PPP")
                    : `${format(event.startAt, "PPP p")} – ${format(
                        event.endAt,
                        "p"
                      )}`}
                </span>
              </div>

              {/* Location */}
              {event.location && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span>{event.location}</span>
                </div>
              )}

              {/* Description */}
              {event.description && (
                <p className="text-sm whitespace-pre-wrap">
                  {event.description}
                </p>
              )}

              {/* Category */}
              <CategoryBadge
                category={event.category as CalendarEventCategory}
              />

              {/* Assignees */}
              {event.assignees.length > 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>
                    {event.assignees
                      .map((a) => a.member.name)
                      .join(", ")}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Recurring event edit mode selector */}
              {isEditing && isRecurringInstance && event?.recurrenceRule && (
                <div className="space-y-2 rounded-md border p-3">
                  <Label className="text-sm font-medium">
                    {t("editRecurringTitle")}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {t("editRecurringDescription")}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={editMode === "THIS" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setEditMode("THIS")}
                      className="flex-1"
                    >
                      {t("editThis")}
                    </Button>
                    <Button
                      type="button"
                      variant={editMode === "ALL" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setEditMode("ALL")}
                      className="flex-1"
                    >
                      {t("editAll")}
                    </Button>
                  </div>
                </div>
              )}

              {isEditing && isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <p className="text-muted-foreground">
                    {t("eventDetails")}...
                  </p>
                </div>
              ) : (
                <EventForm
                  initialData={initialData}
                  defaultDate={defaultDate}
                  onSubmit={handleSubmit}
                  isSubmitting={
                    createMutation.isPending || updateMutation.isPending
                  }
                  submitLabel={isEditing ? t("editEvent") : t("newEvent")}
                />
              )}

              {/* Delete button for edit mode */}
              {isEditing && event && !event.isReadOnly && (
                <div className="border-t pt-3">
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={deleteMutation.isPending}
                    className="w-full"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {t("deleteEvent")}
                  </Button>
                </div>
              )}
            </>
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
            <AlertDialogCancel>{t("cancel") ?? "Cancel"}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>
              {t("deleteEvent")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Recurring Delete Choice Dialog */}
      <AlertDialog open={showRecurringChoice} onOpenChange={setShowRecurringChoice}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteRecurringTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteRecurringDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-2 py-2">
            <Button
              type="button"
              variant={deleteMode === "THIS" ? "default" : "outline"}
              size="sm"
              onClick={() => setDeleteMode("THIS")}
              className="flex-1"
            >
              {t("deleteThis")}
            </Button>
            <Button
              type="button"
              variant={deleteMode === "ALL" ? "default" : "outline"}
              size="sm"
              onClick={() => setDeleteMode("ALL")}
              className="flex-1"
            >
              {t("deleteAll")}
            </Button>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel") ?? "Cancel"}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>
              {t("deleteEvent")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
