"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Trophy, Flame } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { useTRPC } from "@/lib/trpc/client";
import Link from "next/link";

export function XpLevelWidget() {
  const t = useTranslations("dashboard");
  const trpc = useTRPC();

  const { data: profile, isLoading } = useQuery(
    trpc.rewards.getProfile.queryOptions({})
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{t("xpAndLevel")}</CardTitle>
        <Trophy className="h-4 w-4 text-amber-500" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-2 w-full" />
          </div>
        ) : !profile ? (
          <p className="text-sm text-muted-foreground">{t("noXpData")}</p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">{t("level")} {profile.levelInfo.level}</span>
            </div>
            <Progress value={Math.round(profile.levelInfo.progress * 100)} className="h-2" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{profile.levelInfo.currentXp} / {profile.levelInfo.xpForNext ?? "MAX"} XP</span>
              {profile.currentStreak > 0 && (
                <span className="flex items-center gap-1">
                  <Flame className="h-3 w-3 text-orange-500" />
                  {profile.currentStreak}d
                </span>
              )}
            </div>
            <Link href="/rewards" className="block text-xs text-muted-foreground hover:underline">
              {t("viewAll")}
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
