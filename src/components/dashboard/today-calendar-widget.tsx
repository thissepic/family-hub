"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Calendar, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTRPC } from "@/lib/trpc/client";
import Link from "next/link";

export function TodayCalendarWidget() {
  const t = useTranslations("dashboard");
  const trpc = useTRPC();

  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

  const { data: events, isLoading } = useQuery(
    trpc.calendar.list.queryOptions({ start, end })
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{t("todayCalendar")}</CardTitle>
        <Calendar className="h-4 w-4 text-blue-500" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ) : !events?.length ? (
          <p className="text-sm text-muted-foreground">{t("noEvents")}</p>
        ) : (
          <div className="space-y-2">
            {events.slice(0, 4).map((event) => (
              <div key={event.id} className="flex items-start gap-2 text-sm">
                <Clock className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="truncate font-medium">{event.title}</p>
                  {!event.allDay && (
                    <p className="text-xs text-muted-foreground">
                      {new Date(event.startAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  )}
                </div>
              </div>
            ))}
            {events.length > 4 && (
              <Link href="/calendar" className="block text-xs text-muted-foreground hover:underline">
                {t("viewAll")} ({events.length})
              </Link>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
