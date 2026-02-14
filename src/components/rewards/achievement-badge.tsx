"use client";

import { useTranslations } from "next-intl";
import { Trophy, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { RARITY_CONFIG } from "@/lib/rewards/constants";
import { cn } from "@/lib/utils";
import type { AchievementRarity } from "@prisma/client";

interface AchievementBadgeProps {
  achievement: {
    id: string;
    name: string;
    description: string | null;
    rarity: AchievementRarity;
    xpReward: number;
    pointsReward: number;
    unlocked: boolean;
    unlockedAt: Date | null;
  };
}

export function AchievementBadge({ achievement }: AchievementBadgeProps) {
  const t = useTranslations("rewards");
  const rConfig = RARITY_CONFIG[achievement.rarity];

  return (
    <div
      className={cn(
        "relative flex flex-col items-center gap-2 rounded-lg border-2 p-4 text-center transition-all",
        achievement.unlocked
          ? rConfig.borderColor
          : "border-dashed border-muted-foreground/30 opacity-60"
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-full",
          achievement.unlocked ? "bg-muted" : "bg-muted/50"
        )}
        style={
          achievement.unlocked ? { borderColor: rConfig.color } : undefined
        }
      >
        {achievement.unlocked ? (
          <Trophy className="h-6 w-6" style={{ color: rConfig.color }} />
        ) : (
          <Lock className="h-5 w-5 text-muted-foreground" />
        )}
      </div>

      {/* Name & description */}
      <div>
        <p className="text-sm font-semibold">{achievement.name}</p>
        {achievement.description && (
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {achievement.description}
          </p>
        )}
      </div>

      {/* Rarity + rewards */}
      <div className="flex items-center gap-1.5">
        <Badge
          variant="outline"
          className="text-[9px]"
          style={{ borderColor: rConfig.color, color: rConfig.color }}
        >
          {t(rConfig.labelKey as "rarityCommon")}
        </Badge>
        {(achievement.xpReward > 0 || achievement.pointsReward > 0) && (
          <span className="text-[9px] text-muted-foreground">
            {achievement.xpReward > 0 && `+${achievement.xpReward} XP`}
            {achievement.xpReward > 0 && achievement.pointsReward > 0 && " · "}
            {achievement.pointsReward > 0 &&
              `+${achievement.pointsReward} pts`}
          </span>
        )}
      </div>

      {/* Unlocked date */}
      {achievement.unlocked && achievement.unlockedAt && (
        <p className="text-[9px] text-muted-foreground">
          {new Date(achievement.unlockedAt).toLocaleDateString()}
        </p>
      )}
    </div>
  );
}
