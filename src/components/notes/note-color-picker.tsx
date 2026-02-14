"use client";

import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { NOTE_COLORS, NOTE_COLOR_LABEL_KEYS } from "@/lib/notes/constants";

interface NoteColorPickerProps {
  value: string | null;
  onChange: (color: string | null) => void;
}

export function NoteColorPicker({ value, onChange }: NoteColorPickerProps) {
  const t = useTranslations("notes");

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {/* No color */}
      <button
        type="button"
        className={cn(
          "h-6 w-6 rounded-full border-2 border-dashed flex items-center justify-center transition-all",
          value === null
            ? "ring-2 ring-offset-2 ring-primary"
            : "hover:ring-1 hover:ring-offset-1 hover:ring-muted-foreground"
        )}
        onClick={() => onChange(null)}
        title={t("noColor")}
      >
        <X className="h-3 w-3 text-muted-foreground" />
      </button>

      {/* Color circles */}
      {NOTE_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          className={cn(
            "h-6 w-6 rounded-full border transition-all",
            value === color
              ? "ring-2 ring-offset-2 ring-primary"
              : "hover:ring-1 hover:ring-offset-1 hover:ring-muted-foreground"
          )}
          style={{ backgroundColor: color }}
          onClick={() => onChange(color)}
          title={t(NOTE_COLOR_LABEL_KEYS[color])}
        />
      ))}
    </div>
  );
}
