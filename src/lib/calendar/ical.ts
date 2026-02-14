import ICAL from "ical.js";

interface ParsedEvent {
  title: string;
  description: string | null;
  location: string | null;
  startAt: Date;
  endAt: Date;
  allDay: boolean;
  recurrenceRule: string | null;
}

/**
 * Parse an iCal string and extract VEVENT components into event objects.
 */
export function parseIcalString(icalString: string): ParsedEvent[] {
  const jcalData = ICAL.parse(icalString);
  const vcalendar = new ICAL.Component(jcalData);
  const vevents = vcalendar.getAllSubcomponents("vevent");

  return vevents.map((vevent) => {
    const event = new ICAL.Event(vevent);

    const dtstart = vevent.getFirstProperty("dtstart");
    const isAllDay = dtstart?.getParameter("value") === "date";

    let recurrenceRule: string | null = null;
    const rruleProp = vevent.getFirstProperty("rrule");
    if (rruleProp) {
      const rruleValue = rruleProp.getFirstValue();
      if (rruleValue) {
        recurrenceRule = `RRULE:${rruleValue.toString()}`;
      }
    }

    return {
      title: event.summary || "Untitled Event",
      description: event.description || null,
      location: event.location || null,
      startAt: event.startDate.toJSDate(),
      endAt: event.endDate.toJSDate(),
      allDay: isAllDay,
      recurrenceRule,
    };
  });
}

interface EventForExport {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startAt: Date;
  endAt: Date;
  allDay: boolean;
  recurrenceRule: string | null;
}

/**
 * Generate an iCal string from an array of events.
 */
export function generateIcalString(events: EventForExport[]): string {
  const vcalendar = new ICAL.Component(["vcalendar", [], []]);
  vcalendar.updatePropertyWithValue("prodid", "-//FamilyHub//EN");
  vcalendar.updatePropertyWithValue("version", "2.0");
  vcalendar.updatePropertyWithValue("calscale", "GREGORIAN");

  for (const event of events) {
    const vevent = new ICAL.Component("vevent");
    vevent.updatePropertyWithValue("uid", event.id);
    vevent.updatePropertyWithValue("summary", event.title);

    if (event.description) {
      vevent.updatePropertyWithValue("description", event.description);
    }
    if (event.location) {
      vevent.updatePropertyWithValue("location", event.location);
    }

    if (event.allDay) {
      const dtstart = ICAL.Time.fromJSDate(event.startAt, true);
      dtstart.isDate = true;
      vevent.updatePropertyWithValue("dtstart", dtstart);
      const dtend = ICAL.Time.fromJSDate(event.endAt, true);
      dtend.isDate = true;
      vevent.updatePropertyWithValue("dtend", dtend);
    } else {
      vevent.updatePropertyWithValue(
        "dtstart",
        ICAL.Time.fromJSDate(event.startAt, false)
      );
      vevent.updatePropertyWithValue(
        "dtend",
        ICAL.Time.fromJSDate(event.endAt, false)
      );
    }

    if (event.recurrenceRule) {
      // Extract just the RRULE value (remove "RRULE:" prefix if present)
      const rruleValue = event.recurrenceRule.replace(/^RRULE:/, "");
      const rrule = ICAL.Recur.fromString(rruleValue);
      vevent.updatePropertyWithValue("rrule", rrule);
    }

    vevent.updatePropertyWithValue(
      "dtstamp",
      ICAL.Time.fromJSDate(new Date(), false)
    );

    vcalendar.addSubcomponent(vevent);
  }

  return vcalendar.toString();
}
