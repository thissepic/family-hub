"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { RotateCcw, Pencil, Plus, Repeat, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DifficultyBadge } from "./difficulty-badge";
import { ChoreSetCard } from "./chore-set-card";
import { ChoreSetDialog } from "./chore-set-dialog";
import { ROTATION_LABEL_KEYS } from "@/lib/chores/constants";
import { describeRecurrence } from "@/lib/chores/describe-recurrence";

interface AllChoresViewProps {
  selectedMemberIds: string[];
  onEditChore: (choreId: string) => void;
  onNewChore: () => void;
  isAdmin?: boolean;
}

export function AllChoresView({
  selectedMemberIds,
  onEditChore,
  onNewChore,
  isAdmin = false,
}: AllChoresViewProps) {
  const t = useTranslations("chores");
  const trpc = useTRPC();

  const [setDialogOpen, setSetDialogOpen] = useState(false);
  const [editingSet, setEditingSet] = useState<{ id: string; name: string; description: string | null } | null>(null);

  const { data: chores, isLoading } = useQuery(
    trpc.chores.list.queryOptions({
      memberIds: selectedMemberIds.length > 0 ? selectedMemberIds : undefined,
    })
  );

  const { data: choreSets } = useQuery(
    trpc.chores.listSets.queryOptions()
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">{t("title")}...</p>
      </div>
    );
  }

  if (!chores || chores.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12">
        <RotateCcw className="mb-3 h-10 w-10 text-muted-foreground" />
        <p className="text-sm font-medium">{t("noChores")}</p>
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
      {/* Chore Sets section */}
      {(choreSets && choreSets.length > 0 || isAdmin) && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Layers className="h-4 w-4" />
              {t("choreSets")}
            </h3>
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={() => { setEditingSet(null); setSetDialogOpen(true); }}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                {t("newSet")}
              </Button>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {choreSets?.map((set) => (
              <ChoreSetCard
                key={set.id}
                set={set}
                isAdmin={isAdmin}
                onEdit={() => { setEditingSet(set); setSetDialogOpen(true); }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Individual chores */}
      <div className="space-y-2">
      {chores.map((chore) => (
        <div
          key={chore.id}
          className="flex items-center gap-3 rounded-md border p-3 transition-colors hover:bg-muted/50"
        >
          {/* Title + frequency */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{chore.title}</p>
            {chore.description && (
              <p className="text-xs text-muted-foreground truncate">
                {chore.description}
              </p>
            )}
            <div className="flex items-center gap-1.5 mt-1">
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Repeat className="h-3 w-3" />
                {describeRecurrence(chore.recurrenceRule, t)}
              </span>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground">
                {t(ROTATION_LABEL_KEYS[chore.rotationPattern])}
              </span>
            </div>
          </div>

          {/* Category */}
          <Badge variant="outline" className="text-[10px] shrink-0">
            {chore.category}
          </Badge>

          {/* Difficulty */}
          <DifficultyBadge difficulty={chore.difficulty} showLabel={false} />

          {/* Assignee dots */}
          <div className="flex -space-x-1">
            {chore.assignees.map((a) => (
              <span
                key={a.member.id}
                className="h-6 w-6 rounded-full border-2 border-background flex items-center justify-center text-[10px] font-medium text-white"
                style={{ backgroundColor: a.member.color }}
                title={a.member.name}
              >
                {a.member.name.charAt(0)}
              </span>
            ))}
          </div>

          {/* Edit */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => onEditChore(chore.id)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        </div>
      ))}
      </div>

      <ChoreSetDialog
        open={setDialogOpen}
        onOpenChange={setSetDialogOpen}
        editingSet={editingSet}
      />
    </div>
  );
}
