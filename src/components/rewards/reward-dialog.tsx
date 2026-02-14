"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

interface RewardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reward: Record<string, unknown> | null;
  onSuccess: () => void;
}

export function RewardDialog({
  open,
  onOpenChange,
  reward,
  onSuccess,
}: RewardDialogProps) {
  const t = useTranslations("rewards");
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const isEditing = !!reward;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pointCost, setPointCost] = useState(100);
  const [requiresApproval, setRequiresApproval] = useState(true);

  useEffect(() => {
    if (reward) {
      setTitle((reward.title as string) || "");
      setDescription((reward.description as string) || "");
      setPointCost((reward.pointCost as number) || 100);
      setRequiresApproval(reward.requiresApproval !== false);
    } else {
      setTitle("");
      setDescription("");
      setPointCost(100);
      setRequiresApproval(true);
    }
  }, [reward, open]);

  const createMutation = useMutation(
    trpc.rewards.createReward.mutationOptions({
      onSuccess: () => {
        onOpenChange(false);
        onSuccess();
      },
    })
  );

  const updateMutation = useMutation(
    trpc.rewards.updateReward.mutationOptions({
      onSuccess: () => {
        onOpenChange(false);
        onSuccess();
      },
    })
  );

  const handleSubmit = () => {
    if (isEditing) {
      updateMutation.mutate({
        id: reward!.id as string,
        title,
        description: description || undefined,
        pointCost,
        requiresApproval,
      });
    } else {
      createMutation.mutate({
        title,
        description: description || undefined,
        pointCost,
        requiresApproval,
      });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t("editReward") : t("createReward")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t("rewardTitle")}</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Extra screen time"
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t("rewardDescription")}</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t("rewardPointCost")}</Label>
            <Input
              type="number"
              min={1}
              value={pointCost}
              onChange={(e) => setPointCost(Number(e.target.value))}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label>{t("requiresApproval")}</Label>
            <Switch
              checked={requiresApproval}
              onCheckedChange={setRequiresApproval}
            />
          </div>

          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={!title.trim() || pointCost < 1 || isPending}
          >
            {isEditing ? t("editReward") : t("createReward")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
