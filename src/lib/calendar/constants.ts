import {
  GraduationCap,
  Briefcase,
  Heart,
  Trophy,
  Users,
  Home,
  Calendar,
  type LucideIcon,
} from "lucide-react";

export type CalendarEventCategory =
  | "SCHOOL"
  | "WORK"
  | "MEDICAL"
  | "SPORTS"
  | "SOCIAL"
  | "FAMILY"
  | "OTHER";

export const CATEGORY_COLORS: Record<CalendarEventCategory, string> = {
  SCHOOL: "#f59e0b",
  WORK: "#3b82f6",
  MEDICAL: "#ef4444",
  SPORTS: "#22c55e",
  SOCIAL: "#8b5cf6",
  FAMILY: "#ec4899",
  OTHER: "#6b7280",
};

export const CATEGORY_ICONS: Record<CalendarEventCategory, LucideIcon> = {
  SCHOOL: GraduationCap,
  WORK: Briefcase,
  MEDICAL: Heart,
  SPORTS: Trophy,
  SOCIAL: Users,
  FAMILY: Home,
  OTHER: Calendar,
};

export const CATEGORIES: CalendarEventCategory[] = [
  "SCHOOL",
  "WORK",
  "MEDICAL",
  "SPORTS",
  "SOCIAL",
  "FAMILY",
  "OTHER",
];
