"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { CheckSquare, Circle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTRPC } from "@/lib/trpc/client";
import Link from "next/link";

interface MyTasksWidgetProps {
  memberId?: string;
}

export function MyTasksWidget({ memberId }: MyTasksWidgetProps) {
  const t = useTranslations("dashboard");
  const trpc = useTRPC();

  const { data, isLoading } = useQuery({
    ...trpc.tasks.listForToday.queryOptions({
      memberIds: memberId ? [memberId] : undefined,
    }),
    enabled: !!memberId,
  });

  // Deduplicate tasks: listForToday groups by member, so multi-assignee tasks
  // appear in multiple groups. We flatten and keep only the first occurrence.
  const allTasks = React.useMemo(() => {
    const result: Array<{ id: string; title: string; description: string | null; priority: string; recurrenceRule: string | null; completed: boolean }> = [];
    const seen = new Set<string>();
    for (const group of data ?? []) {
      for (const task of group.tasks) {
        if (!seen.has(task.id)) {
          seen.add(task.id);
          result.push(task);
        }
      }
    }
    return result;
  }, [data]);
  const completedCount = allTasks.filter((t) => t.completed).length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{t("myTasks")}</CardTitle>
        <CheckSquare className="h-4 w-4 text-green-500" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ) : !allTasks.length ? (
          <p className="text-sm text-muted-foreground">{t("noTasks")}</p>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {completedCount}/{allTasks.length} {t("completed")}
            </p>
            {allTasks.slice(0, 5).map((task) => (
              <div key={task.id} className="flex items-center gap-2 text-sm">
                {task.completed ? (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-500" />
                ) : (
                  <Circle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                )}
                <span className={`truncate ${task.completed ? "line-through text-muted-foreground" : ""}`}>
                  {task.title}
                </span>
              </div>
            ))}
            {allTasks.length > 5 && (
              <Link href="/tasks" className="block text-xs text-muted-foreground hover:underline">
                {t("viewAll")} ({allTasks.length})
              </Link>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
