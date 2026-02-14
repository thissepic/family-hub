"use client";

import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { Users, Flame } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface LeaderboardProps {
  currentMemberId?: string;
}

const RANK_ICONS = ["🥇", "🥈", "🥉"];

export function Leaderboard({ currentMemberId }: LeaderboardProps) {
  const t = useTranslations("rewards");
  const trpc = useTRPC();

  const { data: entries } = useQuery(
    trpc.rewards.getLeaderboard.queryOptions()
  );

  if (!entries?.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12">
        <Users className="mb-3 h-10 w-10 text-muted-foreground" />
        <p className="text-sm font-medium">{t("noMembers")}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border">
      {/* Header */}
      <div className="grid grid-cols-[3rem_1fr_4rem_5rem_4rem] gap-2 px-3 py-2 border-b text-[10px] font-medium text-muted-foreground uppercase">
        <span>{t("rank")}</span>
        <span>{t("member")}</span>
        <span className="text-right">Level</span>
        <span className="text-right">{t("totalXp")}</span>
        <span className="text-right">
          <Flame className="h-3 w-3 inline" />
        </span>
      </div>

      {/* Rows */}
      {entries.map((entry) => (
        <div
          key={entry.memberId}
          className={cn(
            "grid grid-cols-[3rem_1fr_4rem_5rem_4rem] gap-2 px-3 py-2.5 items-center",
            currentMemberId === entry.memberId && "bg-muted/50"
          )}
        >
          {/* Rank */}
          <span className="text-sm font-semibold">
            {entry.rank <= 3 ? RANK_ICONS[entry.rank - 1] : `#${entry.rank}`}
          </span>

          {/* Member */}
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-medium shrink-0"
              style={{
                backgroundColor: entry.member.avatar ? "transparent" : entry.member.color,
                color: entry.member.avatar ? undefined : "white",
              }}
            >
              {entry.member.avatar || entry.member.name.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm font-medium truncate">
              {entry.member.name}
            </span>
          </div>

          {/* Level */}
          <div className="text-right">
            <Badge variant="secondary" className="text-[10px]">
              Lv.{entry.level}
            </Badge>
          </div>

          {/* XP */}
          <span className="text-sm text-right font-medium">
            {entry.totalXp.toLocaleString()}
          </span>

          {/* Streak */}
          <span className="text-sm text-right text-muted-foreground">
            {entry.currentStreak}d
          </span>
        </div>
      ))}
    </div>
  );
}
