// ─── Note Colors ─────────────────────────────────────────────
// Pastel sticky-note palette

export const NOTE_COLORS = [
  "#fef08a", // yellow
  "#bbf7d0", // green
  "#bfdbfe", // blue
  "#fbcfe8", // pink
  "#ddd6fe", // purple
  "#fed7aa", // orange
  "#fecaca", // red
  "#e5e7eb", // gray
] as const;

export type NoteColor = (typeof NOTE_COLORS)[number];

export const NOTE_COLOR_LABEL_KEYS: Record<string, string> = {
  "#fef08a": "colorYellow",
  "#bbf7d0": "colorGreen",
  "#bfdbfe": "colorBlue",
  "#fbcfe8": "colorPink",
  "#ddd6fe": "colorPurple",
  "#fed7aa": "colorOrange",
  "#fecaca": "colorRed",
  "#e5e7eb": "colorGray",
};

// ─── Note Categories ─────────────────────────────────────────

export const NOTE_CATEGORIES = [
  "Important",
  "School",
  "Household",
  "Fun",
  "Reminders",
  "Other",
] as const;

export type NoteCategory = (typeof NOTE_CATEGORIES)[number];

export const NOTE_CATEGORY_LABEL_KEYS: Record<string, string> = {
  Important: "categoryImportant",
  School: "categorySchool",
  Household: "categoryHousehold",
  Fun: "categoryFun",
  Reminders: "categoryReminders",
  Other: "categoryOther",
};
