/**
 * Get the Monday of the week containing the given date.
 */
export function getMonday(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  // Sunday = 0, so shift back 6; otherwise shift back (day - 1)
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

/**
 * Get an array of 7 Date objects (Mon–Sun) for the week starting at monday.
 */
export function getWeekDays(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

/**
 * Format a week range string, e.g. "Feb 10 – 16, 2026".
 */
export function formatWeekRange(monday: Date): string {
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const monthFmt = new Intl.DateTimeFormat("en", { month: "short" });
  const sameMonth = monday.getMonth() === sunday.getMonth();

  if (sameMonth) {
    return `${monthFmt.format(monday)} ${monday.getDate()} – ${sunday.getDate()}, ${monday.getFullYear()}`;
  }

  return `${monthFmt.format(monday)} ${monday.getDate()} – ${monthFmt.format(sunday)} ${sunday.getDate()}, ${sunday.getFullYear()}`;
}

/**
 * Shift a date by N weeks.
 */
export function addWeeks(date: Date, weeks: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + weeks * 7);
  return d;
}

/**
 * Format a date as ISO date string (YYYY-MM-DD).
 */
export function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
