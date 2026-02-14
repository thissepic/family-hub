"use client";

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
import { ArrowLeftRight } from "lucide-react";

interface SwapDialogProps {
  instanceId: string | null;
  onOpenChange: (open: boolean) => void;
}

export function SwapDialog({ instanceId, onOpenChange }: SwapDialogProps) {
  const t = useTranslations("chores");
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const open = !!instanceId;

  // Fetch instance details to get other assignees
  const { data: instances } = useQuery(
    trpc.chores.listMyInstances.queryOptions({}),
  );

  const requestSwapMutation = useMutation(
    trpc.chores.requestSwap.mutationOptions({
      onSuccess: () => {
        toast.success(t("swapRequested"));
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
      (a) => a.member.id !== instance.assignedMember.id
    ) ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-4 w-4" />
            {t("swapWith")}
          </DialogTitle>
        </DialogHeader>

        {instance && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {instance.chore.title}
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
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
