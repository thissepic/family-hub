import { rrulestr } from "rrule";

interface CalendarEventForExpansion {
  id: string;
  startAt: Date;
  endAt: Date;
  recurrenceRule: string;
}

export interface RecurringInstance {
  parentEventId: string;
  startAt: Date;
  endAt: Date;
  isRecurringInstance: true;
  originalStartAt: Date;
}

/**
 * Expand a recurring event into individual instances within a date range.
 * Uses the RRULE standard to calculate occurrence dates while preserving
 * the original event duration for each instance.
 */
export function expandRecurrence(
  event: CalendarEventForExpansion,
  rangeStart: Date,
  rangeEnd: Date
): RecurringInstance[] {
  const durationMs = event.endAt.getTime() - event.startAt.getTime();

  try {
    const rule = rrulestr(event.recurrenceRule, {
      dtstart: event.startAt,
    });

    // Get occurrences within the date range
    const occurrences = rule.between(rangeStart, rangeEnd, true);

    return occurrences.map((occurrenceStart) => ({
      parentEventId: event.id,
      startAt: occurrenceStart,
      endAt: new Date(occurrenceStart.getTime() + durationMs),
      isRecurringInstance: true as const,
      originalStartAt: occurrenceStart,
    }));
  } catch (error) {
    console.error(
      `Failed to expand recurrence for event ${event.id}:`,
      error
    );
    return [];
  }
}

/**
 * Add an EXDATE (exception date) to an existing recurrence rule string.
 * EXDATEs exclude specific occurrences from a recurring series.
 */
export function addExdateToRule(
  recurrenceRule: string,
  exdate: Date
): string {
  const exdateStr = exdate.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  // Check if there's already an EXDATE line
  if (recurrenceRule.includes("EXDATE")) {
    return recurrenceRule.replace(
      /(EXDATE[^:\n]*:)([^\n]*)/,
      `$1$2,${exdateStr}`
    );
  }

  return `${recurrenceRule}\nEXDATE:${exdateStr}`;
}
