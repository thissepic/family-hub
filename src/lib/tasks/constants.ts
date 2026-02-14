import { ArrowDown, Minus, ArrowUp, type LucideIcon } from "lucide-react";
import type { TaskPriority } from "@prisma/client";

export const PRIORITIES: TaskPriority[] = ["LOW", "MEDIUM", "HIGH"];

export const PRIORITY_CONFIG: Record<
  TaskPriority,
  { xp: number; color: string; icon: LucideIcon }
> = {
  LOW: { xp: 5, color: "#22c55e", icon: ArrowDown },
  MEDIUM: { xp: 10, color: "#f59e0b", icon: Minus },
  HIGH: { xp: 20, color: "#ef4444", icon: ArrowUp },
};
