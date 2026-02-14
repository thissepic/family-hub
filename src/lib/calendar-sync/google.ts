import { google, type calendar_v3 } from "googleapis";
import { db } from "@/lib/db";
import { encryptToken, decryptToken } from "./encryption";
import type { ExternalCalendarConnection, ExternalCalendar } from "@prisma/client";
import type { CalendarProviderAdapter, MappedEvent } from "./types";

/**
 * Create a new OAuth2 client configured with Google credentials.
 */
export function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

/**
 * Get an authenticated Google OAuth2 client for a given connection.
 * Handles automatic token refresh if the access token has expired.
 */
export async function getAuthenticatedClient(
  connection: ExternalCalendarConnection
) {
  const oauth2Client = createOAuth2Client();

  const accessToken = decryptToken(connection.accessTokenEncrypted);
  const refreshToken = connection.refreshTokenEncrypted
    ? decryptToken(connection.refreshTokenEncrypted)
    : undefined;

  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
    expiry_date: connection.tokenExpiresAt?.getTime(),
  });

  // Check if token needs refresh
  const isExpired =
    connection.tokenExpiresAt &&
    connection.tokenExpiresAt.getTime() < Date.now() + 60_000; // 1 min buffer

  if (isExpired && refreshToken) {
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();

      if (credentials.access_token) {
        // Re-encrypt and store new tokens
        await db.externalCalendarConnection.update({
          where: { id: connection.id },
          data: {
            accessTokenEncrypted: encryptToken(credentials.access_token),
            tokenExpiresAt: credentials.expiry_date
              ? new Date(credentials.expiry_date)
              : null,
            ...(credentials.refresh_token
              ? {
                  refreshTokenEncrypted: encryptToken(
                    credentials.refresh_token
                  ),
                }
              : {}),
          },
        });

        oauth2Client.setCredentials(credentials);
      }
    } catch (err) {
      // Mark connection as expired if refresh fails
      await db.externalCalendarConnection.update({
        where: { id: connection.id },
        data: { status: "EXPIRED" },
      });
      throw new Error(`Token refresh failed for connection ${connection.id}: ${err}`);
    }
  }

  return oauth2Client;
}

/**
 * Fetch the list of calendars for the authenticated user.
 */
export async function fetchCalendarList(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any
): Promise<{ id: string; summary: string; backgroundColor: string | null }[]> {
  const calendarApi = google.calendar({ version: "v3", auth: client });
  const response = await calendarApi.calendarList.list();
  const items = response.data.items ?? [];

  return items
    .filter((cal) => !!cal.id)
    .map((cal) => ({
      id: cal.id!,
      summary: cal.summary ?? cal.id!,
      backgroundColor: cal.backgroundColor ?? null,
    }));
}

/**
 * Fetch events from a specific Google Calendar.
 * Uses syncToken for incremental sync when available.
 */
export async function fetchCalendarEvents(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  calendarId: string,
  options: {
    syncToken?: string | null;
    timeMin?: string;
    timeMax?: string;
  }
): Promise<{
  events: calendar_v3.Schema$Event[];
  nextSyncToken: string | null;
}> {
  const calendarApi = google.calendar({ version: "v3", auth: client });
  const allEvents: calendar_v3.Schema$Event[] = [];
  let pageToken: string | undefined;
  let nextSyncToken: string | null = null;

  try {
    do {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const params: any = {
        calendarId,
        maxResults: 250,
        singleEvents: true,
        orderBy: "startTime",
        pageToken,
      };

      if (options.syncToken) {
        // Incremental sync — only use syncToken, not time filters
        params.syncToken = options.syncToken;
      } else {
        // Full sync — use time range (sync last 30 days + next 365 days)
        params.timeMin =
          options.timeMin ??
          new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        params.timeMax =
          options.timeMax ??
          new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
      }

      const response = await calendarApi.events.list(params);
      const items = response.data.items ?? [];
      allEvents.push(...items);

      pageToken = response.data.nextPageToken ?? undefined;
      if (response.data.nextSyncToken) {
        nextSyncToken = response.data.nextSyncToken;
      }
    } while (pageToken);
  } catch (err: unknown) {
    // If syncToken is invalid (410 Gone), fall back to full sync
    const error = err as { code?: number };
    if (error.code === 410 && options.syncToken) {
      return fetchCalendarEvents(client, calendarId, {
        timeMin: options.timeMin,
        timeMax: options.timeMax,
      });
    }
    throw err;
  }

  return { events: allEvents, nextSyncToken };
}

/**
 * Map a Google Calendar event to our local CalendarEvent shape.
 * Applies privacy mode masking if configured.
 */
export function mapGoogleEventToLocal(
  gEvent: calendar_v3.Schema$Event,
  externalCalendar: ExternalCalendar & { connectionId: string }
): {
  externalId: string;
  title: string;
  description: string | null;
  location: string | null;
  startAt: Date;
  endAt: Date;
  allDay: boolean;
  isCancelled: boolean;
} | null {
  if (!gEvent.id) return null;

  const isCancelled = gEvent.status === "cancelled";

  // For cancelled events, we only need the ID
  if (isCancelled) {
    return {
      externalId: gEvent.id,
      title: "",
      description: null,
      location: null,
      startAt: new Date(),
      endAt: new Date(),
      allDay: false,
      isCancelled: true,
    };
  }

  // Determine if all-day event
  const allDay = !!(gEvent.start?.date && !gEvent.start?.dateTime);

  // Parse start/end times
  let startAt: Date;
  let endAt: Date;

  if (allDay) {
    startAt = new Date(gEvent.start!.date!);
    endAt = new Date(gEvent.end?.date ?? gEvent.start!.date!);
  } else {
    startAt = new Date(
      gEvent.start?.dateTime ?? gEvent.start?.date ?? new Date()
    );
    endAt = new Date(
      gEvent.end?.dateTime ?? gEvent.end?.date ?? startAt
    );
  }

  // Apply privacy mode masking
  const isBusyFreeOnly = externalCalendar.privacyMode === "BUSY_FREE_ONLY";

  return {
    externalId: gEvent.id,
    title: isBusyFreeOnly ? "Busy" : (gEvent.summary ?? "Untitled"),
    description: isBusyFreeOnly ? null : (gEvent.description ?? null),
    location: isBusyFreeOnly ? null : (gEvent.location ?? null),
    startAt,
    endAt,
    allDay,
    isCancelled: false,
  };
}

/**
 * Adapter that wraps the existing Google Calendar functions
 * into the unified CalendarProviderAdapter interface.
 */
export class GoogleCalendarAdapter implements CalendarProviderAdapter {
  async refreshAuth(connection: ExternalCalendarConnection): Promise<void> {
    // getAuthenticatedClient handles token refresh internally
    await getAuthenticatedClient(connection);
  }

  async fetchEvents(
    connection: ExternalCalendarConnection,
    calendar: ExternalCalendar
  ): Promise<{ events: MappedEvent[]; nextSyncToken: string | null }> {
    const client = await getAuthenticatedClient(connection);
    const { events, nextSyncToken } = await fetchCalendarEvents(
      client,
      calendar.externalCalendarId,
      { syncToken: calendar.lastSyncToken }
    );

    const mapped = events
      .map((e) =>
        mapGoogleEventToLocal(
          e,
          calendar as ExternalCalendar & { connectionId: string }
        )
      )
      .filter(Boolean) as MappedEvent[];

    return { events: mapped, nextSyncToken };
  }
}
