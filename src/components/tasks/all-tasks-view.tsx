"use client";

import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { CheckSquare, Pencil, Plus, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PriorityBadge } from "./priority-badge";

/**
 * Convert an RRULE string to a human-readable description.
 */
function describeRecurrence(rule: string | null, t: (key: string, params?: Record<string, string>) => string): string {
  if (!rule) return t("once");

  const ruleStr = rule.replace(/^RRULE:/, "");
  const parts = Object.fromEntries(
    ruleStr.split(";").map((p) => {
      const [k, v] = p.split("=");
      return [k, v];
    })
  );

  const freq = parts.FREQ;
  const interval = parts.INTERVAL ? parseInt(parts.INTERVAL) : 1;
  const byDay = parts.BYDAY;

  // Common patterns
  if (freq === "DAILY" && interval === 1) return t("recurrenceDaily");
  if (freq === "DAILY" && interval > 1) return t("recurrenceEveryNDays", { n: String(interval) });
  if (freq === "WEEKLY" && byDay === "MO,TU,WE,TH,FR") return t("recurrenceWeekdays");
  if (freq === "WEEKLY" && interval === 1) {
    if (byDay) return t("recurrenceWeeklyOn", { days: byDay });
    return t("recurrenceWeekly");
  }
  if (freq === "MONTHLY" && interval === 1) return t("recurrenceMonthly");
  if (freq === "YEARLY" && interval === 1) return t("recurrenceYearly");

  return rule;
}

interface AllTasksViewProps {
  selectedMemberIds: string[];
  onEditTask: (taskId: string) => void;
  onNewTask: () => void;
}

export function AllTasksView({
  selectedMemberIds,
  onEditTask,
  onNewTask,
}: AllTasksViewProps) {
  const t = useTranslations("tasks");
  const trpc = useTRPC();

  const { data: tasks, isLoading } = useQuery(
    trpc.tasks.list.queryOptions({
      memberIds: selectedMemberIds.length > 0 ? selectedMemberIds : undefined,
    })
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">{t("title")}...</p>
      </div>
    );
  }

  if (!tasks || tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12">
        <CheckSquare className="mb-3 h-10 w-10 text-muted-foreground" />
        <p className="text-sm font-medium">{t("noTasks")}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("noTasksDescription")}
        </p>
        <Button className="mt-4" size="sm" onClick={onNewTask}>
          <Plus className="mr-1.5 h-4 w-4" />
          {t("newTask")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {tasks.map((task) => (
        <div
          key={task.id}
          className="flex items-center gap-3 rounded-md border p-3 transition-colors hover:bg-muted/50"
        >
          {/* Title + recurrence */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{task.title}</p>
            {task.description && (
              <p className="text-xs text-muted-foreground truncate">
                {task.description}
              </p>
            )}
            <div className="flex items-center gap-1.5 mt-1">
              {task.recurrenceRule && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Repeat className="h-3 w-3" />
                  {describeRecurrence(task.recurrenceRule, t)}
                </span>
              )}
              {!task.recurrenceRule && (
                <span className="text-xs text-muted-foreground">
                  {t("once")}
                </span>
              )}
            </div>
          </div>

          {/* Priority */}
          <PriorityBadge priority={task.priority} />

          {/* Assignee dots */}
          <div className="flex -space-x-1">
            {task.assignees.map((a) => (
              <span
                key={a.member.id}
                className="h-6 w-6 rounded-full border-2 border-background flex items-center justify-center text-[10px] font-medium text-white"
                style={{ backgroundColor: a.member.color }}
                title={a.member.name}
              >
                {a.member.name.charAt(0)}
              </span>
            ))}
          </div>

          {/* Edit */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => onEditTask(task.id)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}
