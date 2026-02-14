import { rrulestr } from "rrule";

export interface Period {
  start: Date; // date-only (00:00:00)
  end: Date; // date-only (00:00:00)
}

/**
 * Strip time from a Date, returning a date-only value at midnight.
 */
function dateOnly(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Compute the current period for a chore given its RRULE and anchor date.
 *
 * The "period" is the span between two consecutive RRULE occurrences:
 *   - periodStart = the most recent occurrence on or before referenceDate
 *   - periodEnd   = the day before the next occurrence after periodStart
 *
 * For DAILY rules: period is a single day (start === end).
 * For WEEKLY rules: period is 7 days.
 * For custom "every 3 days": period is 3 days.
 * For multi-day rules (e.g. BYDAY=TU,TH): each occurrence gets its own period.
 *
 * Returns null if the reference date is before the first occurrence
 * (e.g. a finite rule that hasn't started yet).
 */
export function getCurrentPeriodFromRule(
  recurrenceRule: string,
  recurrenceStart: Date,
  referenceDate?: Date,
): Period | null {
  const ref = referenceDate ? dateOnly(referenceDate) : dateOnly(new Date());

  // Parse with end-of-day to ensure the reference day itself is included
  const refEndOfDay = new Date(
    ref.getFullYear(),
    ref.getMonth(),
    ref.getDate(),
    23,
    59,
    59,
  );

  const rule = rrulestr(recurrenceRule, { dtstart: recurrenceStart });

  // Find the most recent occurrence on or before the reference date
  const before = rule.before(refEndOfDay, true);
  if (!before) {
    return null; // Reference date is before the first occurrence
  }

  const periodStart = dateOnly(before);

  // Find the next occurrence after periodStart
  const afterStart = new Date(
    periodStart.getFullYear(),
    periodStart.getMonth(),
    periodStart.getDate(),
    23,
    59,
    59,
  );
  const nextOccurrence = rule.after(afterStart, false);

  if (!nextOccurrence) {
    // Finite rule exhausted — last period is a single day
    return { start: periodStart, end: periodStart };
  }

  // periodEnd = day before the next occurrence
  const nextDay = dateOnly(nextOccurrence);
  const periodEnd = new Date(
    nextDay.getFullYear(),
    nextDay.getMonth(),
    nextDay.getDate() - 1,
  );

  // If periodEnd < periodStart (same-day occurrences edge case), use periodStart
  if (periodEnd < periodStart) {
    return { start: periodStart, end: periodStart };
  }

  return { start: periodStart, end: periodEnd };
}

/**
 * Compute the period immediately following the given one.
 * Returns null if the rule has no further occurrences.
 */
export function getNextPeriodFromRule(
  recurrenceRule: string,
  recurrenceStart: Date,
  currentPeriod: Period,
): Period | null {
  const dayAfterEnd = new Date(
    currentPeriod.end.getFullYear(),
    currentPeriod.end.getMonth(),
    currentPeriod.end.getDate() + 1,
  );
  return getCurrentPeriodFromRule(recurrenceRule, recurrenceStart, dayAfterEnd);
}
