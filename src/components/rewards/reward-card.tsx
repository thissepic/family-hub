"use client";

import { useTranslations } from "next-intl";
import { Gift, Coins, ShieldCheck, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface RewardCardProps {
  reward: {
    id: string;
    title: string;
    description: string | null;
    pointCost: number;
    requiresApproval: boolean;
    enabled: boolean;
  };
  memberPoints: number;
  isAdmin: boolean;
  onRedeem: (rewardId: string) => void;
  onEdit?: (reward: RewardCardProps["reward"]) => void;
  onDelete?: (rewardId: string) => void;
  isPending?: boolean;
}

export function RewardCard({
  reward,
  memberPoints,
  isAdmin,
  onRedeem,
  onEdit,
  onDelete,
  isPending,
}: RewardCardProps) {
  const t = useTranslations("rewards");
  const canAfford = memberPoints >= reward.pointCost;

  return (
    <div className="flex flex-col rounded-lg border p-4 gap-3">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted shrink-0">
          <Gift className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">{reward.title}</p>
          {reward.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
              {reward.description}
            </p>
          )}
        </div>
        {isAdmin && (
          <div className="flex items-center gap-0.5 shrink-0">
            {onEdit && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => onEdit(reward)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
            {onDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground"
                onClick={() => onDelete(reward.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            <Coins className="h-3 w-3" />
            {t("pointCost", { points: String(reward.pointCost) })}
          </Badge>
          {reward.requiresApproval ? (
            <Badge variant="outline" className="text-[10px] gap-1">
              <ShieldCheck className="h-3 w-3" />
              {t("requiresApproval")}
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="text-[10px] text-green-600 border-green-300"
            >
              {t("autoApproved")}
            </Badge>
          )}
          {!reward.enabled && (
            <Badge variant="destructive" className="text-[10px]">
              {t("disabled")}
            </Badge>
          )}
        </div>
        <Button
          size="sm"
          onClick={() => onRedeem(reward.id)}
          disabled={!canAfford || isPending || !reward.enabled}
        >
          {t("redeemReward")}
        </Button>
      </div>
    </div>
  );
}
