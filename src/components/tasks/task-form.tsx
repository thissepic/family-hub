"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RecurrencePicker } from "@/components/calendar/recurrence-picker";
import { TimeTogglePicker } from "@/components/ui/time-toggle-picker";
import { PRIORITIES, PRIORITY_CONFIG } from "@/lib/tasks/constants";
import type { TaskPriority } from "@prisma/client";

export interface TaskFormData {
  title: string;
  description?: string;
  priority: TaskPriority;
  recurrenceRule?: string;
  assigneeIds: string[];
  dueTime?: string;
  reminderMinutesBefore?: number;
}

interface TaskFormProps {
  initialData?: Partial<TaskFormData>;
  onSubmit: (data: TaskFormData) => void;
  isSubmitting?: boolean;
  submitLabel?: string;
}

export function TaskForm({
  initialData,
  onSubmit,
  isSubmitting,
  submitLabel,
}: TaskFormProps) {
  const t = useTranslations("tasks");
  const tCommon = useTranslations("common");
  const trpc = useTRPC();

  const [title, setTitle] = useState(initialData?.title ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [priority, setPriority] = useState<TaskPriority>(
    (initialData?.priority as TaskPriority) ?? "MEDIUM"
  );
  const [recurrenceRule, setRecurrenceRule] = useState<string | undefined>(
    initialData?.recurrenceRule
  );
  const [assigneeIds, setAssigneeIds] = useState<string[]>(
    initialData?.assigneeIds ?? []
  );
  const [dueTime, setDueTime] = useState<string | undefined>(
    initialData?.dueTime
  );
  const [reminderMinutesBefore, setReminderMinutesBefore] = useState<number | undefined>(
    initialData?.reminderMinutesBefore
  );

  // Sync form state when initialData arrives asynchronously (e.g. edit mode)
  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title ?? "");
      setDescription(initialData.description ?? "");
      setPriority((initialData.priority as TaskPriority) ?? "MEDIUM");
      setRecurrenceRule(initialData.recurrenceRule);
      setAssigneeIds(initialData.assigneeIds ?? []);
      setDueTime(initialData.dueTime);
      setReminderMinutesBefore(initialData.reminderMinutesBefore);
    }
  }, [initialData?.title, initialData?.recurrenceRule]);

  const { data: members } = useQuery(trpc.members.list.queryOptions());

  const handleDueTimeChange = (time: string | undefined) => {
    setDueTime(time);
    if (!time) setReminderMinutesBefore(undefined);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || assigneeIds.length === 0) return;

    onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      recurrenceRule,
      assigneeIds,
      dueTime,
      reminderMinutesBefore,
    });
  };

  const toggleAssignee = (memberId: string) => {
    setAssigneeIds((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    );
  };

  const PRIORITY_I18N: Record<TaskPriority, string> = {
    LOW: "priorityLow",
    MEDIUM: "priorityMedium",
    HIGH: "priorityHigh",
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Title */}
      <div className="space-y-1.5">
        <Label htmlFor="task-title">{t("taskTitle")}</Label>
        <Input
          id="task-title"
          placeholder={t("taskTitlePlaceholder")}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
          required
        />
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label htmlFor="task-description">{t("description")}</Label>
        <Textarea
          id="task-description"
          placeholder={t("descriptionPlaceholder")}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />
      </div>

      {/* Priority */}
      <div className="space-y-1.5">
        <Label>{t("priority")}</Label>
        <Select
          value={priority}
          onValueChange={(v) => setPriority(v as TaskPriority)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRIORITIES.map((p) => {
              const config = PRIORITY_CONFIG[p];
              const Icon = config.icon;
              return (
                <SelectItem key={p} value={p}>
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4" style={{ color: config.color }} />
                    {t(PRIORITY_I18N[p])}
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {/* Recurrence */}
      <div className="space-y-1.5">
        <Label>{t("recurrence")}</Label>
        <RecurrencePicker
          value={recurrenceRule}
          onChange={setRecurrenceRule}
          eventStartDate={new Date()}
        />
      </div>

      {/* Due Time + Early Reminder */}
      <TimeTogglePicker
        dueTime={dueTime}
        onDueTimeChange={handleDueTimeChange}
        reminderMinutesBefore={reminderMinutesBefore}
        onReminderChange={setReminderMinutesBefore}
        t={t}
      />

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
        {assigneeIds.length === 0 && (
          <p className="text-xs text-muted-foreground">{t("selectAssignees")}</p>
        )}
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
