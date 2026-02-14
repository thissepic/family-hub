"use client";

import { useTranslations } from "next-intl";
import { CalendarDays } from "lucide-react";

interface UpcomingEvent {
  id: string;
  title: string;
  startAt: string | Date;
  endAt: string | Date;
  allDay: boolean;
  assignees: { id: string; name: string; color: string }[];
}

interface UpcomingDay {
  date: string;
  events: UpcomingEvent[];
}

interface UpcomingPanelProps {
  data: UpcomingDay[];
}

function getDayLabel(dateStr: string, tomorrowLabel: string): string {
  const date = new Date(dateStr + "T00:00:00");
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.toDateString() === tomorrow.toDateString()) {
    return tomorrowLabel;
  }

  return date.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
}

export function UpcomingPanel({ data }: UpcomingPanelProps) {
  const t = useTranslations("hub");

  return (
    <div className="rounded-xl border bg-card p-4">
      <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
        <CalendarDays className="h-5 w-5" />
        {t("upcoming")}
      </h3>
      {!data || data.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noUpcoming")}</p>
      ) : (
        <div className="space-y-3">
          {data.map((day) => (
            <div key={day.date}>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                {getDayLabel(day.date, t("tomorrow"))}
              </h4>
              <div className="space-y-1">
                {day.events.map((event) => {
                  const start = new Date(event.startAt);
                  return (
                    <div
                      key={event.id}
                      className="flex items-center gap-2 rounded-lg p-1.5 bg-accent/20 text-sm"
                    >
                      <span className="text-xs text-muted-foreground tabular-nums min-w-[45px] shrink-0">
                        {event.allDay
                          ? "All day"
                          : start.toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                      </span>
                      <span className="flex-1 truncate">{event.title}</span>
                      <div className="flex items-center gap-0.5 shrink-0">
                        {event.assignees.map((a) => (
                          <span
                            key={a.id}
                            className="inline-block h-2 w-2 rounded-full"
                            style={{ backgroundColor: a.color }}
                            title={a.name}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
