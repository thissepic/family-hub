"use client";

import { useTranslations } from "next-intl";
import {
  CheckSquare,
  Sparkles,
  Calendar,
  ShoppingCart,
  UtensilsCrossed,
  StickyNote,
  Trophy,
  Star,
  Gift,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/components/notifications/notification-item";
import type { ActivityEventType } from "@prisma/client";

interface ActivityEventRowProps {
  event: {
    id: string;
    type: ActivityEventType;
    description: string;
    createdAt: Date;
    member: { id: string; name: string; color: string };
  };
}

const TYPE_ICONS: Record<ActivityEventType, React.ElementType> = {
  TASK_COMPLETED: CheckSquare,
  CHORE_COMPLETED: Sparkles,
  EVENT_CREATED: Calendar,
  EVENT_UPDATED: Calendar,
  SHOPPING_ITEM_ADDED: ShoppingCart,
  MEAL_PLANNED: UtensilsCrossed,
  NOTE_PINNED: StickyNote,
  ACHIEVEMENT_UNLOCKED: Trophy,
  LEVEL_UP: Star,
  REWARD_REDEEMED: Gift,
};

const TYPE_LABEL_KEYS: Record<ActivityEventType, string> = {
  TASK_COMPLETED: "typeTaskCompleted",
  CHORE_COMPLETED: "typeChoreCompleted",
  EVENT_CREATED: "typeEventCreated",
  EVENT_UPDATED: "typeEventUpdated",
  SHOPPING_ITEM_ADDED: "typeShoppingItemAdded",
  MEAL_PLANNED: "typeMealPlanned",
  NOTE_PINNED: "typeNotePinned",
  ACHIEVEMENT_UNLOCKED: "typeAchievementUnlocked",
  LEVEL_UP: "typeLevelUp",
  REWARD_REDEEMED: "typeRewardRedeemed",
};

export function ActivityEventRow({ event }: ActivityEventRowProps) {
  const t = useTranslations("activity");
  const tNotif = useTranslations("notifications");

  const Icon = TYPE_ICONS[event.type] ?? CheckSquare;
  const initial = event.member.name.charAt(0).toUpperCase();

  return (
    <div className="flex items-start gap-3 py-3">
      {/* Member avatar */}
      <div
        className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-medium"
        style={{ backgroundColor: event.member.color }}
      >
        {initial}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm">
          <span className="font-medium">{event.member.name}</span>{" "}
          <span className="text-muted-foreground">{event.description}</span>
        </p>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {formatRelativeTime(event.createdAt, tNotif)}
        </p>
      </div>

      {/* Type badge */}
      <Badge variant="secondary" className="text-[10px] shrink-0 gap-1">
        <Icon className="h-3 w-3" />
        {t(TYPE_LABEL_KEYS[event.type])}
      </Badge>
    </div>
  );
}
