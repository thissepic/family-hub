"use client";

import { cn } from "@/lib/utils";

const COLORS = [
  "#3b82f6", // blue
  "#ef4444", // red
  "#22c55e", // green
  "#f59e0b", // amber
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#f97316", // orange
  "#14b8a6", // teal
  "#6366f1", // indigo
  "#84cc16", // lime
  "#a855f7", // purple
];

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {COLORS.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          className={cn(
            "h-8 w-8 rounded-full transition-all",
            value === color
              ? "ring-2 ring-offset-2 ring-offset-background ring-primary scale-110"
              : "hover:scale-105"
          )}
          style={{ backgroundColor: color }}
        />
      ))}
    </div>
  );
}
