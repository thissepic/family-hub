"use client";

import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "sonner";
import { Check, X, Clock, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/components/notifications/notification-item";

interface RedemptionListProps {
  isAdmin: boolean;
}

const STATUS_CONFIG = {
  PENDING_APPROVAL: {
    labelKey: "statusPending",
    variant: "outline" as const,
    icon: Clock,
    color: "text-yellow-600",
  },
  APPROVED: {
    labelKey: "statusApproved",
    variant: "secondary" as const,
    icon: CheckCircle,
    color: "text-green-600",
  },
  DECLINED: {
    labelKey: "statusDeclined",
    variant: "destructive" as const,
    icon: XCircle,
    color: "text-red-600",
  },
};

export function RedemptionList({ isAdmin }: RedemptionListProps) {
  const t = useTranslations("rewards");
  const tNotif = useTranslations("notifications");
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [["rewards"]] });
  };

  const { data: redemptions } = useQuery(
    trpc.rewards.listRedemptions.queryOptions({})
  );

  const reviewMutation = useMutation(
    trpc.rewards.reviewRedemption.mutationOptions({
      onSuccess: (result) => {
        toast.success(
          result.status === "APPROVED"
            ? t("redemptionApproved")
            : t("redemptionDeclined")
        );
        invalidate();
      },
    })
  );

  if (!redemptions?.length) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        {t("noRedemptions")}
      </p>
    );
  }

  const pending = redemptions.filter((r) => r.status === "PENDING_APPROVAL");
  const history = redemptions.filter((r) => r.status !== "PENDING_APPROVAL");

  return (
    <div className="space-y-4">
      {/* Pending approvals (admin) */}
      {isAdmin && pending.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">{t("pendingApprovals")}</h4>
          {pending.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-3 rounded-lg border border-yellow-200 bg-yellow-50/50 dark:bg-yellow-950/20 p-3"
            >
              <div
                className="h-7 w-7 rounded-full flex items-center justify-center text-white text-xs font-medium shrink-0"
                style={{ backgroundColor: r.member.color }}
              >
                {r.member.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm">
                  <span className="font-medium">{r.member.name}</span> wants{" "}
                  <span className="font-medium">{r.reward.title}</span>
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {r.pointsSpent} pts ·{" "}
                  {formatRelativeTime(r.requestedAt, tNotif)}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-green-600"
                  onClick={() =>
                    reviewMutation.mutate({ id: r.id, approved: true })
                  }
                  disabled={reviewMutation.isPending}
                >
                  <Check className="h-3.5 w-3.5 mr-1" />
                  {t("approve")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-red-600"
                  onClick={() =>
                    reviewMutation.mutate({ id: r.id, approved: false })
                  }
                  disabled={reviewMutation.isPending}
                >
                  <X className="h-3.5 w-3.5 mr-1" />
                  {t("decline")}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">{t("redemptionHistory")}</h4>
          <div className="divide-y rounded-lg border">
            {history.map((r) => {
              const cfg = STATUS_CONFIG[r.status];
              return (
                <div key={r.id} className="flex items-center gap-3 px-3 py-2">
                  <div
                    className="h-6 w-6 rounded-full flex items-center justify-center text-white text-[10px] font-medium shrink-0"
                    style={{ backgroundColor: r.member.color }}
                  >
                    {r.member.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">
                      {r.member.name} — {r.reward.title}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {r.pointsSpent} pts ·{" "}
                      {formatRelativeTime(r.requestedAt, tNotif)}
                    </p>
                  </div>
                  <Badge variant={cfg.variant} className="text-[10px] shrink-0">
                    {t(cfg.labelKey as "statusPending")}
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
