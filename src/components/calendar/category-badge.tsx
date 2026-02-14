"use client";

import { useTranslations } from "next-intl";
import {
  CATEGORY_COLORS,
  CATEGORY_ICONS,
  type CalendarEventCategory,
} from "@/lib/calendar/constants";
import { Badge } from "@/components/ui/badge";

const CATEGORY_KEYS: Record<CalendarEventCategory, string> = {
  SCHOOL: "categorySchool",
  WORK: "categoryWork",
  MEDICAL: "categoryMedical",
  SPORTS: "categorySports",
  SOCIAL: "categorySocial",
  FAMILY: "categoryFamily",
  OTHER: "categoryOther",
};

interface CategoryBadgeProps {
  category: CalendarEventCategory;
  className?: string;
}

export function CategoryBadge({ category, className }: CategoryBadgeProps) {
  const t = useTranslations("calendar");
  const Icon = CATEGORY_ICONS[category];
  const color = CATEGORY_COLORS[category];

  return (
    <Badge
      variant="outline"
      className={className}
      style={{
        borderColor: color,
        color: color,
        backgroundColor: `${color}15`,
      }}
    >
      <Icon className="mr-1 h-3 w-3" />
      {t(CATEGORY_KEYS[category])}
    </Badge>
  );
}
