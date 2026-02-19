"use client";

import { useState, useEffect, useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import { RRule, type Weekday } from "rrule";
import { format } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface RecurrencePickerProps {
  value: string | undefined;
  onChange: (rule: string | undefined) => void;
  eventStartDate: Date;
}

type PresetKey = "none" | "daily" | "weekly" | "monthly" | "yearly" | "weekdays" | "custom";

const WEEKDAY_MAP: Record<number, Weekday> = {
  0: RRule.MO,
  1: RRule.TU,
  2: RRule.WE,
  3: RRule.TH,
  4: RRule.FR,
  5: RRule.SA,
  6: RRule.SU,
};

export function RecurrencePicker({
  value,
  onChange,
  eventStartDate,
}: RecurrencePickerProps) {
  const t = useTranslations("calendar");
  const locale = useLocale();

  const DAY_LABELS = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { weekday: "short" });
    // Jan 5, 2026 is a Monday
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(2026, 0, 5 + i);
      return fmt.format(d).slice(0, 2);
    });
  }, [locale]);

  // Parse an RRULE string into its parts for custom mode initialization
  const parseRuleParts = (rule: string) => {
    const ruleStr = rule
      .split("\n")
      .find((l) => l.includes("FREQ="))
      ?.replace(/^(RRULE:)+/, "") ?? rule.replace(/^(RRULE:)+/, "");
    const parts = Object.fromEntries(
      ruleStr.split(";").map((p) => {
        const [k, v] = p.split("=");
        return [k, v];
      })
    );
    return parts;
  };

  // Determine initial state from the value prop (runs once on mount)
  const getInitialState = () => {
    if (!value) {
      return { preset: "none" as PresetKey, isCustom: false, freq: RRule.WEEKLY, interval: 1, byWeekday: [] as number[], endType: "never" as const, count: 10, until: undefined as Date | undefined };
    }
    const ruleStr = value
      .split("\n")
      .find((l) => l.includes("FREQ="))
      ?.replace(/^(RRULE:)+/, "") ?? value.replace(/^(RRULE:)+/, "");

    if (ruleStr === "FREQ=DAILY") {
      return { preset: "daily" as PresetKey, isCustom: false, freq: RRule.DAILY, interval: 1, byWeekday: [] as number[], endType: "never" as const, count: 10, until: undefined as Date | undefined };
    }
    if (/^FREQ=WEEKLY;BYDAY=[A-Z]{2}$/.test(ruleStr)) {
      return { preset: "weekly" as PresetKey, isCustom: false, freq: RRule.WEEKLY, interval: 1, byWeekday: [] as number[], endType: "never" as const, count: 10, until: undefined as Date | undefined };
    }
    if (ruleStr === "FREQ=MONTHLY") {
      return { preset: "monthly" as PresetKey, isCustom: false, freq: RRule.MONTHLY, interval: 1, byWeekday: [] as number[], endType: "never" as const, count: 10, until: undefined as Date | undefined };
    }
    if (ruleStr === "FREQ=YEARLY") {
      return { preset: "yearly" as PresetKey, isCustom: false, freq: RRule.YEARLY, interval: 1, byWeekday: [] as number[], endType: "never" as const, count: 10, until: undefined as Date | undefined };
    }
    if (ruleStr === "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR") {
      return { preset: "weekdays" as PresetKey, isCustom: false, freq: RRule.WEEKLY, interval: 1, byWeekday: [] as number[], endType: "never" as const, count: 10, until: undefined as Date | undefined };
    }
    // Custom rule - parse its parts
    const parts = parseRuleParts(value);
    const FREQ_MAP: Record<string, number> = { DAILY: RRule.DAILY, WEEKLY: RRule.WEEKLY, MONTHLY: RRule.MONTHLY, YEARLY: RRule.YEARLY };
    const BYDAY_TO_INDEX: Record<string, number> = { MO: 0, TU: 1, WE: 2, TH: 3, FR: 4, SA: 5, SU: 6 };
    const parsedFreq = FREQ_MAP[parts.FREQ] ?? RRule.WEEKLY;
    const parsedInterval = parts.INTERVAL ? parseInt(parts.INTERVAL) : 1;
    const parsedByWeekday = parts.BYDAY ? parts.BYDAY.split(",").map((d: string) => BYDAY_TO_INDEX[d] ?? 0) : [];
    let parsedEndType: "never" | "count" | "until" = "never";
    let parsedCount = 10;
    let parsedUntil: Date | undefined;
    if (parts.COUNT) { parsedEndType = "count"; parsedCount = parseInt(parts.COUNT); }
    if (parts.UNTIL) { parsedEndType = "until"; parsedUntil = new Date(parts.UNTIL.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3")); }

    return { preset: "custom" as PresetKey, isCustom: true, freq: parsedFreq, interval: parsedInterval, byWeekday: parsedByWeekday, endType: parsedEndType, count: parsedCount, until: parsedUntil };
  };

  const initial = getInitialState();
  const [preset, setPreset] = useState<PresetKey>(initial.preset);
  const [isCustom, setIsCustom] = useState(initial.isCustom);
  const [freq, setFreq] = useState<number>(initial.freq);
  const [interval, setInterval] = useState(initial.interval);
  const [byWeekday, setByWeekday] = useState<number[]>(initial.byWeekday);
  const [endType, setEndType] = useState<"never" | "count" | "until">(initial.endType);
  const [count, setCount] = useState(initial.count);
  const [until, setUntil] = useState<Date | undefined>(initial.until);

  // Track the value we're syncing from to avoid reacting to our own changes
  const [lastSyncedValue, setLastSyncedValue] = useState(value);

  // Determine the day of week for the event start date (0=Mon..6=Sun)
  const startDayOfWeek = (eventStartDate.getDay() + 6) % 7; // JS: 0=Sun, convert to 0=Mon
  const dayName = format(eventStartDate, "EEEE");

  // Sync state when the value prop changes externally (e.g. parent loaded data)
  useEffect(() => {
    // Skip if value hasn't actually changed (avoids infinite loops)
    if (value === lastSyncedValue) return;
    setLastSyncedValue(value);

    if (!value) {
      setPreset("none");
      setIsCustom(false);
      return;
    }

    const ruleStr = value
      .split("\n")
      .find((l) => l.includes("FREQ="))
      ?.replace(/^(RRULE:)+/, "") ?? value.replace(/^(RRULE:)+/, "");

    if (ruleStr === "FREQ=DAILY") {
      setPreset("daily");
      setIsCustom(false);
    } else if (/^FREQ=WEEKLY;BYDAY=[A-Z]{2}$/.test(ruleStr)) {
      setPreset("weekly");
      setIsCustom(false);
    } else if (ruleStr === "FREQ=MONTHLY") {
      setPreset("monthly");
      setIsCustom(false);
    } else if (ruleStr === "FREQ=YEARLY") {
      setPreset("yearly");
      setIsCustom(false);
    } else if (ruleStr === "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR") {
      setPreset("weekdays");
      setIsCustom(false);
    } else {
      // Custom rule - parse and populate all custom fields
      const parts = parseRuleParts(value);
      const FREQ_MAP: Record<string, number> = { DAILY: RRule.DAILY, WEEKLY: RRule.WEEKLY, MONTHLY: RRule.MONTHLY, YEARLY: RRule.YEARLY };
      const BYDAY_TO_INDEX: Record<string, number> = { MO: 0, TU: 1, WE: 2, TH: 3, FR: 4, SA: 5, SU: 6 };
      setPreset("custom");
      setIsCustom(true);
      setFreq(FREQ_MAP[parts.FREQ] ?? RRule.WEEKLY);
      setInterval(parts.INTERVAL ? parseInt(parts.INTERVAL) : 1);
      setByWeekday(parts.BYDAY ? parts.BYDAY.split(",").map((d: string) => BYDAY_TO_INDEX[d] ?? 0) : []);
      if (parts.COUNT) { setEndType("count"); setCount(parseInt(parts.COUNT)); }
      else if (parts.UNTIL) { setEndType("until"); setUntil(new Date(parts.UNTIL.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3"))); }
      else { setEndType("never"); }
    }
  }, [value, lastSyncedValue]);

  // Helper to call onChange and track the value to prevent re-sync loops
  const emitChange = (newValue: string | undefined) => {
    setLastSyncedValue(newValue);
    onChange(newValue);
  };

  const handlePresetChange = (newPreset: PresetKey) => {
    setPreset(newPreset);
    setIsCustom(false);

    switch (newPreset) {
      case "none":
        emitChange(undefined);
        break;
      case "daily":
        emitChange("RRULE:FREQ=DAILY");
        break;
      case "weekly": {
        const dayAbbr = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"][eventStartDate.getDay()];
        emitChange(`RRULE:FREQ=WEEKLY;BYDAY=${dayAbbr}`);
        break;
      }
      case "monthly":
        emitChange("RRULE:FREQ=MONTHLY");
        break;
      case "yearly":
        emitChange("RRULE:FREQ=YEARLY");
        break;
      case "weekdays":
        emitChange("RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR");
        break;
      case "custom":
        setIsCustom(true);
        setFreq(RRule.WEEKLY);
        setInterval(1);
        setByWeekday([startDayOfWeek]);
        setEndType("never");
        buildCustomRule(RRule.WEEKLY, 1, [startDayOfWeek], "never", 10, undefined);
        break;
    }
  };

  const buildCustomRule = (
    f: number,
    intv: number,
    bwd: number[],
    et: "never" | "count" | "until",
    c: number,
    u: Date | undefined
  ) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const options: Record<string, any> = {
      freq: f,
      interval: intv,
      dtstart: eventStartDate,
    };

    if (f === RRule.WEEKLY && bwd.length > 0) {
      options.byweekday = bwd.map((d) => WEEKDAY_MAP[d]);
    }

    if (et === "count") {
      options.count = c;
    } else if (et === "until" && u) {
      options.until = u;
    }

    const rule = new RRule(options);
    // RRule.toString() may include "DTSTART:...\nRRULE:FREQ=..." when dtstart is set.
    // Extract only the RRULE portion.
    const fullStr = rule.toString();
    const rruleLine = fullStr.split("\n").find((l) => l.startsWith("RRULE:")) ?? fullStr;
    const ruleBody = rruleLine.replace(/^RRULE:/, "");
    emitChange(`RRULE:${ruleBody}`);
  };

  const updateCustom = (updates: {
    freq?: number;
    interval?: number;
    byWeekday?: number[];
    endType?: "never" | "count" | "until";
    count?: number;
    until?: Date | undefined;
  }) => {
    const newFreq = updates.freq ?? freq;
    const newInterval = updates.interval ?? interval;
    const newByWeekday = updates.byWeekday ?? byWeekday;
    const newEndType = updates.endType ?? endType;
    const newCount = updates.count ?? count;
    const newUntil = updates.until !== undefined ? updates.until : until;

    if (updates.freq !== undefined) setFreq(newFreq);
    if (updates.interval !== undefined) setInterval(newInterval);
    if (updates.byWeekday !== undefined) setByWeekday(newByWeekday);
    if (updates.endType !== undefined) setEndType(newEndType);
    if (updates.count !== undefined) setCount(newCount);
    if (updates.until !== undefined) setUntil(newUntil);

    buildCustomRule(newFreq, newInterval, newByWeekday, newEndType, newCount, newUntil);
  };

  const toggleDay = (dayIndex: number) => {
    const newDays = byWeekday.includes(dayIndex)
      ? byWeekday.filter((d) => d !== dayIndex)
      : [...byWeekday, dayIndex].sort();
    updateCustom({ byWeekday: newDays });
  };

  return (
    <div className="space-y-3">
      <Select value={preset} onValueChange={(v) => handlePresetChange(v as PresetKey)}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">{t("noRepeat")}</SelectItem>
          <SelectItem value="daily">{t("daily")}</SelectItem>
          <SelectItem value="weekly">{t("weeklyOn", { day: dayName })}</SelectItem>
          <SelectItem value="monthly">{t("monthly")}</SelectItem>
          <SelectItem value="yearly">{t("yearly")}</SelectItem>
          <SelectItem value="weekdays">{t("weekdays")}</SelectItem>
          <SelectItem value="custom">{t("custom")}</SelectItem>
        </SelectContent>
      </Select>

      {isCustom && (
        <div className="space-y-3 rounded-md border p-3">
          <div className="flex items-center gap-2">
            <Label className="shrink-0">{t("every")}</Label>
            <Input
              type="number"
              min={1}
              max={99}
              value={interval}
              onChange={(e) => updateCustom({ interval: parseInt(e.target.value) || 1 })}
              className="w-16"
            />
            <Select
              value={String(freq)}
              onValueChange={(v) => updateCustom({ freq: parseInt(v) })}
            >
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={String(RRule.DAILY)}>{t("days")}</SelectItem>
                <SelectItem value={String(RRule.WEEKLY)}>{t("weeks")}</SelectItem>
                <SelectItem value={String(RRule.MONTHLY)}>{t("months")}</SelectItem>
                <SelectItem value={String(RRule.YEARLY)}>{t("years")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {freq === RRule.WEEKLY && (
            <div className="space-y-1.5">
              <Label>{t("repeatOn")}</Label>
              <div className="flex gap-1">
                {DAY_LABELS.map((label, i) => (
                  <Button
                    key={i}
                    type="button"
                    variant={byWeekday.includes(i) ? "default" : "outline"}
                    size="sm"
                    className="h-8 w-8 p-0 text-xs"
                    onClick={() => toggleDay(i)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>{t("ends")}</Label>
            <Select
              value={endType}
              onValueChange={(v) => updateCustom({ endType: v as "never" | "count" | "until" })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="never">{t("never")}</SelectItem>
                <SelectItem value="count">{t("afterOccurrences", { count: String(count) })}</SelectItem>
                <SelectItem value="until">{t("onDate")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {endType === "count" && (
            <Input
              type="number"
              min={1}
              max={365}
              value={count}
              onChange={(e) => updateCustom({ count: parseInt(e.target.value) || 1 })}
            />
          )}

          {endType === "until" && (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !until && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {until ? format(until, "PPP") : t("onDate")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={until}
                  onSelect={(date) => updateCustom({ until: date ?? undefined })}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          )}
        </div>
      )}
    </div>
  );
}
