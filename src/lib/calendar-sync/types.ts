import type {
  ExternalCalendarConnection,
  ExternalCalendar,
} from "@prisma/client";

/**
 * A provider-agnostic calendar event, ready to be upserted into the local DB.
 */
export interface MappedEvent {
  externalId: string;
  title: string;
  description: string | null;
  location: string | null;
  startAt: Date;
  endAt: Date;
  allDay: boolean;
  isCancelled: boolean;
}

/**
 * Every calendar provider (Google, Outlook, CalDAV/Apple) must implement
 * this interface so the sync worker can handle them uniformly.
 */
export interface CalendarProviderAdapter {
  /** Refresh OAuth/auth tokens if needed. Throws on permanent failure. */
  refreshAuth(connection: ExternalCalendarConnection): Promise<void>;

  /** Fetch events from an external calendar. Returns mapped local events + optional sync token. */
  fetchEvents(
    connection: ExternalCalendarConnection,
    calendar: ExternalCalendar
  ): Promise<{
    events: MappedEvent[];
    nextSyncToken: string | null;
  }>;
}
