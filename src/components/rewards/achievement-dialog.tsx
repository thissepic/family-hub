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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

interface AchievementData {
  id: string;
  name: string;
  description: string | null;
  condition: { type: string; threshold: number };
  rarity: string;
  xpReward: number;
  pointsReward: number;
  isCustom: boolean;
}

interface AchievementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  achievement?: AchievementData | null;
  onSuccess: () => void;
}

const CONDITION_TYPES = [
  "task_count",
  "chore_count",
  "streak_days",
  "total_xp",
  "level_reached",
] as const;

const RARITIES = ["COMMON", "RARE", "EPIC", "LEGENDARY"] as const;

export function AchievementDialog({
  open,
  onOpenChange,
  achievement,
  onSuccess,
}: AchievementDialogProps) {
  const t = useTranslations("rewards");
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const isEditing = !!achievement;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [conditionType, setConditionType] = useState<string>("task_count");
  const [threshold, setThreshold] = useState(10);
  const [rarity, setRarity] = useState<string>("COMMON");
  const [xpReward, setXpReward] = useState(25);
  const [pointsReward, setPointsReward] = useState(3);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (achievement) {
      setName(achievement.name);
      setDescription(achievement.description || "");
      setConditionType(achievement.condition?.type || "task_count");
      setThreshold(achievement.condition?.threshold || 10);
      setRarity(achievement.rarity || "COMMON");
      setXpReward(achievement.xpReward);
      setPointsReward(achievement.pointsReward);
    } else if (open) {
      setName("");
      setDescription("");
      setConditionType("task_count");
      setThreshold(10);
      setRarity("COMMON");
      setXpReward(25);
      setPointsReward(3);
    }
  }, [achievement, open]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [["rewards"]] });
  };

  const createMutation = useMutation(
    trpc.rewards.createAchievement.mutationOptions({
      onSuccess: () => {
        toast.success(t("createAchievement"));
        invalidate();
        onOpenChange(false);
        onSuccess();
      },
    })
  );

  const updateMutation = useMutation(
    trpc.rewards.updateAchievement.mutationOptions({
      onSuccess: () => {
        toast.success(t("editAchievement"));
        invalidate();
        onOpenChange(false);
        onSuccess();
      },
    })
  );

  const deleteMutation = useMutation(
    trpc.rewards.deleteAchievement.mutationOptions({
      onSuccess: () => {
        toast.success(t("deleteAchievement"));
        invalidate();
        onOpenChange(false);
        setShowDeleteConfirm(false);
        onSuccess();
      },
    })
  );

  const handleSubmit = () => {
    if (isEditing && achievement) {
      updateMutation.mutate({
        id: achievement.id,
        name,
        description: description || undefined,
        condition: { type: conditionType as (typeof CONDITION_TYPES)[number], threshold },
        rarity: rarity as (typeof RARITIES)[number],
        xpReward,
        pointsReward,
      });
    } else {
      createMutation.mutate({
        name,
        description: description || undefined,
        condition: { type: conditionType as (typeof CONDITION_TYPES)[number], threshold },
        rarity: rarity as (typeof RARITIES)[number],
        xpReward,
        pointsReward,
      });
    }
  };

  const isPending =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending;

  const CONDITION_LABEL_KEYS: Record<string, string> = {
    task_count: "conditionTaskCount",
    chore_count: "conditionChoreCount",
    streak_days: "conditionStreakDays",
    total_xp: "conditionTotalXp",
    level_reached: "conditionLevelReached",
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isEditing ? t("editAchievement") : t("createAchievement")}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t("achievementName")}</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Super Helper"
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t("achievementDescription")}</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("conditionType")}</Label>
                <Select value={conditionType} onValueChange={setConditionType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONDITION_TYPES.map((ct) => (
                      <SelectItem key={ct} value={ct}>
                        {t(CONDITION_LABEL_KEYS[ct] as "conditionTaskCount")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("conditionThreshold")}</Label>
                <Input
                  type="number"
                  min={1}
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{t("rarity")}</Label>
              <Select value={rarity} onValueChange={setRarity}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RARITIES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {t(`rarity${r.charAt(0) + r.slice(1).toLowerCase()}` as "rarityCommon")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("xpReward")}</Label>
                <Input
                  type="number"
                  min={0}
                  value={xpReward}
                  onChange={(e) => setXpReward(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("pointsReward")}</Label>
                <Input
                  type="number"
                  min={0}
                  value={pointsReward}
                  onChange={(e) => setPointsReward(Number(e.target.value))}
                />
              </div>
            </div>

            <Button
              className="w-full"
              onClick={handleSubmit}
              disabled={!name.trim() || threshold < 1 || isPending}
            >
              {isEditing ? t("editAchievement") : t("createAchievement")}
            </Button>
          </div>

          {isEditing && achievement?.isCustom && (
            <div className="border-t pt-3">
              <Button
                type="button"
                variant="destructive"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isPending}
                className="w-full"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t("deleteAchievement")}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmDeleteAchievement")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("confirmDeleteAchievementDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                achievement && deleteMutation.mutate({ id: achievement.id })
              }
            >
              {t("deleteAchievement")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
