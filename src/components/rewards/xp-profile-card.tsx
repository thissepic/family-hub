"use client";

import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { Flame, Star, Coins, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

export function XpProfileCard({ memberId }: { memberId?: string }) {
  const t = useTranslations("rewards");
  const trpc = useTRPC();

  const { data: profile } = useQuery(
    trpc.rewards.getProfile.queryOptions({ memberId })
  );

  if (!profile) return null;

  const li = profile.levelInfo;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">
            {t("level", { level: String(li.level) })} — {t(li.nameKey)}
          </CardTitle>
          <Badge variant="secondary" className="text-xs">
            <Star className="mr-1 h-3 w-3" />
            {t("totalXp")}: {profile.totalXp}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* XP Progress bar */}
        <div>
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>
              {li.xpForNext
                ? `${li.currentXp} / ${li.xpForNext} XP`
                : "Max Level"}
            </span>
            <span>{Math.round(li.progress * 100)}%</span>
          </div>
          <Progress value={li.progress * 100} className="h-2" />
          {li.xpForNext && (
            <p className="text-[10px] text-muted-foreground mt-1">
              {t("xpToNextLevel", {
                amount: String(li.xpForNext - li.currentXp),
              })}
            </p>
          )}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="flex items-center gap-2 rounded-lg border p-2">
            <Coins className="h-4 w-4 text-amber-500" />
            <div>
              <p className="text-xs text-muted-foreground">{t("yourPoints")}</p>
              <p className="text-sm font-semibold">{profile.points}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border p-2">
            <Flame className="h-4 w-4 text-orange-500" />
            <div>
              <p className="text-xs text-muted-foreground">
                {t("currentStreak")}
              </p>
              <p className="text-sm font-semibold">
                {t("streakDays", { count: String(profile.currentStreak) })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border p-2">
            <TrendingUp className="h-4 w-4 text-blue-500" />
            <div>
              <p className="text-xs text-muted-foreground">
                {t("longestStreak")}
              </p>
              <p className="text-sm font-semibold">
                {t("streakDays", { count: String(profile.longestStreak) })}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
