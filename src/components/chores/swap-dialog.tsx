"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowRight, ArrowLeftRight } from "lucide-react";

interface SwapDialogProps {
  instanceId: string | null;
  onOpenChange: (open: boolean) => void;
}

export function SwapDialog({ instanceId, onOpenChange }: SwapDialogProps) {
  const t = useTranslations("chores");
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<string>("transfer");

  const open = !!instanceId;

  // Fetch instance details to get other assignees
  const { data: instances } = useQuery(
    trpc.chores.listMyInstances.queryOptions({}),
  );

  // Fetch all family members for transfer mode
  const { data: allMembers } = useQuery(
    trpc.members.list.queryOptions(),
  );

  const requestSwapMutation = useMutation(
    trpc.chores.requestSwap.mutationOptions({
      onSuccess: (_data, variables) => {
        toast.success(
          variables.isTransfer ? t("transferRequested") : t("swapRequested")
        );
        queryClient.invalidateQueries({ queryKey: [["chores"]] });
        onOpenChange(false);
      },
    })
  );

  // Find the instance to get its chore assignees
  const instance = instances
    ?.flatMap((g) => g.instances)
    .find((i) => i.id === instanceId);

  const otherAssignees =
    instance?.chore.assignees.filter(
      (a) => a.member.id !== instance.assignedMember?.id
    ) ?? [];

  // All family members except the current assignee (for transfer)
  const transferTargets =
    allMembers?.filter(
      (m) => m.id !== instance?.assignedMember?.id
    ) ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{instance?.chore.title}</DialogTitle>
        </DialogHeader>

        {instance && (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="w-full">
              <TabsTrigger value="transfer" className="flex-1 gap-1.5">
                <ArrowRight className="h-3.5 w-3.5" />
                {t("transfer")}
              </TabsTrigger>
              <TabsTrigger value="swap" className="flex-1 gap-1.5">
                <ArrowLeftRight className="h-3.5 w-3.5" />
                {t("swap")}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="transfer" className="space-y-2 mt-3">
              <p className="text-sm text-muted-foreground">
                {t("transferDescription")}
              </p>
              {transferTargets.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  {t("noTransferTargets")}
                </p>
              ) : (
                <div className="space-y-2">
                  {transferTargets.map((m) => (
                    <Button
                      key={m.id}
                      variant="outline"
                      className="w-full justify-start gap-2"
                      onClick={() =>
                        requestSwapMutation.mutate({
                          instanceId: instanceId!,
                          targetMemberId: m.id,
                          isTransfer: true,
                        })
                      }
                      disabled={requestSwapMutation.isPending}
                    >
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: m.color }}
                      />
                      {m.name}
                    </Button>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="swap" className="space-y-2 mt-3">
              <p className="text-sm text-muted-foreground">
                {t("swapDescription")}
              </p>
              {otherAssignees.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  {t("noSwaps")}
                </p>
              ) : (
                <div className="space-y-2">
                  {otherAssignees.map((a) => (
                    <Button
                      key={a.member.id}
                      variant="outline"
                      className="w-full justify-start gap-2"
                      onClick={() =>
                        requestSwapMutation.mutate({
                          instanceId: instanceId!,
                          targetMemberId: a.member.id,
                        })
                      }
                      disabled={requestSwapMutation.isPending}
                    >
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: a.member.color }}
                      />
                      {a.member.name}
                    </Button>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
