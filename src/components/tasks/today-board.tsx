"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { CheckSquare, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TaskCard } from "./task-card";

interface TodayBoardProps {
  selectedMemberIds: string[];
  date?: Date;
  onEditTask: (taskId: string) => void;
  onNewTask: () => void;
}

export function TodayBoard({
  selectedMemberIds,
  date,
  onEditTask,
  onNewTask,
}: TodayBoardProps) {
  const t = useTranslations("tasks");
  const trpc = useTRPC();

  // Stabilize the date to start-of-day so the query key doesn't change on every render
  const targetDate = useMemo(() => {
    const d = date ?? new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }, [date]);

  const { data: memberGroups, isLoading } = useQuery(
    trpc.tasks.listForToday.queryOptions({
      date: targetDate,
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

  // Filter out members with no tasks
  const activeGroups = memberGroups?.filter((g) => g.tasks.length > 0) ?? [];

  if (activeGroups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12">
        <CheckSquare className="mb-3 h-10 w-10 text-muted-foreground" />
        <p className="text-sm font-medium">{t("noTasksToday")}</p>
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
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {activeGroups.map((group) => {
        const completedCount = group.tasks.filter((t) => t.completed).length;
        const totalCount = group.tasks.length;

        return (
          <Card key={group.memberId}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 rounded-full shrink-0"
                    style={{ backgroundColor: group.memberColor }}
                  />
                  <CardTitle className="text-base">
                    {group.memberName}
                  </CardTitle>
                </div>
                <span className="text-xs text-muted-foreground">
                  {t("completedCount", {
                    completed: String(completedCount),
                    total: String(totalCount),
                  })}
                </span>
              </div>
              {/* Progress bar */}
              <div className="h-1.5 w-full rounded-full bg-muted mt-1">
                <div
                  className="h-1.5 rounded-full bg-primary transition-all duration-300"
                  style={{
                    width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%`,
                  }}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {group.tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  memberId={group.memberId}
                  date={targetDate}
                  onEdit={onEditTask}
                />
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
