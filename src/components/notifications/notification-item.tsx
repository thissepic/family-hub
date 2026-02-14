"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  Bell,
  Calendar,
  Repeat2,
  Gift,
  Trophy,
  Star,
  Megaphone,
  Eye,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { NotificationType } from "@prisma/client";

interface NotificationItemProps {
  notification: {
    id: string;
    type: NotificationType;
    title: string;
    message: string;
    linkUrl: string | null;
    read: boolean;
    createdAt: Date;
  };
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
}

const TYPE_ICONS: Record<NotificationType, React.ElementType> = {
  CALENDAR_REMINDER: Calendar,
  CHORE_DEADLINE: Bell,
  SWAP_REQUEST: Repeat2,
  REWARD_APPROVAL: Gift,
  ACHIEVEMENT: Trophy,
  LEVEL_UP: Star,
  ADMIN_ANNOUNCEMENT: Megaphone,
};

const TYPE_LABEL_KEYS: Record<NotificationType, string> = {
  CALENDAR_REMINDER: "typeCalendarReminder",
  CHORE_DEADLINE: "typeChoreDeadline",
  SWAP_REQUEST: "typeSwapRequest",
  REWARD_APPROVAL: "typeRewardApproval",
  ACHIEVEMENT: "typeAchievement",
  LEVEL_UP: "typeLevelUp",
  ADMIN_ANNOUNCEMENT: "typeAdminAnnouncement",
};

export function formatRelativeTime(
  date: Date,
  t: (key: string, values?: Record<string, string>) => string
): string {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return t("justNow");
  if (diffMin < 60) return t("minutesAgo", { count: String(diffMin) });
  if (diffHrs < 24) return t("hoursAgo", { count: String(diffHrs) });
  return t("daysAgo", { count: String(diffDays) });
}

export function NotificationItem({
  notification,
  onMarkRead,
  onDelete,
}: NotificationItemProps) {
  const t = useTranslations("notifications");
  const router = useRouter();

  const Icon = TYPE_ICONS[notification.type] ?? Bell;

  const handleClick = () => {
    if (!notification.read) {
      onMarkRead(notification.id);
    }
    // Only navigate to relative paths to prevent open redirects
    if (notification.linkUrl && notification.linkUrl.startsWith("/")) {
      router.push(notification.linkUrl);
    }
  };

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border p-3 transition-colors",
        !notification.read && "bg-muted/50 border-l-primary border-l-2",
        notification.linkUrl && "cursor-pointer hover:bg-muted/30"
      )}
      onClick={handleClick}
    >
      {/* Type icon */}
      <div className="shrink-0 mt-0.5">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p
            className={cn(
              "text-sm truncate",
              !notification.read && "font-semibold"
            )}
          >
            {notification.title}
          </p>
          <span className="text-[10px] text-muted-foreground uppercase shrink-0">
            {t(TYPE_LABEL_KEYS[notification.type])}
          </span>
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
          {notification.message}
        </p>
        <p className="text-[10px] text-muted-foreground mt-1">
          {formatRelativeTime(notification.createdAt, t)}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-0.5 shrink-0">
        {!notification.read && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => {
              e.stopPropagation();
              onMarkRead(notification.id);
            }}
            title={t("markRead")}
          >
            <Eye className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(notification.id);
          }}
          title={t("delete")}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
