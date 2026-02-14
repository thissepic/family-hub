"use client";

import { useTranslations } from "next-intl";
import { Activity } from "lucide-react";

interface ActivityItem {
  id: string;
  type: string;
  description: string;
  memberName: string;
  memberColor: string;
  createdAt: string | Date;
}

interface ActivityPanelProps {
  data: ActivityItem[];
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function ActivityPanel({ data }: ActivityPanelProps) {
  const t = useTranslations("hub");

  return (
    <div className="rounded-xl border bg-card p-4">
      <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
        <Activity className="h-5 w-5" />
        {t("activityFeed")}
      </h3>
      {!data || data.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noActivity")}</p>
      ) : (
        <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
          {data.map((item) => (
            <div
              key={item.id}
              className="flex items-start gap-2 text-sm rounded-lg p-1.5"
            >
              <span
                className="inline-block h-2.5 w-2.5 rounded-full shrink-0 mt-1"
                style={{ backgroundColor: item.memberColor }}
              />
              <span className="flex-1 text-xs">
                <span className="font-medium">{item.memberName}</span>{" "}
                <span className="text-muted-foreground">
                  {item.description}
                </span>
              </span>
              <span className="text-xs text-muted-foreground shrink-0">
                {formatRelativeTime(new Date(item.createdAt))}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
