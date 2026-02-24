"use client";

import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Clock, Bell } from "lucide-react";

const PRESET_REMINDERS = [
  { value: 5, key: "reminder5min" },
  { value: 15, key: "reminder15min" },
  { value: 30, key: "reminder30min" },
  { value: 60, key: "reminder1hour" },
  { value: 120, key: "reminder2hours" },
  { value: 1440, key: "reminder1day" },
  { value: 2880, key: "reminder2days" },
  { value: 10080, key: "reminder1week" },
  { value: 43200, key: "reminder1month" },
] as const;

type CustomUnit = "minutes" | "hours" | "days";

interface TimeTogglePickerProps {
  dueTime: string | undefined;
  onDueTimeChange: (time: string | undefined) => void;
  reminderMinutesBefore: number | undefined;
  onReminderChange: (minutes: number | undefined) => void;
  t: (key: string) => string;
}

function isPresetValue(value: number): boolean {
  return PRESET_REMINDERS.some((p) => p.value === value);
}

function minutesToCustom(minutes: number): { amount: number; unit: CustomUnit } {
  if (minutes >= 1440 && minutes % 1440 === 0) {
    return { amount: minutes / 1440, unit: "days" };
  }
  if (minutes >= 60 && minutes % 60 === 0) {
    return { amount: minutes / 60, unit: "hours" };
  }
  return { amount: minutes, unit: "minutes" };
}

function customToMinutes(amount: number, unit: CustomUnit): number {
  switch (unit) {
    case "days":
      return amount * 1440;
    case "hours":
      return amount * 60;
    default:
      return amount;
  }
}

export function TimeTogglePicker({
  dueTime,
  onDueTimeChange,
  reminderMinutesBefore,
  onReminderChange,
  t,
}: TimeTogglePickerProps) {
  const enabled = !!dueTime;

  // Custom reminder state
  const isCustom = reminderMinutesBefore != null && !isPresetValue(reminderMinutesBefore);
  const initialCustom = isCustom ? minutesToCustom(reminderMinutesBefore!) : { amount: 15, unit: "minutes" as CustomUnit };
  const [customAmount, setCustomAmount] = useState<string>(String(initialCustom.amount));
  const [customUnit, setCustomUnit] = useState<CustomUnit>(initialCustom.unit);
  const [selectValue, setSelectValue] = useState<string>(
    reminderMinutesBefore == null
      ? "none"
      : isCustom
        ? "custom"
        : String(reminderMinutesBefore)
  );

  // Sync select value when props change
  useEffect(() => {
    if (reminderMinutesBefore == null) {
      setSelectValue("none");
    } else if (isPresetValue(reminderMinutesBefore)) {
      setSelectValue(String(reminderMinutesBefore));
    } else {
      setSelectValue("custom");
      const { amount, unit } = minutesToCustom(reminderMinutesBefore);
      setCustomAmount(String(amount));
      setCustomUnit(unit);
    }
  }, [reminderMinutesBefore]);

  const handleToggle = (checked: boolean) => {
    if (checked) {
      onDueTimeChange("09:00");
    } else {
      onDueTimeChange(undefined);
      onReminderChange(undefined);
    }
  };

  const handleReminderSelect = (value: string) => {
    setSelectValue(value);
    if (value === "none") {
      onReminderChange(undefined);
    } else if (value === "custom") {
      const mins = customToMinutes(parseInt(customAmount) || 15, customUnit);
      onReminderChange(mins);
    } else {
      onReminderChange(parseInt(value));
    }
  };

  const handleCustomAmountChange = (value: string) => {
    setCustomAmount(value);
    const num = parseInt(value);
    if (num > 0) {
      onReminderChange(customToMinutes(num, customUnit));
    }
  };

  const handleCustomUnitChange = (unit: CustomUnit) => {
    setCustomUnit(unit);
    const num = parseInt(customAmount);
    if (num > 0) {
      onReminderChange(customToMinutes(num, unit));
    }
  };

  return (
    <div className="space-y-3">
      {/* Time toggle */}
      <div className="flex items-center gap-2">
        <Switch
          id="due-time-toggle"
          checked={enabled}
          onCheckedChange={handleToggle}
        />
        <Label htmlFor="due-time-toggle" className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          {t("dueTime")}
        </Label>
      </div>

      {/* Time picker (expanded when toggled on) */}
      {enabled && (
        <div className="space-y-3 pl-6 animate-in slide-in-from-top-1 duration-200">
          <Input
            type="time"
            value={dueTime}
            onChange={(e) => onDueTimeChange(e.target.value || "09:00")}
            className="w-36"
          />

          {/* Early reminder */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-sm">
              <Bell className="h-3.5 w-3.5" />
              {t("earlyReminder")}
            </Label>
            <Select value={selectValue} onValueChange={handleReminderSelect}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("noReminder")}</SelectItem>
                {PRESET_REMINDERS.map((preset) => (
                  <SelectItem key={preset.value} value={String(preset.value)}>
                    {t(preset.key)}
                  </SelectItem>
                ))}
                <SelectItem value="custom">{t("reminderCustom")}</SelectItem>
              </SelectContent>
            </Select>

            {/* Custom input */}
            {selectValue === "custom" && (
              <div className="flex gap-2 animate-in slide-in-from-top-1 duration-150">
                <Input
                  type="number"
                  min={1}
                  max={9999}
                  value={customAmount}
                  onChange={(e) => handleCustomAmountChange(e.target.value)}
                  className="w-20"
                />
                <Select value={customUnit} onValueChange={(v) => handleCustomUnitChange(v as CustomUnit)}>
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="minutes">{t("reminderMinutes")}</SelectItem>
                    <SelectItem value="hours">{t("reminderHours")}</SelectItem>
                    <SelectItem value="days">{t("reminderDays")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
