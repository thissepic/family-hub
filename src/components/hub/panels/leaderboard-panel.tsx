"use client";

import { useTranslations } from "next-intl";
import { Trophy, Flame } from "lucide-react";
import { calculateLevel } from "@/lib/rewards/constants";

interface LeaderboardEntry {
  memberId: string;
  name: string;
  color: string;
  avatar?: string | null;
  totalXp: number;
  level: number;
  currentStreak: number;
  points: number;
}

interface LeaderboardPanelProps {
  data: LeaderboardEntry[];
}

const MEDALS = ["🥇", "🥈", "🥉"];

export function LeaderboardPanel({ data }: LeaderboardPanelProps) {
  const t = useTranslations("hub");

  if (!data || data.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-4">
        <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
          <Trophy className="h-5 w-5" />
          {t("familyLeaderboard")}
        </h3>
        <p className="text-sm text-muted-foreground">—</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-4">
      <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
        <Trophy className="h-5 w-5" />
        {t("familyLeaderboard")}
      </h3>
      <div className="space-y-2">
        {data.map((entry, idx) => {
          const levelInfo = calculateLevel(entry.totalXp);
          return (
            <div
              key={entry.memberId}
              className="flex items-center gap-3 rounded-lg p-2 bg-accent/20"
            >
              <span className="text-lg w-7 text-center shrink-0">
                {idx < 3 ? MEDALS[idx] : `${idx + 1}.`}
              </span>
              <span
                className="h-5 w-5 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: entry.color }}
              >
                {entry.avatar ? (
                  <span className="text-xs leading-none">{entry.avatar}</span>
                ) : null}
              </span>
              <span className="flex-1 font-medium text-sm truncate">
                {entry.name}
              </span>
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full shrink-0">
                {t("level", { level: levelInfo.level })}
              </span>
              <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                {t("xp", { xp: entry.totalXp })}
              </span>
              {entry.currentStreak > 0 && (
                <span className="flex items-center gap-0.5 text-xs text-orange-500 shrink-0">
                  <Flame className="h-3 w-3" />
                  {entry.currentStreak}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
