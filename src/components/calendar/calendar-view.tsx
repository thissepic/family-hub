"use client";

import { useRef, useCallback } from "react";
import { useLocale } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventInput, EventClickArg, EventDropArg } from "@fullcalendar/core";
import type { DateClickArg, EventResizeDoneArg } from "@fullcalendar/interaction";
import { CATEGORY_COLORS, type CalendarEventCategory } from "@/lib/calendar/constants";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Cloud, Lock } from "lucide-react";
import "./calendar-overrides.css";

interface CalendarViewProps {
  selectedMemberIds: string[];
  onEventClick: (eventId: string, isRecurring: boolean, instanceDate: Date | null) => void;
  onDateClick: (date: Date) => void;
}

export function CalendarView({
  selectedMemberIds,
  onEventClick,
  onDateClick,
}: CalendarViewProps) {
  const locale = useLocale();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const calendarRef = useRef<FullCalendar>(null);

  const updateMutation = useMutation(
    trpc.calendar.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [["calendar"]] });
      },
      onError: () => {
        toast.error("Failed to update event");
        // Revert the drag by refetching
        const calendarApi = calendarRef.current?.getApi();
        if (calendarApi) {
          calendarApi.refetchEvents();
        }
      },
    })
  );

  const fetchEvents = useCallback(
    async (
      fetchInfo: { start: Date; end: Date },
      successCallback: (events: EventInput[]) => void,
      failureCallback: (error: Error) => void
    ) => {
      try {
        const result = await queryClient.fetchQuery(
          trpc.calendar.list.queryOptions({
            start: fetchInfo.start,
            end: fetchInfo.end,
            memberIds: selectedMemberIds.length > 0 ? selectedMemberIds : undefined,
          })
        );

        const events: EventInput[] = result.map((event) => {
          // Primary assignee color for background
          const primaryColor =
            event.assignees[0]?.member.color ?? "#6b7280";
          const categoryColor =
            CATEGORY_COLORS[event.category as CalendarEventCategory] ?? "#6b7280";

          return {
            id: event.isRecurringInstance
              ? `${event.id}_${event.startAt.toISOString()}`
              : event.id,
            title: event.title,
            start: event.startAt,
            end: event.endAt,
            allDay: event.allDay,
            backgroundColor: `${primaryColor}20`,
            borderColor: categoryColor,
            textColor: primaryColor,
            extendedProps: {
              eventId: event.id,
              isRecurringInstance: event.isRecurringInstance,
              originalStartAt: event.originalStartAt,
              category: event.category,
              categoryColor,
              assignees: event.assignees,
              location: event.location,
              description: event.description,
              source: event.source,
              isReadOnly: event.isReadOnly,
            },
          };
        });

        successCallback(events);
      } catch (error) {
        failureCallback(error as Error);
      }
    },
    [queryClient, trpc, selectedMemberIds]
  );

  const handleEventClick = useCallback(
    (info: EventClickArg) => {
      const { eventId, isRecurringInstance, originalStartAt } =
        info.event.extendedProps;
      onEventClick(
        eventId,
        isRecurringInstance,
        originalStartAt ? new Date(originalStartAt) : null
      );
    },
    [onEventClick]
  );

  const handleDateClick = useCallback(
    (info: DateClickArg) => {
      onDateClick(info.date);
    },
    [onDateClick]
  );

  const handleEventDrop = useCallback(
    (info: EventDropArg) => {
      const { eventId, isRecurringInstance, originalStartAt } =
        info.event.extendedProps;

      if (isRecurringInstance) {
        // For recurring instances, revert and let user use the dialog
        info.revert();
        onEventClick(
          eventId,
          true,
          originalStartAt ? new Date(originalStartAt) : null
        );
        return;
      }

      updateMutation.mutate({
        id: eventId,
        startAt: info.event.start!,
        endAt: info.event.end ?? info.event.start!,
        editMode: "ALL",
      });
    },
    [updateMutation, onEventClick]
  );

  const handleEventResize = useCallback(
    (info: EventResizeDoneArg) => {
      const { eventId, isRecurringInstance, originalStartAt } =
        info.event.extendedProps;

      if (isRecurringInstance) {
        info.revert();
        onEventClick(
          eventId,
          true,
          originalStartAt ? new Date(originalStartAt) : null
        );
        return;
      }

      updateMutation.mutate({
        id: eventId,
        startAt: info.event.start!,
        endAt: info.event.end ?? info.event.start!,
        editMode: "ALL",
      });
    },
    [updateMutation, onEventClick]
  );

  return (
    <FullCalendar
      ref={calendarRef}
      plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
      initialView="dayGridMonth"
      locale={locale}
      firstDay={1}
      headerToolbar={{
        left: "today prev,next",
        center: "title",
        right: "dayGridMonth,timeGridWeek,timeGridDay,listWeek",
      }}
      events={fetchEvents}
      eventClick={handleEventClick}
      dateClick={handleDateClick}
      eventDrop={handleEventDrop}
      eventResize={handleEventResize}
      editable={true}
      selectable={true}
      selectMirror={true}
      dayMaxEvents={true}
      weekends={true}
      nowIndicator={true}
      height="auto"
      stickyHeaderDates={true}
      eventContent={(eventInfo) => {
        const { assignees, categoryColor, source, isReadOnly } =
          eventInfo.event.extendedProps;
        const isSynced = source && source !== "LOCAL";

        return (
          <div className="flex items-center gap-1 overflow-hidden px-0.5">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: categoryColor }}
            />
            <span className="truncate font-medium">
              {eventInfo.timeText && (
                <span className="mr-1 opacity-70">{eventInfo.timeText}</span>
              )}
              {eventInfo.event.title}
            </span>
            {isSynced && (
              <Cloud className="h-3 w-3 shrink-0 text-muted-foreground opacity-60" />
            )}
            {isReadOnly && !isSynced && (
              <Lock className="h-3 w-3 shrink-0 text-muted-foreground opacity-60" />
            )}
            {assignees && assignees.length > 1 && (
              <div className="flex -space-x-1 ml-auto">
                {assignees.slice(0, 3).map((a: { member: { id: string; color: string } }) => (
                  <span
                    key={a.member.id}
                    className="h-3 w-3 rounded-full border border-background"
                    style={{ backgroundColor: a.member.color }}
                  />
                ))}
              </div>
            )}
          </div>
        );
      }}
    />
  );
}
