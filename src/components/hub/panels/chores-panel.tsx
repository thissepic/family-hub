"use client";

import { useTranslations } from "next-intl";
import { Sparkles, CheckCircle2, Circle, AlertTriangle } from "lucide-react";

interface ChoreItem {
  id: string;
  choreTitle: string;
  category: string;
  status: string;
  completedAt: string | Date | null;
  member: { id: string; name: string; color: string };
}

interface ChoresPanelProps {
  data: ChoreItem[];
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "DONE":
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case "OVERDUE":
      return <AlertTriangle className="h-4 w-4 text-orange-500" />;
    case "PENDING_REVIEW":
      return <Circle className="h-4 w-4 text-yellow-500 fill-yellow-500/30" />;
    default:
      return <Circle className="h-4 w-4 text-muted-foreground" />;
  }
}

export function ChoresPanel({ data }: ChoresPanelProps) {
  const t = useTranslations("hub");

  // Sort: pending/overdue first, done last
  const sorted = [...(data || [])].sort((a, b) => {
    if (a.status === "DONE" && b.status !== "DONE") return 1;
    if (a.status !== "DONE" && b.status === "DONE") return -1;
    if (a.status === "OVERDUE" && b.status !== "OVERDUE") return -1;
    return 0;
  });

  return (
    <div className="rounded-xl border bg-card p-4">
      <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
        <Sparkles className="h-5 w-5" />
        {t("choresOverview")}
      </h3>
      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noPendingChores")}</p>
      ) : (
        <div className="space-y-1.5">
          {sorted.map((chore) => (
            <div
              key={chore.id}
              className={`flex items-center gap-2 rounded-lg p-2 text-sm ${
                chore.status === "DONE" ? "opacity-50" : ""
              }`}
            >
              <StatusIcon status={chore.status} />
              <span
                className="inline-block h-3 w-3 rounded-full shrink-0"
                style={{ backgroundColor: chore.member.color }}
                title={chore.member.name}
              />
              <span
                className={`flex-1 truncate ${
                  chore.status === "DONE" ? "line-through" : ""
                }`}
              >
                {chore.choreTitle}
              </span>
              <span className="text-xs text-muted-foreground shrink-0">
                {chore.member.name}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
