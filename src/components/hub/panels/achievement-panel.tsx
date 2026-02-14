"use client";

import { useTranslations } from "next-intl";
import { Award } from "lucide-react";
import { RARITY_CONFIG } from "@/lib/rewards/constants";
import type { AchievementRarity } from "@prisma/client";

interface AchievementItem {
  id: string;
  memberName: string;
  memberColor: string;
  achievementName: string;
  rarity: string;
  description: string | null;
  unlockedAt: string | Date;
}

interface AchievementPanelProps {
  data: AchievementItem[];
}

export function AchievementPanel({ data }: AchievementPanelProps) {
  const t = useTranslations("hub");

  return (
    <div className="rounded-xl border bg-card p-4">
      <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
        <Award className="h-5 w-5" />
        {t("recentAchievements")}
      </h3>
      {!data || data.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noAchievements")}</p>
      ) : (
        <div className="space-y-2">
          {data.map((item) => {
            const rarityConfig =
              RARITY_CONFIG[item.rarity as AchievementRarity] ??
              RARITY_CONFIG.COMMON;

            return (
              <div
                key={item.id}
                className={`rounded-lg border-l-4 p-2 bg-accent/10 ${rarityConfig.borderColor}`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-3 w-3 rounded-full shrink-0"
                    style={{ backgroundColor: item.memberColor }}
                  />
                  <span className="text-sm font-medium truncate">
                    {item.memberName}
                  </span>
                  <span className="text-xs text-muted-foreground ml-auto shrink-0">
                    {new Date(item.unlockedAt).toLocaleDateString([], {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
                <p className="text-sm mt-1 font-semibold">
                  {item.achievementName}
                </p>
                {item.description && (
                  <p className="text-xs text-muted-foreground truncate">
                    {item.description}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
