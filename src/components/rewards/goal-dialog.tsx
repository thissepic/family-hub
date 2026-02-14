"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface GoalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal: Record<string, unknown> | null;
  onSuccess: () => void;
}

export function GoalDialog({
  open,
  onOpenChange,
  goal,
  onSuccess,
}: GoalDialogProps) {
  const t = useTranslations("rewards");
  const trpc = useTRPC();
  const isEditing = !!goal;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetXp, setTargetXp] = useState(500);
  const [rewardDescription, setRewardDescription] = useState("");

  useEffect(() => {
    if (goal) {
      setTitle((goal.title as string) || "");
      setDescription((goal.description as string) || "");
      setTargetXp((goal.targetXp as number) || 500);
      setRewardDescription((goal.rewardDescription as string) || "");
    } else {
      setTitle("");
      setDescription("");
      setTargetXp(500);
      setRewardDescription("");
    }
  }, [goal, open]);

  const createMutation = useMutation(
    trpc.rewards.createGoal.mutationOptions({
      onSuccess: () => {
        onOpenChange(false);
        onSuccess();
      },
    })
  );

  const updateMutation = useMutation(
    trpc.rewards.updateGoal.mutationOptions({
      onSuccess: () => {
        onOpenChange(false);
        onSuccess();
      },
    })
  );

  const handleSubmit = () => {
    if (isEditing) {
      updateMutation.mutate({
        id: goal!.id as string,
        title,
        description: description || undefined,
        targetXp,
        rewardDescription: rewardDescription || undefined,
      });
    } else {
      createMutation.mutate({
        title,
        description: description || undefined,
        targetXp,
        rewardDescription: rewardDescription || undefined,
      });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t("editGoal") : t("createGoal")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t("goalTitle")}</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Family Movie Night"
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t("goalDescription")}</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t("targetXp")}</Label>
            <Input
              type="number"
              min={1}
              value={targetXp}
              onChange={(e) => setTargetXp(Number(e.target.value))}
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t("goalRewardDescription")}</Label>
            <Input
              value={rewardDescription}
              onChange={(e) => setRewardDescription(e.target.value)}
              placeholder="e.g. Pizza and movie night!"
            />
          </div>

          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={!title.trim() || targetXp < 1 || isPending}
          >
            {isEditing ? t("editGoal") : t("createGoal")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
