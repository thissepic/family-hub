"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTRPC } from "@/lib/trpc/client";

function timeAgo(date: Date): string {
  const now = new Date();
  const diff = Math.floor((now.getTime() - new Date(date).getTime()) / 1000);

  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export function RecentActivityWidget() {
  const t = useTranslations("dashboard");
  const trpc = useTRPC();

  const { data, isLoading } = useQuery(
    trpc.activity.list.queryOptions({ limit: 5 })
  );

  const items = data?.items ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{t("recentActivity")}</CardTitle>
        <Activity className="h-4 w-4 text-cyan-500" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : !items.length ? (
          <p className="text-sm text-muted-foreground">{t("noActivity")}</p>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="flex items-start gap-2 text-sm">
                <span
                  className="mt-1.5 h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: item.member.color ?? "#888" }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate">{item.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.member.name} &middot; {timeAgo(item.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
