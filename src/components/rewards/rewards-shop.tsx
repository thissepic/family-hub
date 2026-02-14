"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "sonner";
import { Gift, Coins, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RewardCard } from "./reward-card";
import { RewardDialog } from "./reward-dialog";

interface RewardsShopProps {
  isAdmin: boolean;
}

export function RewardsShop({ isAdmin }: RewardsShopProps) {
  const t = useTranslations("rewards");
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingReward, setEditingReward] = useState<Record<
    string,
    unknown
  > | null>(null);

  const { data: rewards } = useQuery(
    trpc.rewards.listRewards.queryOptions({ enabledOnly: !isAdmin })
  );

  const { data: profile } = useQuery(
    trpc.rewards.getProfile.queryOptions({})
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [["rewards"]] });
  };

  const redeemMutation = useMutation(
    trpc.rewards.redeem.mutationOptions({
      onSuccess: () => {
        toast.success(t("redeemSuccess"));
        invalidate();
      },
    })
  );

  const deleteMutation = useMutation(
    trpc.rewards.deleteReward.mutationOptions({
      onSuccess: invalidate,
    })
  );

  return (
    <div className="space-y-4">
      {/* Point balance */}
      {profile && (
        <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3">
          <Coins className="h-5 w-5 text-amber-500" />
          <span className="text-sm font-medium">
            {t("yourPoints")}: {profile.points}
          </span>
        </div>
      )}

      {/* Admin: add reward */}
      {isAdmin && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setEditingReward(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          {t("createReward")}
        </Button>
      )}

      {/* Rewards list */}
      {rewards && rewards.length > 0 ? (
        <div className="space-y-2">
          {rewards.map((reward) => (
            <RewardCard
              key={reward.id}
              reward={reward}
              memberPoints={profile?.points ?? 0}
              isAdmin={isAdmin}
              onRedeem={(id) => redeemMutation.mutate({ rewardId: id })}
              onEdit={
                isAdmin
                  ? (r) => {
                      setEditingReward(r as unknown as Record<string, unknown>);
                      setDialogOpen(true);
                    }
                  : undefined
              }
              onDelete={
                isAdmin
                  ? (id) => deleteMutation.mutate({ id })
                  : undefined
              }
              isPending={redeemMutation.isPending}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12">
          <Gift className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm font-medium">{t("noRewards")}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("noRewardsDescription")}
          </p>
        </div>
      )}

      {/* Reward create/edit dialog */}
      <RewardDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        reward={editingReward}
        onSuccess={invalidate}
      />
    </div>
  );
}
