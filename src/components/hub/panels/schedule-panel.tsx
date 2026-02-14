"use client";

import { useTranslations } from "next-intl";
import { Calendar } from "lucide-react";

interface ScheduleEvent {
  id: string;
  title: string;
  startAt: string | Date;
  endAt: string | Date;
  allDay: boolean;
  category: string;
  location: string | null;
  assignees: { id: string; name: string; color: string }[];
}

interface SchedulePanelProps {
  data: ScheduleEvent[];
}

export function SchedulePanel({ data }: SchedulePanelProps) {
  const t = useTranslations("hub");
  const now = new Date();

  if (!data || data.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-4">
        <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
          <Calendar className="h-5 w-5" />
          {t("todaySchedule")}
        </h3>
        <p className="text-sm text-muted-foreground">{t("noEvents")}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-4">
      <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
        <Calendar className="h-5 w-5" />
        {t("todaySchedule")}
      </h3>
      <div className="space-y-2">
        {data.map((event) => {
          const start = new Date(event.startAt);
          const isPast = start < now;
          return (
            <div
              key={event.id}
              className={`flex items-start gap-3 rounded-lg p-2 ${
                isPast ? "opacity-50" : "bg-accent/30"
              }`}
            >
              <div className="flex flex-col items-center min-w-[50px]">
                {event.allDay ? (
                  <span className="text-xs font-medium text-muted-foreground">
                    All day
                  </span>
                ) : (
                  <>
                    <span className="text-sm font-semibold tabular-nums">
                      {start.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {new Date(event.endAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{event.title}</p>
                {event.assignees.length > 0 && (
                  <div className="flex items-center gap-1 mt-0.5">
                    {event.assignees.map((a) => (
                      <span
                        key={a.id}
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: a.color }}
                        title={a.name}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
