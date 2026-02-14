"use client";

import { Badge } from "@/components/ui/badge";
import { PRIORITY_CONFIG } from "@/lib/tasks/constants";
import type { TaskPriority } from "@prisma/client";

interface PriorityBadgeProps {
  priority: TaskPriority | string;
  showLabel?: boolean;
  className?: string;
}

export function PriorityBadge({
  priority,
  showLabel = true,
  className,
}: PriorityBadgeProps) {
  const config = PRIORITY_CONFIG[priority as TaskPriority];
  if (!config) return null;

  const Icon = config.icon;

  return (
    <Badge
      variant="secondary"
      className={className}
      style={{
        backgroundColor: `${config.color}20`,
        color: config.color,
        borderColor: `${config.color}40`,
      }}
    >
      <Icon className="h-3 w-3" />
      {showLabel && (
        <span className="ml-1 text-xs capitalize">
          {priority.toLowerCase()}
        </span>
      )}
    </Badge>
  );
}
