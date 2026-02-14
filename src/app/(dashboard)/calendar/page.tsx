"use client";

import { useState, useCallback, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CalendarView } from "@/components/calendar/calendar-view";
import { EventDialog } from "@/components/calendar/event-dialog";
import { MemberFilter } from "@/components/calendar/member-filter";
import { ImportExport } from "@/components/calendar/import-export";

export default function CalendarPage() {
  const t = useTranslations("calendar");

  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [instanceDate, setInstanceDate] = useState<Date | null>(null);
  const [isRecurringInstance, setIsRecurringInstance] = useState(false);

  // Auto-open new event dialog from command palette (?new=1)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("new") === "1") {
      setSelectedEventId(null);
      setSelectedDate(new Date());
      setIsRecurringInstance(false);
      setInstanceDate(null);
      setDialogOpen(true);
      window.history.replaceState({}, "", "/calendar");
    }
  }, []);

  const handleEventClick = useCallback(
    (eventId: string, isRecurring: boolean, instDate: Date | null) => {
      setSelectedEventId(eventId);
      setSelectedDate(undefined);
      setIsRecurringInstance(isRecurring);
      setInstanceDate(instDate);
      setDialogOpen(true);
    },
    []
  );

  const handleDateClick = useCallback((date: Date) => {
    setSelectedEventId(null);
    setSelectedDate(date);
    setIsRecurringInstance(false);
    setInstanceDate(null);
    setDialogOpen(true);
  }, []);

  const handleNewEvent = () => {
    setSelectedEventId(null);
    setSelectedDate(new Date());
    setIsRecurringInstance(false);
    setInstanceDate(null);
    setDialogOpen(true);
  };

  const handleDialogChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setSelectedEventId(null);
      setSelectedDate(undefined);
      setIsRecurringInstance(false);
      setInstanceDate(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <div className="flex items-center gap-2">
          <ImportExport />
          <Button onClick={handleNewEvent} size="sm">
            <Plus className="mr-1.5 h-4 w-4" />
            {t("newEvent")}
          </Button>
        </div>
      </div>

      {/* Member Filter */}
      <MemberFilter
        selectedMemberIds={selectedMemberIds}
        onChange={setSelectedMemberIds}
      />

      {/* Calendar */}
      <CalendarView
        selectedMemberIds={selectedMemberIds}
        onEventClick={handleEventClick}
        onDateClick={handleDateClick}
      />

      {/* Event Dialog */}
      <EventDialog
        open={dialogOpen}
        onOpenChange={handleDialogChange}
        eventId={selectedEventId}
        defaultDate={selectedDate}
        instanceDate={instanceDate}
        isRecurringInstance={isRecurringInstance}
      />
    </div>
  );
}
