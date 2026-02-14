"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useTRPC } from "@/lib/trpc/client";
import { TodayCalendarWidget } from "@/components/dashboard/today-calendar-widget";
import { MyTasksWidget } from "@/components/dashboard/my-tasks-widget";
import { MyChoresWidget } from "@/components/dashboard/my-chores-widget";
import { ShoppingWidget } from "@/components/dashboard/shopping-widget";
import { MealOfDayWidget } from "@/components/dashboard/meal-of-day-widget";
import { PinnedNotesWidget } from "@/components/dashboard/pinned-notes-widget";
import { XpLevelWidget } from "@/components/dashboard/xp-level-widget";
import { RecentActivityWidget } from "@/components/dashboard/recent-activity-widget";

function getTimeOfDay(): "morning" | "afternoon" | "evening" {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const trpc = useTRPC();

  const { data: session } = useQuery(trpc.auth.getSession.queryOptions());
  const { data: membersList } = useQuery(trpc.members.list.queryOptions());
  const currentMember = membersList?.find(
    (m) => m.id === session?.memberId
  );

  const timeOfDay = getTimeOfDay();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {t("greeting", {
            timeOfDay: t(timeOfDay),
            name: currentMember?.name || "",
          })}
        </h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <TodayCalendarWidget />
        <MyTasksWidget />
        <MyChoresWidget />
        <ShoppingWidget />
        <MealOfDayWidget />
        <PinnedNotesWidget />
        <XpLevelWidget />
        <RecentActivityWidget />
      </div>
    </div>
  );
}
