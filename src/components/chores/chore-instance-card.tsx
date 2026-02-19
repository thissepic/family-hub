"use client";

import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "sonner";
import { fireLevelUpConfetti } from "@/lib/rewards/confetti";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Check,
  Clock,
  Pencil,
  ArrowLeftRight,
  SkipForward,
  ShieldCheck,
  Undo2,
} from "lucide-react";
import { DifficultyBadge } from "./difficulty-badge";
import { DIFFICULTY_CONFIG, CHORE_CATEGORY_LABEL_KEYS } from "@/lib/chores/constants";
import type { ChoreCategory } from "@/lib/chores/constants";
import { cn } from "@/lib/utils";
import type { ChoreDifficulty, ChoreInstanceStatus } from "@prisma/client";

interface ChoreInstanceCardProps {
  instance: {
    id: string;
    status: string;
    chore: {
      id: string;
      title: string;
      category: string;
      difficulty: string;
      needsVerification: boolean;
      estimatedMinutes: number | null;
      rotationPattern?: string;
    };
    instanceAssignees?: Array<{
      member: { id: string; name: string; color: string };
    }>;
  };
  isAdmin: boolean;
  currentMemberId: string;
  /** @deprecated Use assignedMemberIds instead */
  assignedMemberId?: string;
  assignedMemberIds?: string[];
  onSwap: (instanceId: string) => void;
  onEditChore: (choreId: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-500",
  DONE: "bg-green-500",
  PENDING_REVIEW: "bg-blue-500",
  OVERDUE: "bg-red-500",
  SKIPPED: "bg-gray-400",
};

export function ChoreInstanceCard({
  instance,
  isAdmin,
  currentMemberId,
  assignedMemberId,
  assignedMemberIds: assignedMemberIdsProp,
  onSwap,
  onEditChore,
}: ChoreInstanceCardProps) {
  const t = useTranslations("chores");
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const status = instance.status as ChoreInstanceStatus;
  const config = DIFFICULTY_CONFIG[instance.chore.difficulty as ChoreDifficulty];
  const xp = config?.xp ?? 0;

  // Support both old single prop and new array prop
  const assignedMemberIds = assignedMemberIdsProp
    ?? (assignedMemberId ? [assignedMemberId] : []);
  const isAssignedToMe = assignedMemberIds.includes(currentMemberId);
  const isGroupTask = instance.chore.rotationPattern === "ALL_TOGETHER";
  const isDone = status === "DONE";
  const isSkipped = status === "SKIPPED";

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [["chores"]] });
  };

  const completeMutation = useMutation(
    trpc.chores.completeInstance.mutationOptions({
      onSuccess: (data) => {
        if (data.status === "PENDING_REVIEW") {
          toast.success(t("choreSubmittedForReview"));
        } else {
          toast.success(t("choreDone", { xp: String(data.xpAwarded) }));
          if (data.leveledUp) fireLevelUpConfetti();
        }
        invalidate();
      },
    })
  );

  const verifyMutation = useMutation(
    trpc.chores.verifyInstance.mutationOptions({
      onSuccess: (data) => {
        if (data.status === "DONE") {
          toast.success(t("choreVerified", { xp: String(data.xpAwarded) }));
          if (data.leveledUp) fireLevelUpConfetti();
        } else {
          toast.success(t("choreRejected"));
        }
        invalidate();
      },
    })
  );

  const skipMutation = useMutation(
    trpc.chores.skipInstance.mutationOptions({
      onSuccess: () => {
        toast.success(t("choreSkipped"));
        invalidate();
      },
    })
  );

  const uncompleteMutation = useMutation(
    trpc.chores.uncompleteInstance.mutationOptions({
      onSuccess: () => {
        toast.success(t("choreUncompleted"));
        invalidate();
      },
    })
  );

  const isPending =
    completeMutation.isPending ||
    verifyMutation.isPending ||
    skipMutation.isPending ||
    uncompleteMutation.isPending;

  return (
    <div
      className={cn(
        "rounded-md border p-3 transition-colors space-y-2",
        isDone && "bg-muted/50",
        isSkipped && "bg-muted/30"
      )}
    >
      {/* Row 1: Status dot + Title + Category badge + Edit */}
      <div className="flex items-start gap-2.5">
        <div
          className={cn("mt-1.5 h-2.5 w-2.5 rounded-full shrink-0", STATUS_COLORS[status])}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p
              className={cn(
                "text-sm font-medium",
                (isDone || isSkipped) && "line-through text-muted-foreground"
              )}
            >
              {instance.chore.title}
            </p>
            <Badge variant="outline" className="text-[10px] shrink-0">
              {t(CHORE_CATEGORY_LABEL_KEYS[instance.chore.category as ChoreCategory] ?? instance.chore.category)}
            </Badge>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={() => onEditChore(instance.chore.id)}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Group task assignee dots */}
      {isGroupTask && instance.instanceAssignees && instance.instanceAssignees.length > 0 && (
        <div className="flex items-center gap-1.5 pl-5">
          <div className="flex -space-x-1">
            {instance.instanceAssignees.map((a) => (
              <span
                key={a.member.id}
                className="h-5 w-5 rounded-full border-2 border-background flex items-center justify-center text-[9px] font-medium text-white"
                style={{ backgroundColor: a.member.color }}
                title={a.member.name}
              >
                {a.member.name.charAt(0)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Row 2: Meta info */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground pl-5">
        {instance.chore.estimatedMinutes && (
          <span className="flex items-center gap-1 whitespace-nowrap">
            <Clock className="h-3 w-3" />
            {instance.chore.estimatedMinutes} min
          </span>
        )}
        <DifficultyBadge difficulty={instance.chore.difficulty} showLabel={false} />
        <span
          className={cn(
            "font-medium whitespace-nowrap",
            isDone || isSkipped ? "text-muted-foreground" : ""
          )}
          style={{ color: isDone || isSkipped ? undefined : config?.color }}
        >
          +{xp} XP
        </span>
      </div>

      {/* Row 3: Action buttons (only if there are actions) */}
      {(status === "PENDING" && isAssignedToMe) || (status === "PENDING_REVIEW") || isDone || isSkipped ? (
      <div className="flex items-center gap-1.5 pl-5">
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* PENDING actions */}
          {status === "PENDING" && isAssignedToMe && (
            <>
              <Button
                variant="default"
                size="sm"
                className="h-7 text-xs"
                onClick={() =>
                  completeMutation.mutate({ instanceId: instance.id })
                }
                disabled={isPending}
              >
                <Check className="mr-1 h-3 w-3" />
                {t("markComplete")}
              </Button>
              {!isGroupTask && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => onSwap(instance.id)}
                  title={t("swapRequest")}
                >
                  <ArrowLeftRight className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() =>
                  skipMutation.mutate({ instanceId: instance.id })
                }
                disabled={isPending}
                title={t("skip")}
              >
                <SkipForward className="h-3.5 w-3.5" />
              </Button>
            </>
          )}

          {/* PENDING_REVIEW actions (admin only) */}
          {status === "PENDING_REVIEW" && isAdmin && (
            <>
              <Button
                variant="default"
                size="sm"
                className="h-7 text-xs"
                onClick={() =>
                  verifyMutation.mutate({
                    instanceId: instance.id,
                    approved: true,
                  })
                }
                disabled={isPending}
              >
                <ShieldCheck className="mr-1 h-3 w-3" />
                {t("verify")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() =>
                  verifyMutation.mutate({
                    instanceId: instance.id,
                    approved: false,
                  })
                }
                disabled={isPending}
              >
                <Undo2 className="mr-1 h-3 w-3" />
                {t("reject")}
              </Button>
            </>
          )}

          {/* PENDING_REVIEW (non-admin) */}
          {status === "PENDING_REVIEW" && !isAdmin && (
            <Badge variant="secondary" className="text-xs">
              {t("statusPendingReview")}
            </Badge>
          )}

          {/* DONE — toggle back to pending */}
          {isDone && (isAssignedToMe || isAdmin) && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() =>
                uncompleteMutation.mutate({ instanceId: instance.id })
              }
              disabled={isPending}
              title={t("markIncomplete")}
            >
              <Undo2 className="mr-1 h-3 w-3" />
              {t("markIncomplete")}
            </Button>
          )}
          {isDone && !isAssignedToMe && !isAdmin && (
            <Check className="h-4 w-4 text-green-500" />
          )}

          {/* SKIPPED — undo back to pending */}
          {isSkipped && (isAssignedToMe || isAdmin) && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() =>
                uncompleteMutation.mutate({ instanceId: instance.id })
              }
              disabled={isPending}
              title={t("markIncomplete")}
            >
              <Undo2 className="mr-1 h-3 w-3" />
              {t("markIncomplete")}
            </Button>
          )}
        </div>
      </div>
      ) : null}
    </div>
  );
}
