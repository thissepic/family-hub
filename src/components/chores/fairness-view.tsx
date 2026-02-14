"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { BarChart3 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PERIOD_OPTIONS = [
  { value: "30", label: "30" },
  { value: "60", label: "60" },
  { value: "90", label: "90" },
];

export function FairnessView() {
  const t = useTranslations("chores");
  const trpc = useTRPC();

  const [days, setDays] = useState(30);

  const { data: stats, isLoading } = useQuery(
    trpc.chores.fairnessStats.queryOptions({ days })
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">{t("fairnessTitle")}...</p>
      </div>
    );
  }

  const maxCompletions = Math.max(1, ...(stats?.map((s) => s.completions) ?? [1]));

  return (
    <div className="space-y-4">
      {/* Period selector */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">{t("fairnessTitle")}</h3>
        <Select
          value={String(days)}
          onValueChange={(v) => setDays(Number(v))}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {t("fairnessPeriod", { days: opt.label })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      {!stats || stats.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12">
          <BarChart3 className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm font-medium">{t("noChoresForPeriod")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 px-2 text-xs font-medium text-muted-foreground">
            <span />
            <span className="w-20 text-right">{t("completions")}</span>
            <span className="w-20 text-right">{t("totalXp")}</span>
            <span className="w-20 text-right">{t("avgPerWeek")}</span>
          </div>

          {/* Rows */}
          {stats.map((stat) => (
            <div
              key={stat.memberId}
              className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 rounded-md border p-3"
            >
              {/* Member + bar */}
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span
                    className="h-3 w-3 rounded-full shrink-0"
                    style={{ backgroundColor: stat.memberColor }}
                  />
                  <span className="text-sm font-medium truncate">
                    {stat.memberName}
                  </span>
                </div>
                {/* Horizontal bar */}
                <div className="h-2 w-full rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${(stat.completions / maxCompletions) * 100}%`,
                      backgroundColor: stat.memberColor,
                    }}
                  />
                </div>
              </div>

              {/* Numbers */}
              <span className="w-20 text-right text-sm font-medium tabular-nums">
                {stat.completions}
              </span>
              <span className="w-20 text-right text-sm font-medium tabular-nums">
                {stat.totalXp}
              </span>
              <span className="w-20 text-right text-sm text-muted-foreground tabular-nums">
                {stat.avgPerWeek}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
