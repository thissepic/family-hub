import { ConfidentialClientApplication } from "@azure/msal-node";
import { db } from "@/lib/db";
import { encryptToken, decryptToken } from "./encryption";
import type { ExternalCalendarConnection, ExternalCalendar } from "@prisma/client";
import type { CalendarProviderAdapter, MappedEvent } from "./types";

// ─── MSAL Configuration ──────────────────────────────────────────

function createMsalClient(): ConfidentialClientApplication {
  return new ConfidentialClientApplication({
    auth: {
      clientId: process.env.MICROSOFT_CLIENT_ID!,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
      authority: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID || "common"}`,
    },
  });
}

const SCOPES = ["Calendars.Read", "User.Read", "offline_access"];
const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

// ─── Graph API Helper ────────────────────────────────────────────

async function fetchWithGraph(
  accessToken: string,
  url: string
): Promise<unknown> {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const error = new Error(
      `Graph API ${res.status}: ${body.slice(0, 200)}`
    ) as Error & { status: number };
    error.status = res.status;
    throw error;
  }

  return res.json();
}

// ─── Public: Get Auth URL ────────────────────────────────────────

export async function getOutlookAuthUrl(): Promise<string> {
  const msalClient = createMsalClient();
  return msalClient.getAuthCodeUrl({
    scopes: SCOPES,
    redirectUri: process.env.MICROSOFT_REDIRECT_URI!,
  });
}

// ─── Public: Exchange Code for Tokens ────────────────────────────

export async function exchangeOutlookCode(code: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresOn: Date | null;
}> {
  const msalClient = createMsalClient();
  const result = await msalClient.acquireTokenByCode({
    code,
    scopes: SCOPES,
    redirectUri: process.env.MICROSOFT_REDIRECT_URI!,
  });

  // MSAL caches refresh tokens internally; extract from token cache
  const cache = msalClient.getTokenCache().serialize();
  const cacheData = JSON.parse(cache);
  const refreshTokens = Object.values(
    cacheData.RefreshToken || {}
  ) as Array<{ secret: string }>;
  const refreshToken = refreshTokens[0]?.secret ?? "";

  return {
    accessToken: result.accessToken,
    refreshToken,
    expiresOn: result.expiresOn,
  };
}

// ─── Public: Fetch Calendar List ─────────────────────────────────

export async function fetchOutlookCalendarList(
  accessToken: string
): Promise<
  { id: string; name: string; color: string | null }[]
> {
  const data = (await fetchWithGraph(
    accessToken,
    `${GRAPH_BASE}/me/calendars?$select=id,name,hexColor`
  )) as { value: Array<{ id: string; name: string; hexColor?: string }> };

  return data.value.map((cal) => ({
    id: cal.id,
    name: cal.name,
    color: cal.hexColor ? `#${cal.hexColor}` : null,
  }));
}

// ─── Outlook Adapter ─────────────────────────────────────────────

export class OutlookCalendarAdapter implements CalendarProviderAdapter {
  async refreshAuth(connection: ExternalCalendarConnection): Promise<void> {
    const refreshTokenEncrypted = connection.refreshTokenEncrypted;
    if (!refreshTokenEncrypted) {
      throw Object.assign(new Error("No refresh token"), { code: 401 });
    }

    const isExpired =
      connection.tokenExpiresAt &&
      connection.tokenExpiresAt.getTime() < Date.now() + 60_000;

    if (!isExpired) return;

    const refreshToken = decryptToken(refreshTokenEncrypted);
    const msalClient = createMsalClient();

    try {
      const result = await msalClient.acquireTokenByRefreshToken({
        refreshToken,
        scopes: SCOPES,
      });

      if (!result) {
        throw Object.assign(new Error("Token refresh returned null"), {
          code: 401,
        });
      }

      // Extract new refresh token from cache
      const cache = msalClient.getTokenCache().serialize();
      const cacheData = JSON.parse(cache);
      const refreshTokens = Object.values(
        cacheData.RefreshToken || {}
      ) as Array<{ secret: string }>;
      const newRefreshToken = refreshTokens[0]?.secret;

      await db.externalCalendarConnection.update({
        where: { id: connection.id },
        data: {
          accessTokenEncrypted: encryptToken(result.accessToken),
          tokenExpiresAt: result.expiresOn,
          ...(newRefreshToken
            ? { refreshTokenEncrypted: encryptToken(newRefreshToken) }
            : {}),
        },
      });

      // Update the in-memory connection object for subsequent calls
      connection.accessTokenEncrypted = encryptToken(result.accessToken);
      connection.tokenExpiresAt = result.expiresOn;
    } catch (err) {
      await db.externalCalendarConnection.update({
        where: { id: connection.id },
        data: { status: "EXPIRED" },
      });
      throw err;
    }
  }

  async fetchEvents(
    connection: ExternalCalendarConnection,
    calendar: ExternalCalendar
  ): Promise<{ events: MappedEvent[]; nextSyncToken: string | null }> {
    const accessToken = decryptToken(connection.accessTokenEncrypted);
    const allEvents: MappedEvent[] = [];
    let nextDeltaLink: string | null = null;

    if (calendar.lastSyncToken) {
      // Delta sync using stored deltaLink
      try {
        const result = await this.fetchDelta(
          accessToken,
          calendar.lastSyncToken,
          calendar
        );
        allEvents.push(...result.events);
        nextDeltaLink = result.nextDeltaLink;
      } catch (err: unknown) {
        const error = err as { status?: number };
        // If delta link expired (410 Gone), fall back to full sync
        if (error.status === 410) {
          const result = await this.fetchFull(
            accessToken,
            calendar
          );
          allEvents.push(...result.events);
          nextDeltaLink = result.nextDeltaLink;
        } else {
          throw err;
        }
      }
    } else {
      // Full sync
      const result = await this.fetchFull(accessToken, calendar);
      allEvents.push(...result.events);
      nextDeltaLink = result.nextDeltaLink;
    }

    return {
      events: allEvents,
      nextSyncToken: nextDeltaLink,
    };
  }

  private async fetchDelta(
    accessToken: string,
    deltaLink: string,
    calendar: ExternalCalendar
  ): Promise<{ events: MappedEvent[]; nextDeltaLink: string | null }> {
    const events: MappedEvent[] = [];
    let url: string | null = deltaLink;
    let nextDeltaLink: string | null = null;

    while (url) {
      const data = (await fetchWithGraph(accessToken, url)) as GraphResponse;
      events.push(
        ...data.value.map((e) => mapOutlookEvent(e, calendar))
      );
      url = data["@odata.nextLink"] ?? null;
      if (data["@odata.deltaLink"]) {
        nextDeltaLink = data["@odata.deltaLink"];
      }
    }

    return { events, nextDeltaLink };
  }

  private async fetchFull(
    accessToken: string,
    calendar: ExternalCalendar
  ): Promise<{ events: MappedEvent[]; nextDeltaLink: string | null }> {
    const events: MappedEvent[] = [];
    const now = new Date();
    const timeMin = new Date(
      now.getTime() - 30 * 24 * 60 * 60 * 1000
    ).toISOString();
    const timeMax = new Date(
      now.getTime() + 365 * 24 * 60 * 60 * 1000
    ).toISOString();

    let url: string | null =
      `${GRAPH_BASE}/me/calendars/${calendar.externalCalendarId}/calendarView/delta?startDateTime=${timeMin}&endDateTime=${timeMax}&$select=subject,bodyPreview,location,start,end,isAllDay,isCancelled`;

    let nextDeltaLink: string | null = null;

    while (url) {
      const data = (await fetchWithGraph(accessToken, url)) as GraphResponse;
      events.push(
        ...data.value.map((e) => mapOutlookEvent(e, calendar))
      );
      url = data["@odata.nextLink"] ?? null;
      if (data["@odata.deltaLink"]) {
        nextDeltaLink = data["@odata.deltaLink"];
      }
    }

    return { events, nextDeltaLink };
  }
}

// ─── Graph Types & Mapping ───────────────────────────────────────

interface GraphEvent {
  id: string;
  subject?: string;
  bodyPreview?: string;
  location?: { displayName?: string };
  start?: { dateTime: string; timeZone: string };
  end?: { dateTime: string; timeZone: string };
  isAllDay?: boolean;
  isCancelled?: boolean;
  "@removed"?: { reason: string };
}

interface GraphResponse {
  value: GraphEvent[];
  "@odata.nextLink"?: string;
  "@odata.deltaLink"?: string;
}

function mapOutlookEvent(
  gEvent: GraphEvent,
  calendar: ExternalCalendar
): MappedEvent {
  // Deleted events in delta
  if (gEvent["@removed"]) {
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

  if (gEvent.isCancelled) {
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

  const isBusyFreeOnly = calendar.privacyMode === "BUSY_FREE_ONLY";

  // Graph returns dateTime in the event's time zone but without offset.
  // We parse as UTC since the worker stores in UTC.
  const startAt = gEvent.start
    ? new Date(gEvent.start.dateTime + "Z")
    : new Date();
  const endAt = gEvent.end
    ? new Date(gEvent.end.dateTime + "Z")
    : startAt;

  return {
    externalId: gEvent.id,
    title: isBusyFreeOnly
      ? "Busy"
      : gEvent.subject ?? "Untitled",
    description: isBusyFreeOnly
      ? null
      : gEvent.bodyPreview ?? null,
    location: isBusyFreeOnly
      ? null
      : gEvent.location?.displayName ?? null,
    startAt,
    endAt,
    allDay: gEvent.isAllDay ?? false,
    isCancelled: false,
  };
}
