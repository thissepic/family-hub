"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useTRPC } from "@/lib/trpc/client";
import Link from "next/link";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  PENDING: "outline",
  DONE: "default",
  PENDING_REVIEW: "secondary",
  OVERDUE: "destructive",
  SKIPPED: "secondary",
};

const STATUS_I18N: Record<string, string> = {
  PENDING: "statusPending",
  DONE: "statusDone",
  PENDING_REVIEW: "statusPendingReview",
  OVERDUE: "statusOverdue",
  SKIPPED: "statusSkipped",
};

export function MyChoresWidget() {
  const t = useTranslations("dashboard");
  const tChores = useTranslations("chores");
  const trpc = useTRPC();

  const { data, isLoading } = useQuery(
    trpc.chores.listMyInstances.queryOptions({})
  );

  const allInstances = data?.flatMap((group) => group.instances) ?? [];
  const pending = allInstances.filter((i) => i.status === "PENDING" || i.status === "OVERDUE");

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{t("myChores")}</CardTitle>
        <RotateCcw className="h-4 w-4 text-orange-500" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ) : !allInstances.length ? (
          <p className="text-sm text-muted-foreground">{t("noChores")}</p>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {pending.length} {t("pending")}
            </p>
            {allInstances.slice(0, 4).map((instance) => (
              <div key={instance.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate">{instance.chore.title}</span>
                <Badge variant={STATUS_VARIANT[instance.status] ?? "outline"} className="shrink-0 text-[10px]">
                  {tChores(STATUS_I18N[instance.status] ?? "statusPending")}
                </Badge>
              </div>
            ))}
            {allInstances.length > 4 && (
              <Link href="/chores" className="block text-xs text-muted-foreground hover:underline">
                {t("viewAll")} ({allInstances.length})
              </Link>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
