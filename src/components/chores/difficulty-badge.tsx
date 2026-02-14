"use client";

import { Badge } from "@/components/ui/badge";
import { DIFFICULTY_CONFIG } from "@/lib/chores/constants";
import type { ChoreDifficulty } from "@prisma/client";

interface DifficultyBadgeProps {
  difficulty: ChoreDifficulty | string;
  showLabel?: boolean;
  className?: string;
}

export function DifficultyBadge({
  difficulty,
  showLabel = true,
  className,
}: DifficultyBadgeProps) {
  const config = DIFFICULTY_CONFIG[difficulty as ChoreDifficulty];
  if (!config) return null;

  const Icon = config.icon;

  return (
    <Badge
      variant="secondary"
      className={className}
      style={{
        backgroundColor: `${config.color}20`,
        color: config.color,
        borderColor: `${config.color}40`,
      }}
    >
      <Icon className="h-3 w-3" />
      {showLabel && (
        <span className="ml-1 text-xs capitalize">
          {difficulty.toLowerCase()}
        </span>
      )}
    </Badge>
  );
}
