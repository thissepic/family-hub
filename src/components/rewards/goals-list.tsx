"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { Target, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GoalCard } from "./goal-card";
import { GoalDialog } from "./goal-dialog";

interface GoalsListProps {
  isAdmin: boolean;
}

export function GoalsList({ isAdmin }: GoalsListProps) {
  const t = useTranslations("rewards");
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Record<
    string,
    unknown
  > | null>(null);

  const { data: goals } = useQuery(trpc.rewards.listGoals.queryOptions());

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [["rewards"]] });
  };

  const deleteMutation = useMutation(
    trpc.rewards.deleteGoal.mutationOptions({
      onSuccess: invalidate,
    })
  );

  return (
    <div className="space-y-3">
      {isAdmin && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setEditingGoal(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          {t("createGoal")}
        </Button>
      )}

      {goals && goals.length > 0 ? (
        <div className="space-y-2">
          {goals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              isAdmin={isAdmin}
              onEdit={
                isAdmin
                  ? (g) => {
                      setEditingGoal(g as unknown as Record<string, unknown>);
                      setDialogOpen(true);
                    }
                  : undefined
              }
              onDelete={
                isAdmin
                  ? (id) => deleteMutation.mutate({ id })
                  : undefined
              }
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12">
          <Target className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm font-medium">{t("noGoals")}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("noGoalsDescription")}
          </p>
        </div>
      )}

      <GoalDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        goal={editingGoal}
        onSuccess={invalidate}
      />
    </div>
  );
}
