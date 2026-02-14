"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { XP_SOURCE_LABEL_KEYS } from "@/lib/rewards/constants";
import { formatRelativeTime } from "@/components/notifications/notification-item";

export function XpHistory({ memberId }: { memberId?: string }) {
  const t = useTranslations("rewards");
  const tNotif = useTranslations("notifications");
  const trpc = useTRPC();

  const [cursor, setCursor] = useState<string | undefined>();
  const [allItems, setAllItems] = useState<Array<Record<string, unknown>>>([]);
  const [hasLoaded, setHasLoaded] = useState(false);

  const { data, isFetching } = useQuery(
    trpc.rewards.getXpHistory.queryOptions(
      { memberId, limit: 20, cursor },
      { placeholderData: (prev) => prev }
    )
  );

  const items =
    cursor && hasLoaded
      ? [...allItems, ...(data?.items ?? [])]
      : (data?.items ?? []);

  const handleLoadMore = useCallback(() => {
    if (data?.nextCursor) {
      setAllItems(items as Array<Record<string, unknown>>);
      setCursor(data.nextCursor);
      setHasLoaded(true);
    }
  }, [data?.nextCursor, items]);

  if (!data?.items?.length && !hasLoaded) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8">
        <Zap className="mb-2 h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium">{t("noXpYet")}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {t("noXpDescription")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">{t("xpHistory")}</h3>
      <div className="divide-y rounded-lg border">
        {items.map((event) => {
          const ev = event as {
            id: string;
            description: string;
            xpAmount: number;
            pointsAmount: number;
            source: string;
            multiplier: number;
            earnedAt: Date;
          };
          return (
            <div
              key={ev.id}
              className="flex items-center gap-3 px-3 py-2 text-sm"
            >
              <div className="flex-1 min-w-0">
                <p className="truncate">{ev.description}</p>
                <p className="text-[10px] text-muted-foreground">
                  {formatRelativeTime(ev.earnedAt, tNotif)}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {ev.multiplier > 1 && (
                  <Badge variant="outline" className="text-[10px]">
                    {ev.multiplier}x
                  </Badge>
                )}
                <Badge variant="secondary" className="text-[10px]">
                  {t(XP_SOURCE_LABEL_KEYS[ev.source] ?? "sourceCustom")}
                </Badge>
                <span className="font-semibold text-green-600">
                  +{ev.xpAmount} XP
                </span>
                {ev.pointsAmount > 0 && (
                  <span className="text-xs text-amber-600">
                    +{ev.pointsAmount} pts
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {data?.nextCursor && (
        <div className="flex justify-center pt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={handleLoadMore}
            disabled={isFetching}
          >
            {t("loadMore" as "xpHistory")}
          </Button>
        </div>
      )}
    </div>
  );
}
