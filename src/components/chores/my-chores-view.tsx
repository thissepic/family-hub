"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "sonner";
import { RotateCcw, Plus, Check, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChoreInstanceCard } from "./chore-instance-card";
import { SwapDialog } from "./swap-dialog";

interface MyChoresViewProps {
  selectedMemberIds: string[];
  isAdmin: boolean;
  currentMemberId: string;
  onEditChore: (choreId: string) => void;
  onNewChore: () => void;
}

export function MyChoresView({
  selectedMemberIds,
  isAdmin,
  currentMemberId,
  onEditChore,
  onNewChore,
}: MyChoresViewProps) {
  const t = useTranslations("chores");
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [swapInstanceId, setSwapInstanceId] = useState<string | null>(null);

  const { data: memberGroups, isLoading } = useQuery(
    trpc.chores.listMyInstances.queryOptions({
      memberIds: selectedMemberIds.length > 0 ? selectedMemberIds : undefined,
    })
  );

  const { data: swapRequests } = useQuery(
    trpc.chores.mySwapRequests.queryOptions()
  );

  const respondToSwapMutation = useMutation(
    trpc.chores.respondToSwap.mutationOptions({
      onSuccess: (data) => {
        if (data.status === "ACCEPTED") {
          toast.success(t("swapAccepted"));
        } else {
          toast.success(t("swapDeclined"));
        }
        queryClient.invalidateQueries({ queryKey: [["chores"]] });
      },
      onError: (error) => {
        toast.error(error.message ?? t("swapError"));
        queryClient.invalidateQueries({ queryKey: [["chores"]] });
      },
    })
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">{t("title")}...</p>
      </div>
    );
  }

  const activeGroups = memberGroups?.filter((g) => g.instances.length > 0) ?? [];

  if (activeGroups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12">
        <RotateCcw className="mb-3 h-10 w-10 text-muted-foreground" />
        <p className="text-sm font-medium">{t("noChoresForPeriod")}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("noChoresDescription")}
        </p>
        <Button className="mt-4" size="sm" onClick={onNewChore}>
          <Plus className="mr-1.5 h-4 w-4" />
          {t("newChore")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pending Swap Requests */}
      {swapRequests && swapRequests.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("pendingSwaps")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {swapRequests.map((swap) => (
              <div
                key={swap.id}
                className="flex items-center gap-3 rounded-md border p-2.5"
              >
                <span
                  className="h-3 w-3 rounded-full shrink-0"
                  style={{ backgroundColor: swap.requester.color }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {swap.requester.name} → {swap.choreInstance.chore.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {swap.choreInstance.chore.category}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    variant="default"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() =>
                      respondToSwapMutation.mutate({
                        swapRequestId: swap.id,
                        accepted: true,
                      })
                    }
                    disabled={respondToSwapMutation.isPending}
                  >
                    <Check className="mr-1 h-3 w-3" />
                    {t("acceptSwap")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() =>
                      respondToSwapMutation.mutate({
                        swapRequestId: swap.id,
                        accepted: false,
                      })
                    }
                    disabled={respondToSwapMutation.isPending}
                  >
                    <X className="mr-1 h-3 w-3" />
                    {t("declineSwap")}
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Member Groups */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {activeGroups.map((group) => {
          const completedCount = group.instances.filter(
            (i) => i.status === "DONE"
          ).length;
          const totalCount = group.instances.length;

          return (
            <Card key={group.memberId}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: group.memberColor }}
                    />
                    <CardTitle className="text-base">
                      {group.memberName}
                    </CardTitle>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {t("completedCount", {
                      completed: String(completedCount),
                      total: String(totalCount),
                    })}
                  </span>
                </div>
                {/* Progress bar */}
                <div className="h-1.5 w-full rounded-full bg-muted mt-1">
                  <div
                    className="h-1.5 rounded-full bg-primary transition-all duration-300"
                    style={{
                      width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%`,
                    }}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {group.instances.map((instance) => {
                  // For group tasks, pass all instance assignee IDs;
                  // otherwise, use the member group's ID
                  const memberIds =
                    instance.instanceAssignees && instance.instanceAssignees.length > 0
                      ? instance.instanceAssignees.map((a: { member: { id: string } }) => a.member.id)
                      : [group.memberId];
                  return (
                    <ChoreInstanceCard
                      key={instance.id}
                      instance={instance}
                      isAdmin={isAdmin}
                      currentMemberId={currentMemberId}
                      assignedMemberIds={memberIds}
                      onSwap={setSwapInstanceId}
                      onEditChore={onEditChore}
                    />
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Swap Dialog */}
      <SwapDialog
        instanceId={swapInstanceId}
        onOpenChange={(open) => {
          if (!open) setSwapInstanceId(null);
        }}
      />
    </div>
  );
}
