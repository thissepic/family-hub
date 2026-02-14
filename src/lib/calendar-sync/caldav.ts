import { db } from "@/lib/db";
import { decryptToken } from "./encryption";
import type { ExternalCalendarConnection, ExternalCalendar } from "@prisma/client";
import type { CalendarProviderAdapter, MappedEvent } from "./types";

// ─── CalDAV HTTP Helpers ─────────────────────────────────────────

interface CaldavCredentials {
  username: string;
  password: string;
}

function parseCredentials(connection: ExternalCalendarConnection): CaldavCredentials {
  const decrypted = decryptToken(connection.accessTokenEncrypted);
  const colonIndex = decrypted.indexOf(":");
  if (colonIndex === -1) {
    return { username: decrypted, password: "" };
  }
  return {
    username: decrypted.slice(0, colonIndex),
    password: decrypted.slice(colonIndex + 1),
  };
}

function basicAuthHeader(creds: CaldavCredentials): string {
  return "Basic " + Buffer.from(`${creds.username}:${creds.password}`).toString("base64");
}

async function caldavRequest(
  url: string,
  method: string,
  body: string | null,
  creds: CaldavCredentials,
  depth?: string
): Promise<{ status: number; text: string }> {
  const headers: Record<string, string> = {
    Authorization: basicAuthHeader(creds),
    "Content-Type": "application/xml; charset=utf-8",
  };
  if (depth !== undefined) {
    headers["Depth"] = depth;
  }

  // Follow redirects manually for non-GET methods (fetch doesn't follow
  // redirects for PROPFIND/REPORT by default on all runtimes)
  let currentUrl = url;
  let redirectCount = 0;
  const maxRedirects = 5;

  while (redirectCount < maxRedirects) {
    const res = await fetch(currentUrl, {
      method,
      headers,
      body: body ?? undefined,
      redirect: "manual",
    });

    if ([301, 302, 307, 308].includes(res.status)) {
      const location = res.headers.get("location");
      if (!location) break;

      // Resolve relative redirect URLs
      currentUrl = location.startsWith("http")
        ? location
        : new URL(location, currentUrl).toString();
      redirectCount++;
      continue;
    }

    const text = await res.text();
    return { status: res.status, text };
  }

  throw new Error(`Too many redirects following ${url}`);
}

// ─── XML Parsing Helpers (minimal, no external dep) ──────────────

function extractTag(xml: string, tag: string): string | null {
  // Match tag regardless of namespace prefix, e.g. <d:href> or <DAV:href> or <href>
  const regex = new RegExp(`<(?:[a-zA-Z0-9_-]+:)?${tag}[^>]*>([\\s\\S]*?)</(?:[a-zA-Z0-9_-]+:)?${tag}>`, "i");
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
}

function extractAllResponses(xml: string): string[] {
  const responses: string[] = [];
  const regex = /<(?:[a-zA-Z0-9_-]+:)?response[\s>]([\s\S]*?)<\/(?:[a-zA-Z0-9_-]+:)?response>/gi;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    responses.push(match[0]);
  }
  return responses;
}

function extractHref(responseXml: string): string | null {
  return extractTag(responseXml, "href");
}

/**
 * Resolve a possibly-relative href against a base URL.
 * If href is already absolute (starts with http), return it directly.
 */
function resolveUrl(base: string, href: string): string {
  if (href.startsWith("http://") || href.startsWith("https://")) {
    return href;
  }
  const url = new URL(base);
  return `${url.protocol}//${url.host}${href}`;
}

// ─── CalDAV Discovery ────────────────────────────────────────────

async function discoverPrincipal(
  baseUrl: string,
  creds: CaldavCredentials
): Promise<string> {
  const body = `<?xml version="1.0" encoding="utf-8" ?>
<d:propfind xmlns:d="DAV:">
  <d:prop>
    <d:current-user-principal/>
  </d:prop>
</d:propfind>`;

  // Try the well-known CalDAV endpoint first (RFC 6764),
  // then fall back to the base URL itself
  const urlsToTry = [baseUrl];
  const parsed = new URL(baseUrl);
  const wellKnown = `${parsed.protocol}//${parsed.host}/.well-known/caldav`;
  if (baseUrl !== wellKnown) {
    urlsToTry.unshift(wellKnown);
  }

  for (const tryUrl of urlsToTry) {
    const { text, status } = await caldavRequest(tryUrl, "PROPFIND", body, creds, "0");

    if (status === 401 || status === 403) {
      throw Object.assign(new Error("Authentication failed"), { code: 401 });
    }

    // 404/405 on well-known is normal — server doesn't support it
    if (status === 404 || status === 405) continue;

    const principalHref = extractTag(text, "current-user-principal");
    const href = principalHref ? extractTag(principalHref, "href") : null;

    if (href) {
      return resolveUrl(tryUrl, href);
    }

    // If we got a valid response but no principal, use this URL as fallback
    if (status >= 200 && status < 300) {
      return tryUrl;
    }
  }

  // Last resort: use base URL as principal
  return baseUrl;
}

async function discoverCalendarHome(
  principalUrl: string,
  creds: CaldavCredentials
): Promise<string> {
  const body = `<?xml version="1.0" encoding="utf-8" ?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <c:calendar-home-set/>
  </d:prop>
</d:propfind>`;

  const { text } = await caldavRequest(principalUrl, "PROPFIND", body, creds, "0");

  const homeSet = extractTag(text, "calendar-home-set");
  const href = homeSet ? extractTag(homeSet, "href") : null;

  if (!href) {
    return principalUrl;
  }

  // calendar-home-set may return a full URL (e.g. https://p34-caldav.icloud.com/...)
  // or a relative path — resolveUrl handles both cases
  return resolveUrl(principalUrl, href);
}

export interface DiscoveredCalendar {
  href: string;
  displayName: string;
  color: string | null;
}

export async function discoverCalendars(
  baseUrl: string,
  creds: CaldavCredentials
): Promise<DiscoveredCalendar[]> {
  const principalUrl = await discoverPrincipal(baseUrl, creds);
  const homeUrl = await discoverCalendarHome(principalUrl, creds);

  const body = `<?xml version="1.0" encoding="utf-8" ?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:cs="http://calendarserver.org/ns/" xmlns:ic="http://apple.com/ns/ical/">
  <d:prop>
    <d:displayname/>
    <d:resourcetype/>
    <c:supported-calendar-component-set/>
    <ic:calendar-color/>
    <cs:getctag/>
  </d:prop>
</d:propfind>`;

  const { text } = await caldavRequest(homeUrl, "PROPFIND", body, creds, "1");
  const responses = extractAllResponses(text);

  const calendars: DiscoveredCalendar[] = [];

  for (const resp of responses) {
    // Must be a calendar resource
    if (!resp.match(/<(?:[a-zA-Z0-9_-]+:)?calendar[\s/>]/i)) continue;

    // Must support VEVENT
    const supported = extractTag(resp, "supported-calendar-component-set") ?? "";
    if (!supported.match(/VEVENT/i) && !supported.includes("name=\"VEVENT\"")) {
      // Some servers list components differently
      if (!resp.match(/VEVENT/i)) continue;
    }

    const href = extractHref(resp);
    if (!href) continue;

    const displayName = extractTag(resp, "displayname") ?? "Calendar";
    const color = extractTag(resp, "calendar-color");

    const fullHref = resolveUrl(homeUrl, href);

    calendars.push({
      href: fullHref,
      displayName,
      color: color ? color.slice(0, 7) : null, // Normalize to #RRGGBB
    });
  }

  return calendars;
}

// ─── CalDAV Event Fetching ───────────────────────────────────────

async function fetchCtag(
  calendarUrl: string,
  creds: CaldavCredentials
): Promise<string | null> {
  const body = `<?xml version="1.0" encoding="utf-8" ?>
<d:propfind xmlns:d="DAV:" xmlns:cs="http://calendarserver.org/ns/">
  <d:prop>
    <cs:getctag/>
  </d:prop>
</d:propfind>`;

  const { text } = await caldavRequest(calendarUrl, "PROPFIND", body, creds, "0");
  return extractTag(text, "getctag");
}

async function fetchAllEvents(
  calendarUrl: string,
  creds: CaldavCredentials
): Promise<{ href: string; icalData: string }[]> {
  // Time range: 30 days ago to 365 days from now
  const now = new Date();
  const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
  const end = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");

  const body = `<?xml version="1.0" encoding="utf-8" ?>
<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <d:getetag/>
    <c:calendar-data/>
  </d:prop>
  <c:filter>
    <c:comp-filter name="VCALENDAR">
      <c:comp-filter name="VEVENT">
        <c:time-range start="${start}" end="${end}"/>
      </c:comp-filter>
    </c:comp-filter>
  </c:filter>
</c:calendar-query>`;

  const { text } = await caldavRequest(calendarUrl, "REPORT", body, creds, "1");
  const responses = extractAllResponses(text);

  const events: { href: string; icalData: string }[] = [];

  for (const resp of responses) {
    const href = extractHref(resp) ?? "";
    const icalData = extractTag(resp, "calendar-data");
    if (icalData) {
      events.push({ href, icalData });
    }
  }

  return events;
}

// ─── iCalendar Parsing (using ical.js) ──────────────────────────

function parseIcalEvents(
  icalData: string,
  calendar: ExternalCalendar
): MappedEvent[] {
  // Dynamic import of ical.js would be ideal but since we're in Node context,
  // we parse the essential fields manually for reliability
  const events: MappedEvent[] = [];

  // Split into individual VEVENT blocks
  const veventRegex = /BEGIN:VEVENT([\s\S]*?)END:VEVENT/g;
  let match;

  while ((match = veventRegex.exec(icalData)) !== null) {
    const block = match[1];
    const event = parseVevent(block, calendar);
    if (event) events.push(event);
  }

  return events;
}

function parseVevent(
  block: string,
  calendar: ExternalCalendar
): MappedEvent | null {
  const getField = (name: string): string | null => {
    // Handle multi-line values (RFC 5545 folding)
    const regex = new RegExp(`^${name}[;:]([^\\r\\n]*)`, "im");
    const match = block.match(regex);
    if (!match) return null;
    let value = match[1];
    // Unfold continuation lines
    value = value.replace(/\r?\n[ \t]/g, "");
    return value;
  };

  const uid = getField("UID");
  if (!uid) return null;

  const status = getField("STATUS");
  if (status?.toUpperCase() === "CANCELLED") {
    return {
      externalId: uid,
      title: "",
      description: null,
      location: null,
      startAt: new Date(),
      endAt: new Date(),
      allDay: false,
      isCancelled: true,
    };
  }

  const dtstart = getField("DTSTART");
  const dtend = getField("DTEND");
  if (!dtstart) return null;

  const isBusyFreeOnly = calendar.privacyMode === "BUSY_FREE_ONLY";

  // Parse DTSTART/DTEND
  const { date: startAt, allDay } = parseIcalDate(dtstart, block);
  const { date: endAt } = dtend
    ? parseIcalDate(dtend, block)
    : { date: startAt };

  const summary = getField("SUMMARY") ?? "Untitled";
  const description = getField("DESCRIPTION");
  const location = getField("LOCATION");

  return {
    externalId: uid,
    title: isBusyFreeOnly ? "Busy" : summary,
    description: isBusyFreeOnly ? null : description,
    location: isBusyFreeOnly ? null : location,
    startAt,
    endAt,
    allDay,
    isCancelled: false,
  };
}

function parseIcalDate(
  value: string,
  _block: string
): { date: Date; allDay: boolean } {
  // value comes from getField(), e.g.:
  //   "20250101T100000Z"          (from DTSTART:20250101T100000Z)
  //   "VALUE=DATE:20250101"       (from DTSTART;VALUE=DATE:20250101)
  //   "TZID=Europe/Berlin:20250101T100000" (from DTSTART;TZID=...:...)

  const isAllDay = value.includes("VALUE=DATE") && !value.includes("VALUE=DATE-TIME");

  // Extract the actual date string: take everything after the last colon,
  // or the whole value if no colon exists (bare date/datetime)
  const colonIdx = value.lastIndexOf(":");
  let dateStr = colonIdx !== -1 ? value.slice(colonIdx + 1) : value;
  dateStr = dateStr.trim();

  if (isAllDay || dateStr.length === 8) {
    // YYYYMMDD
    const year = parseInt(dateStr.slice(0, 4));
    const month = parseInt(dateStr.slice(4, 6)) - 1;
    const day = parseInt(dateStr.slice(6, 8));
    return { date: new Date(Date.UTC(year, month, day)), allDay: true };
  }

  // YYYYMMDDTHHMMSS or YYYYMMDDTHHMMSSZ
  if (dateStr.includes("T")) {
    const clean = dateStr.replace(/[^0-9TZ]/g, "");
    const year = parseInt(clean.slice(0, 4));
    const month = parseInt(clean.slice(4, 6)) - 1;
    const day = parseInt(clean.slice(6, 8));
    const hour = parseInt(clean.slice(9, 11));
    const minute = parseInt(clean.slice(11, 13));
    const second = parseInt(clean.slice(13, 15)) || 0;

    if (clean.endsWith("Z")) {
      return { date: new Date(Date.UTC(year, month, day, hour, minute, second)), allDay: false };
    }

    // Without Z, treat as UTC (timezone conversion would need VTIMEZONE parsing)
    return { date: new Date(Date.UTC(year, month, day, hour, minute, second)), allDay: false };
  }

  // Fallback
  return { date: new Date(dateStr), allDay: false };
}

// ─── CalDAV Adapter ──────────────────────────────────────────────

export class CaldavAdapter implements CalendarProviderAdapter {
  async refreshAuth(connection: ExternalCalendarConnection): Promise<void> {
    if (!connection.caldavUrl) {
      throw Object.assign(new Error("No CalDAV URL"), { code: 401 });
    }

    const creds = parseCredentials(connection);

    // Test authentication with a simple PROPFIND
    const { status } = await caldavRequest(
      connection.caldavUrl,
      "PROPFIND",
      `<?xml version="1.0" encoding="utf-8" ?><d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/></d:prop></d:propfind>`,
      creds,
      "0"
    );

    if (status === 401 || status === 403) {
      await db.externalCalendarConnection.update({
        where: { id: connection.id },
        data: { status: "EXPIRED" },
      });
      throw Object.assign(new Error("CalDAV authentication failed"), {
        code: 401,
      });
    }
  }

  async fetchEvents(
    connection: ExternalCalendarConnection,
    calendar: ExternalCalendar
  ): Promise<{ events: MappedEvent[]; nextSyncToken: string | null }> {
    const creds = parseCredentials(connection);
    const calendarUrl = calendar.externalCalendarId; // For CalDAV, we store the full URL

    // Check ctag for changes
    const ctag = await fetchCtag(calendarUrl, creds);
    if (ctag && ctag === calendar.lastSyncToken) {
      // No changes
      return { events: [], nextSyncToken: ctag };
    }

    // Fetch all events
    const rawEvents = await fetchAllEvents(calendarUrl, creds);

    const allMapped: MappedEvent[] = [];
    for (const { icalData } of rawEvents) {
      const parsed = parseIcalEvents(icalData, calendar);
      allMapped.push(...parsed);
    }

    return {
      events: allMapped,
      nextSyncToken: ctag,
    };
  }
}

// Re-export for use in tRPC procedures
export { parseCredentials, discoverPrincipal };
