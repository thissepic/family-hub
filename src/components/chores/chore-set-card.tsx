"use client";

import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Layers, Pencil, Trash2, X } from "lucide-react";

interface ChoreInSet {
  id: string;
  title: string;
  difficulty: string;
  recurrenceRule: string;
}

interface ChoreSetCardProps {
  set: {
    id: string;
    name: string;
    description: string | null;
    chores: ChoreInSet[];
  };
  isAdmin: boolean;
  onEdit: () => void;
}

export function ChoreSetCard({ set, isAdmin, onEdit }: ChoreSetCardProps) {
  const t = useTranslations("chores");
  const tCommon = useTranslations("common");
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const deleteMutation = useMutation(
    trpc.chores.deleteSet.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [["chores", "listSets"]] });
        queryClient.invalidateQueries({ queryKey: [["chores", "listChores"]] });
        toast.success(t("setDeleted"));
      },
      onError: () => toast.error(tCommon("error")),
    })
  );

  const removeChoreMutation = useMutation(
    trpc.chores.removeChoreFromSet.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [["chores", "listSets"]] });
        queryClient.invalidateQueries({ queryKey: [["chores", "listChores"]] });
      },
      onError: () => toast.error(tCommon("error")),
    })
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">{set.name}</CardTitle>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive"
                onClick={() => deleteMutation.mutate({ id: set.id })}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
        {set.description && (
          <CardDescription>{set.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        {set.chores.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("emptySet")}</p>
        ) : (
          <div className="space-y-1.5">
            {set.chores.map((chore) => (
              <div key={chore.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span>{chore.title}</span>
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {chore.difficulty.toLowerCase()}
                  </Badge>
                </div>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => removeChoreMutation.mutate({ choreId: chore.id })}
                    disabled={removeChoreMutation.isPending}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
