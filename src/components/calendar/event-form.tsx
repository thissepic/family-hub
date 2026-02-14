"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { RecurrencePicker } from "./recurrence-picker";
import { ConflictIndicator } from "./conflict-indicator";
import {
  CATEGORIES,
  CATEGORY_COLORS,
  CATEGORY_ICONS,
  type CalendarEventCategory,
} from "@/lib/calendar/constants";
import { cn } from "@/lib/utils";

const CATEGORY_KEYS: Record<CalendarEventCategory, string> = {
  SCHOOL: "categorySchool",
  WORK: "categoryWork",
  MEDICAL: "categoryMedical",
  SPORTS: "categorySports",
  SOCIAL: "categorySocial",
  FAMILY: "categoryFamily",
  OTHER: "categoryOther",
};

// Generate time options in 15-minute increments
function generateTimeOptions() {
  const options: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      options.push(
        `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`
      );
    }
  }
  return options;
}

const TIME_OPTIONS = generateTimeOptions();

export interface EventFormData {
  title: string;
  description: string;
  location: string;
  startAt: Date;
  endAt: Date;
  allDay: boolean;
  recurrenceRule: string | undefined;
  category: CalendarEventCategory;
  assigneeIds: string[];
}

interface EventFormProps {
  initialData?: Partial<EventFormData>;
  defaultDate?: Date;
  onSubmit: (data: EventFormData) => void;
  isSubmitting?: boolean;
  submitLabel?: string;
}

export function EventForm({
  initialData,
  defaultDate,
  onSubmit,
  isSubmitting,
  submitLabel,
}: EventFormProps) {
  const t = useTranslations("calendar");
  const tCommon = useTranslations("common");
  const trpc = useTRPC();

  const defaultStart = initialData?.startAt ?? defaultDate ?? new Date();
  const defaultEnd =
    initialData?.endAt ??
    new Date(defaultStart.getTime() + 60 * 60 * 1000);

  const [title, setTitle] = useState(initialData?.title ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [location, setLocation] = useState(initialData?.location ?? "");
  const [startDate, setStartDate] = useState<Date>(defaultStart);
  const [endDate, setEndDate] = useState<Date>(defaultEnd);
  const [startTime, setStartTime] = useState(format(defaultStart, "HH:mm"));
  const [endTime, setEndTime] = useState(format(defaultEnd, "HH:mm"));
  const [allDay, setAllDay] = useState(initialData?.allDay ?? false);
  const [recurrenceRule, setRecurrenceRule] = useState<string | undefined>(
    initialData?.recurrenceRule
  );
  const [category, setCategory] = useState<CalendarEventCategory>(
    initialData?.category ?? "OTHER"
  );
  const [assigneeIds, setAssigneeIds] = useState<string[]>(
    initialData?.assigneeIds ?? []
  );

  const { data: members } = useQuery(trpc.members.list.queryOptions());

  // Build full dates from date + time
  const buildDateTime = useCallback((date: Date, time: string): Date => {
    const [hours, minutes] = time.split(":").map(Number);
    const result = new Date(date);
    result.setHours(hours, minutes, 0, 0);
    return result;
  }, []);

  const fullStart = allDay
    ? new Date(startDate.setHours(0, 0, 0, 0))
    : buildDateTime(startDate, startTime);
  const fullEnd = allDay
    ? new Date(endDate.setHours(23, 59, 59, 999))
    : buildDateTime(endDate, endTime);

  // Conflict detection
  const { data: conflicts } = useQuery(
    trpc.calendar.getConflicts.queryOptions(
      {
        startAt: fullStart,
        endAt: fullEnd,
        memberIds: assigneeIds,
        excludeEventId: undefined,
      },
      {
        enabled: assigneeIds.length > 0 && !allDay,
      }
    )
  );

  // When start date changes, ensure end date is not before it
  useEffect(() => {
    if (endDate < startDate) {
      setEndDate(startDate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || assigneeIds.length === 0) return;

    onSubmit({
      title: title.trim(),
      description: description.trim(),
      location: location.trim(),
      startAt: fullStart,
      endAt: fullEnd,
      allDay,
      recurrenceRule,
      category,
      assigneeIds,
    });
  };

  const toggleAssignee = (memberId: string) => {
    setAssigneeIds((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    );
  };

  // Find closest time option
  const findClosestTime = (time: string) => {
    const [h, m] = time.split(":").map(Number);
    const totalMinutes = h * 60 + m;
    const rounded = Math.round(totalMinutes / 15) * 15;
    const rh = Math.floor(rounded / 60) % 24;
    const rm = rounded % 60;
    return `${rh.toString().padStart(2, "0")}:${rm.toString().padStart(2, "0")}`;
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Title */}
      <div className="space-y-1.5">
        <Label htmlFor="event-title">{t("eventTitle")}</Label>
        <Input
          id="event-title"
          placeholder={t("eventTitlePlaceholder")}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
          required
        />
      </div>

      {/* All Day Toggle */}
      <div className="flex items-center gap-2">
        <Switch
          id="all-day"
          checked={allDay}
          onCheckedChange={setAllDay}
        />
        <Label htmlFor="all-day">{t("allDay")}</Label>
      </div>

      {/* Date/Time */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>{t("startDate")}</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(startDate, "PPP")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={startDate}
                onSelect={(d) => d && setStartDate(d)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          {!allDay && (
            <Select
              value={findClosestTime(startTime)}
              onValueChange={setStartTime}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {TIME_OPTIONS.map((time) => (
                  <SelectItem key={time} value={time}>
                    {time}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>{t("endDate")}</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(endDate, "PPP")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={endDate}
                onSelect={(d) => d && setEndDate(d)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          {!allDay && (
            <Select
              value={findClosestTime(endTime)}
              onValueChange={setEndTime}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {TIME_OPTIONS.map((time) => (
                  <SelectItem key={time} value={time}>
                    {time}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Conflict Warning */}
      {conflicts && conflicts.length > 0 && (
        <ConflictIndicator conflicts={conflicts} />
      )}

      {/* Location */}
      <div className="space-y-1.5">
        <Label htmlFor="event-location">{t("location")}</Label>
        <Input
          id="event-location"
          placeholder={t("locationPlaceholder")}
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label htmlFor="event-description">{t("description")}</Label>
        <Textarea
          id="event-description"
          placeholder={t("descriptionPlaceholder")}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />
      </div>

      {/* Category */}
      <div className="space-y-1.5">
        <Label>{t("category")}</Label>
        <Select value={category} onValueChange={(v) => setCategory(v as CalendarEventCategory)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((cat) => {
              const Icon = CATEGORY_ICONS[cat];
              return (
                <SelectItem key={cat} value={cat}>
                  <div className="flex items-center gap-2">
                    <Icon
                      className="h-4 w-4"
                      style={{ color: CATEGORY_COLORS[cat] }}
                    />
                    {t(CATEGORY_KEYS[cat])}
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {/* Assignees */}
      <div className="space-y-1.5">
        <Label>{t("assignees")}</Label>
        <div className="space-y-2">
          {members?.map((member) => (
            <label
              key={member.id}
              className="flex items-center gap-2 cursor-pointer"
            >
              <Checkbox
                checked={assigneeIds.includes(member.id)}
                onCheckedChange={() => toggleAssignee(member.id)}
              />
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: member.color }}
              />
              <span className="text-sm">{member.name}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Recurrence */}
      <div className="space-y-1.5">
        <Label>{t("recurrence")}</Label>
        <RecurrencePicker
          value={recurrenceRule}
          onChange={setRecurrenceRule}
          eventStartDate={startDate}
        />
      </div>

      {/* Submit */}
      <Button
        type="submit"
        className="w-full"
        disabled={!title.trim() || assigneeIds.length === 0 || isSubmitting}
      >
        {isSubmitting ? tCommon("loading") : submitLabel ?? tCommon("save")}
      </Button>
    </form>
  );
}
