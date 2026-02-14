"use client";

import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "sonner";
import { fireLevelUpConfetti } from "@/lib/rewards/confetti";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import { PriorityBadge } from "./priority-badge";
import { PRIORITY_CONFIG } from "@/lib/tasks/constants";
import { cn } from "@/lib/utils";
import type { TaskPriority } from "@prisma/client";

interface TaskCardProps {
  task: {
    id: string;
    title: string;
    description: string | null;
    priority: string;
    recurrenceRule: string | null;
    completed: boolean;
  };
  memberId: string;
  date: Date;
  onEdit: (taskId: string) => void;
}

export function TaskCard({ task, memberId, date, onEdit }: TaskCardProps) {
  const t = useTranslations("tasks");
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const config = PRIORITY_CONFIG[task.priority as TaskPriority];
  const xp = config?.xp ?? 0;

  const toggleMutation = useMutation(
    trpc.tasks.toggleCompletion.mutationOptions({
      onMutate: async () => {
        // Cancel outgoing refetches
        await queryClient.cancelQueries({ queryKey: [["tasks"]] });
      },
      onSuccess: (data) => {
        if (data.completed) {
          toast.success(t("taskCompleted", { xp: String(data.xpAwarded) }));
          if (data.leveledUp) fireLevelUpConfetti();
        } else {
          toast.success(t("taskUncompleted"));
        }
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: [["tasks"]] });
      },
    })
  );

  const handleToggle = (checked: boolean) => {
    toggleMutation.mutate({
      taskId: task.id,
      memberId,
      date,
      completed: checked,
    });
  };

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-md border p-2.5 transition-colors",
        task.completed && "bg-muted/50"
      )}
    >
      <Checkbox
        checked={task.completed}
        onCheckedChange={(checked) => handleToggle(!!checked)}
        disabled={toggleMutation.isPending}
        className="shrink-0"
      />

      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-sm font-medium truncate",
            task.completed && "line-through text-muted-foreground"
          )}
        >
          {task.title}
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <PriorityBadge priority={task.priority} showLabel={false} />
        <span
          className={cn(
            "text-xs font-medium",
            task.completed ? "text-muted-foreground" : "text-foreground"
          )}
          style={{ color: task.completed ? undefined : config?.color }}
        >
          +{xp} XP
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => onEdit(task.id)}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
