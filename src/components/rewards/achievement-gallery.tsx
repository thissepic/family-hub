"use client";

import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { Trophy, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AchievementBadge } from "./achievement-badge";

interface AchievementGalleryProps {
  memberId?: string;
  isAdmin?: boolean;
  onEdit?: (achievement: Record<string, unknown>) => void;
}

export function AchievementGallery({
  memberId,
  isAdmin,
  onEdit,
}: AchievementGalleryProps) {
  const t = useTranslations("rewards");
  const trpc = useTRPC();

  const { data: achievements } = useQuery(
    trpc.rewards.listAchievements.queryOptions({ memberId })
  );

  if (!achievements?.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12">
        <Trophy className="mb-3 h-10 w-10 text-muted-foreground" />
        <p className="text-sm font-medium">{t("noAchievements")}</p>
      </div>
    );
  }

  // Sort: unlocked first, then by rarity
  const sorted = [...achievements].sort((a, b) => {
    if (a.unlocked && !b.unlocked) return -1;
    if (!a.unlocked && b.unlocked) return 1;
    return 0;
  });

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {sorted.map((a) => (
        <div key={a.id} className="relative group">
          <AchievementBadge achievement={a} />
          {isAdmin && onEdit && (
            <div className="absolute top-1.5 right-1.5 flex gap-0.5 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
              <Button
                variant="secondary"
                size="icon"
                className="h-6 w-6"
                onClick={() => onEdit(a)}
              >
                <Pencil className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
