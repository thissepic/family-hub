"use client";

import { useTranslations } from "next-intl";
import { Target, Gift, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface GoalCardProps {
  goal: {
    id: string;
    title: string;
    description: string | null;
    targetXp: number;
    currentXp: number;
    rewardDescription: string | null;
    status: string;
  };
  isAdmin: boolean;
  onEdit?: (goal: GoalCardProps["goal"]) => void;
  onDelete?: (goalId: string) => void;
}

export function GoalCard({ goal, isAdmin, onEdit, onDelete }: GoalCardProps) {
  const t = useTranslations("rewards");
  const progress = Math.min((goal.currentXp / goal.targetXp) * 100, 100);
  const isComplete = goal.status === "COMPLETED";

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-muted-foreground shrink-0" />
          <div>
            <p className="font-medium text-sm">{goal.title}</p>
            {goal.description && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {goal.description}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Badge
            variant={isComplete ? "default" : "secondary"}
            className="text-[10px]"
          >
            {isComplete ? t("goalComplete") : t("familyGoals")}
          </Badge>
          {isAdmin && (
            <>
              {onEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => onEdit(goal)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              )}
              {onDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground"
                  onClick={() => onDelete(goal.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Progress */}
      <div>
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
          <span>
            {t("goalProgress", {
              current: String(goal.currentXp),
              target: String(goal.targetXp),
            })}
          </span>
          <span>{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Reward */}
      {goal.rewardDescription && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Gift className="h-3.5 w-3.5" />
          <span>
            {t("goalRewardDescription")}: {goal.rewardDescription}
          </span>
        </div>
      )}
    </div>
  );
}
