"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
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
import {
  DIFFICULTIES,
  DIFFICULTY_CONFIG,
  DEFAULT_CATEGORIES,
  CHORE_CATEGORY_LABEL_KEYS,
  ROTATION_PATTERNS,
  ROTATION_LABEL_KEYS,
} from "@/lib/chores/constants";
import type { ChoreCategory } from "@/lib/chores/constants";
import { RecurrencePicker } from "@/components/calendar/recurrence-picker";
import { TimeTogglePicker } from "@/components/ui/time-toggle-picker";
import type {
  ChoreDifficulty,
  RotationPattern,
} from "@prisma/client";

export interface ChoreFormData {
  title: string;
  description?: string;
  category: string;
  recurrenceRule: string;
  difficulty: ChoreDifficulty;
  estimatedMinutes?: number;
  needsVerification: boolean;
  rotationPattern: RotationPattern;
  assigneeIds: string[];
  dueTime?: string;
  reminderMinutesBefore?: number;
}

interface ChoreFormProps {
  initialData?: Partial<ChoreFormData>;
  onSubmit: (data: ChoreFormData) => void;
  isSubmitting?: boolean;
  submitLabel?: string;
}

export function ChoreForm({
  initialData,
  onSubmit,
  isSubmitting,
  submitLabel,
}: ChoreFormProps) {
  const t = useTranslations("chores");
  const tCommon = useTranslations("common");
  const trpc = useTRPC();

  const [title, setTitle] = useState(initialData?.title ?? "");
  const [description, setDescription] = useState(
    initialData?.description ?? ""
  );
  const [category, setCategory] = useState(
    initialData?.category ?? "General"
  );
  const [recurrenceRule, setRecurrenceRule] = useState<string>(
    initialData?.recurrenceRule ?? "RRULE:FREQ=WEEKLY"
  );
  const [difficulty, setDifficulty] = useState<ChoreDifficulty>(
    (initialData?.difficulty as ChoreDifficulty) ?? "MEDIUM"
  );
  const [estimatedMinutes, setEstimatedMinutes] = useState<string>(
    initialData?.estimatedMinutes?.toString() ?? ""
  );
  const [needsVerification, setNeedsVerification] = useState(
    initialData?.needsVerification ?? false
  );
  const [rotationPattern, setRotationPattern] = useState<RotationPattern>(
    (initialData?.rotationPattern as RotationPattern) ?? "ROUND_ROBIN"
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
      category,
      recurrenceRule,
      difficulty,
      estimatedMinutes: estimatedMinutes
        ? parseInt(estimatedMinutes)
        : undefined,
      needsVerification,
      rotationPattern,
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

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Title */}
      <div className="space-y-1.5">
        <Label htmlFor="chore-title">{t("choreTitle")}</Label>
        <Input
          id="chore-title"
          placeholder={t("choreTitlePlaceholder")}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
          required
        />
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label htmlFor="chore-description">{t("description")}</Label>
        <Textarea
          id="chore-description"
          placeholder={t("descriptionPlaceholder")}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
        />
      </div>

      {/* Category */}
      <div className="space-y-1.5">
        <Label>{t("category")}</Label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DEFAULT_CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {t(CHORE_CATEGORY_LABEL_KEYS[cat])}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Frequency / Recurrence */}
      <div className="space-y-1.5">
        <Label>{t("frequency")}</Label>
        <RecurrencePicker
          value={recurrenceRule}
          onChange={(rule) => setRecurrenceRule(rule ?? "RRULE:FREQ=WEEKLY")}
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

      {/* Difficulty + Estimated Time (side by side) */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>{t("difficulty")}</Label>
          <Select
            value={difficulty}
            onValueChange={(v) => setDifficulty(v as ChoreDifficulty)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DIFFICULTIES.map((d) => {
                const config = DIFFICULTY_CONFIG[d];
                const Icon = config.icon;
                const key =
                  d === "EASY"
                    ? "difficultyEasy"
                    : d === "MEDIUM"
                      ? "difficultyMedium"
                      : "difficultyHard";
                return (
                  <SelectItem key={d} value={d}>
                    <div className="flex items-center gap-2">
                      <Icon
                        className="h-4 w-4"
                        style={{ color: config.color }}
                      />
                      {t(key)}
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="chore-minutes">{t("estimatedMinutes")}</Label>
          <Input
            id="chore-minutes"
            type="number"
            min={1}
            max={480}
            placeholder="15"
            value={estimatedMinutes}
            onChange={(e) => setEstimatedMinutes(e.target.value)}
          />
        </div>
      </div>

      {/* Rotation Pattern */}
      <div className="space-y-1.5">
        <Label>{t("rotation")}</Label>
        <Select
          value={rotationPattern}
          onValueChange={(v) => setRotationPattern(v as RotationPattern)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROTATION_PATTERNS.map((p) => (
              <SelectItem key={p} value={p}>
                {t(ROTATION_LABEL_KEYS[p])}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Needs Verification */}
      <div className="flex items-center gap-2">
        <Switch
          id="needs-verification"
          checked={needsVerification}
          onCheckedChange={setNeedsVerification}
        />
        <Label htmlFor="needs-verification">{t("needsVerification")}</Label>
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
        {assigneeIds.length === 0 && (
          <p className="text-xs text-muted-foreground">
            {rotationPattern === "ALL_TOGETHER"
              ? t("selectAssigneesGroup")
              : t("selectAssignees")}
          </p>
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
