"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ActivityEventRow } from "@/components/activity/activity-event-row";

const ACTIVITY_TYPES = [
  "TASK_COMPLETED",
  "CHORE_COMPLETED",
  "EVENT_CREATED",
  "EVENT_UPDATED",
  "SHOPPING_ITEM_ADDED",
  "MEAL_PLANNED",
  "NOTE_PINNED",
  "ACHIEVEMENT_UNLOCKED",
  "LEVEL_UP",
  "REWARD_REDEEMED",
] as const;

const TYPE_LABEL_KEYS: Record<string, string> = {
  TASK_COMPLETED: "typeTaskCompleted",
  CHORE_COMPLETED: "typeChoreCompleted",
  EVENT_CREATED: "typeEventCreated",
  EVENT_UPDATED: "typeEventUpdated",
  SHOPPING_ITEM_ADDED: "typeShoppingItemAdded",
  MEAL_PLANNED: "typeMealPlanned",
  NOTE_PINNED: "typeNotePinned",
  ACHIEVEMENT_UNLOCKED: "typeAchievementUnlocked",
  LEVEL_UP: "typeLevelUp",
  REWARD_REDEEMED: "typeRewardRedeemed",
};

export default function ActivityPage() {
  const t = useTranslations("activity");
  const trpc = useTRPC();

  const [memberId, setMemberId] = useState<string>("");
  const [type, setType] = useState<string>("");
  const [cursor, setCursor] = useState<string | undefined>();
  const [allItems, setAllItems] = useState<
    Array<{
      id: string;
      type: string;
      description: string;
      createdAt: Date;
      member: { id: string; name: string; color: string };
    }>
  >([]);
  const [hasLoaded, setHasLoaded] = useState(false);

  const { data: membersData } = useQuery(
    trpc.members.list.queryOptions()
  );

  const { data, isFetching } = useQuery(
    trpc.activity.list.queryOptions(
      {
        memberId: memberId || undefined,
        type: type || undefined,
        limit: 30,
        cursor,
      },
      {
        placeholderData: (prev) => prev,
      }
    )
  );

  // Merge items when data changes — only on "Load more"
  const items = cursor && hasLoaded ? [...allItems, ...(data?.items ?? [])] : (data?.items ?? []);

  const handleLoadMore = useCallback(() => {
    if (data?.nextCursor) {
      setAllItems(items);
      setCursor(data.nextCursor);
      setHasLoaded(true);
    }
  }, [data?.nextCursor, items]);

  // Reset pagination when filters change
  const handleMemberChange = (v: string) => {
    setMemberId(v === "__all__" ? "" : v);
    setCursor(undefined);
    setAllItems([]);
    setHasLoaded(false);
  };

  const handleTypeChange = (v: string) => {
    setType(v === "__all__" ? "" : v);
    setCursor(undefined);
    setAllItems([]);
    setHasLoaded(false);
  };

  const hasFilters = !!memberId || !!type;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>

      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Select value={memberId || "__all__"} onValueChange={handleMemberChange}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder={t("allMembers")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t("allMembers")}</SelectItem>
            {membersData?.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={type || "__all__"} onValueChange={handleTypeChange}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder={t("allTypes")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t("allTypes")}</SelectItem>
            {ACTIVITY_TYPES.map((at) => (
              <SelectItem key={at} value={at}>
                {t(TYPE_LABEL_KEYS[at])}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Activity list */}
      {items.length > 0 ? (
        <div className="divide-y">
          {items.map((event) => (
            <ActivityEventRow
              key={event.id}
              event={event as Parameters<typeof ActivityEventRow>[0]["event"]}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12">
          <Activity className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm font-medium">
            {hasFilters ? t("noResults") : t("noActivity")}
          </p>
          {!hasFilters && (
            <p className="mt-1 text-xs text-muted-foreground">
              {t("noActivityDescription")}
            </p>
          )}
        </div>
      )}

      {/* Load more */}
      {data?.nextCursor && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleLoadMore}
            disabled={isFetching}
          >
            {t("loadMore")}
          </Button>
        </div>
      )}
    </div>
  );
}
