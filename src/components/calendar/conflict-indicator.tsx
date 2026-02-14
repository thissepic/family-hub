"use client";

import { useTranslations } from "next-intl";
import { TriangleAlert } from "lucide-react";

interface ConflictEvent {
  id: string;
  title: string;
}

interface ConflictIndicatorProps {
  conflicts: ConflictEvent[];
}

export function ConflictIndicator({ conflicts }: ConflictIndicatorProps) {
  const t = useTranslations("calendar");

  if (conflicts.length === 0) return null;

  const eventNames = conflicts.map((c) => c.title).join(", ");

  return (
    <div className="flex items-start gap-2 rounded-md border border-yellow-500/50 bg-yellow-500/10 p-3 text-sm">
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-yellow-600 dark:text-yellow-400" />
      <div>
        <p className="font-medium text-yellow-700 dark:text-yellow-300">
          {t("conflict")}
        </p>
        <p className="text-yellow-600 dark:text-yellow-400">
          {t("conflictWarning", { events: eventNames })}
        </p>
      </div>
    </div>
  );
}
