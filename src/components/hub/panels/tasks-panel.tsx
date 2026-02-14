"use client";

import { useTranslations } from "next-intl";
import { CheckSquare, Circle, CheckCircle2 } from "lucide-react";

interface TaskItem {
  id: string;
  title: string;
  priority: string;
  assignees: { id: string; name: string; color: string }[];
  completions: { memberId: string; completedAt: string | Date }[];
}

interface TasksPanelProps {
  data: TaskItem[];
}

const PRIORITY_COLORS: Record<string, string> = {
  HIGH: "bg-red-500",
  MEDIUM: "bg-yellow-500",
  LOW: "bg-blue-500",
};

export function TasksPanel({ data }: TasksPanelProps) {
  const t = useTranslations("hub");

  if (!data || data.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-4">
        <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
          <CheckSquare className="h-5 w-5" />
          {t("tasksBoard")}
        </h3>
        <p className="text-sm text-muted-foreground">{t("noTasks")}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-4">
      <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
        <CheckSquare className="h-5 w-5" />
        {t("tasksBoard")}
      </h3>
      <div className="space-y-1.5">
        {data.map((task) => {
          const isFullyDone =
            task.assignees.length > 0 &&
            task.assignees.every((a) =>
              task.completions.some((c) => c.memberId === a.id)
            );

          return (
            <div
              key={task.id}
              className={`flex items-center gap-2 rounded-lg p-2 text-sm ${
                isFullyDone ? "opacity-50" : ""
              }`}
            >
              {isFullyDone ? (
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
              <span
                className={`h-2 w-2 rounded-full shrink-0 ${
                  PRIORITY_COLORS[task.priority] ?? "bg-gray-400"
                }`}
              />
              <span
                className={`flex-1 truncate ${
                  isFullyDone ? "line-through" : ""
                }`}
              >
                {task.title}
              </span>
              <div className="flex items-center gap-0.5 shrink-0">
                {task.assignees.map((a) => {
                  const completed = task.completions.some(
                    (c) => c.memberId === a.id
                  );
                  return (
                    <span
                      key={a.id}
                      className={`inline-block h-3 w-3 rounded-full border-2 ${
                        completed
                          ? "border-green-500"
                          : "border-transparent"
                      }`}
                      style={{ backgroundColor: a.color }}
                      title={`${a.name}${completed ? " ✓" : ""}`}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
