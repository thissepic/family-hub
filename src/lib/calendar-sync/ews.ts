import { db } from "@/lib/db";
import { decryptToken } from "./encryption";
import type { ExternalCalendarConnection, ExternalCalendar } from "@prisma/client";
import type { CalendarProviderAdapter, MappedEvent } from "./types";
import { NtlmClient, NtlmCredentials } from "axios-ntlm";
import type { AxiosInstance } from "axios";
import axios from "axios";

const isAxiosError = axios.isAxiosError;

// ─── EWS Credential Types & Parsing ─────────────────────────────

export interface EwsCredentials {
  domain: string;
  username: string;
  password: string;
  email: string;
}

export function parseCredentials(
  connection: ExternalCalendarConnection
): EwsCredentials {
  const decrypted = decryptToken(connection.accessTokenEncrypted);
  try {
    return JSON.parse(decrypted) as EwsCredentials;
  } catch {
    throw Object.assign(new Error("Invalid EWS credentials format"), {
      code: 401,
    });
  }
}

// ─── NTLM Client Factory ────────────────────────────────────────

/**
 * Create an Axios instance with NTLM authentication and keep-alive.
 * The returned client reuses the TCP connection and NTLM session
 * across multiple requests, which is critical for Exchange servers
 * that reject fresh NTLM handshakes on follow-up requests.
 *
 * IMPORTANT: Do NOT set `validateStatus` on this client — the NTLM
 * interceptor needs 401 responses to be treated as errors so it can
 * intercept them and perform the NTLM challenge/response handshake.
 */
function createNtlmClient(creds: EwsCredentials): AxiosInstance {
  const ntlmCreds: NtlmCredentials = {
    username: creds.username,
    password: creds.password,
    domain: creds.domain,
  };

  return NtlmClient(ntlmCreds, {
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
    },
    timeout: 30000,
  });
}

// ─── EWS SOAP Helpers ───────────────────────────────────────────

function buildSoapEnvelope(body: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope
  xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:t="http://schemas.microsoft.com/exchange/services/2006/types"
  xmlns:m="http://schemas.microsoft.com/exchange/services/2006/messages">
  <soap:Header>
    <t:RequestServerVersion Version="Exchange2013"/>
  </soap:Header>
  <soap:Body>
    ${body}
  </soap:Body>
</soap:Envelope>`;
}

/**
 * Send a SOAP request to the EWS endpoint with NTLM authentication.
 * Accepts an optional pre-configured Axios client for connection reuse.
 *
 * The NTLM interceptor in axios-ntlm works by catching 401 errors and
 * performing the NTLM handshake automatically. We must NOT set
 * `validateStatus` because that would prevent the interceptor from
 * seeing the initial 401 challenge.
 */
async function ewsSoapRequest(
  ewsUrl: string,
  soapBody: string,
  creds: EwsCredentials,
  client?: AxiosInstance
): Promise<{ status: number; text: string }> {
  const envelope = buildSoapEnvelope(soapBody);
  const axiosClient = client ?? createNtlmClient(creds);

  try {
    const response = await axiosClient({
      url: ewsUrl,
      method: "POST",
      data: envelope,
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
      },
    });

    return {
      status: response.status,
      text: typeof response.data === "string" ? response.data : String(response.data ?? ""),
    };
  } catch (err: unknown) {
    // After NTLM handshake, if credentials are wrong the server
    // returns 401/403 which axios throws as an error
    if (isAxiosError(err) && err.response) {
      return {
        status: err.response.status,
        text: typeof err.response.data === "string" ? err.response.data : String(err.response.data ?? ""),
      };
    }
    // Network errors, timeouts, etc.
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("401") || msg.includes("Unauthorized") || msg.includes("NTLM")) {
      return { status: 401, text: "" };
    }
    throw err;
  }
}

// ─── XML Parsing Helpers ────────────────────────────────────────

/**
 * Extract the text content of an XML tag, ignoring namespace prefixes.
 */
function extractTag(xml: string, tag: string): string | null {
  const regex = new RegExp(
    `<(?:[a-zA-Z0-9_-]+:)?${tag}[^>]*>([\\s\\S]*?)</(?:[a-zA-Z0-9_-]+:)?${tag}>`,
    "i"
  );
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
}

/**
 * Extract all occurrences of a specific XML element.
 * Handles both paired tags (<tag>...</tag>) and self-closing tags (<tag .../>).
 */
function extractAllElements(xml: string, tag: string): string[] {
  const elements: string[] = [];

  // Match paired tags: <ns:Tag ...>...</ns:Tag>
  const pairedRegex = new RegExp(
    `<(?:[a-zA-Z0-9_-]+:)?${tag}[\\s>][\\s\\S]*?</(?:[a-zA-Z0-9_-]+:)?${tag}>`,
    "gi"
  );
  let match;
  while ((match = pairedRegex.exec(xml)) !== null) {
    elements.push(match[0]);
  }

  // Match self-closing tags: <ns:Tag ... />
  const selfClosingRegex = new RegExp(
    `<(?:[a-zA-Z0-9_-]+:)?${tag}\\s[^>]*?/>`,
    "gi"
  );
  while ((match = selfClosingRegex.exec(xml)) !== null) {
    // Avoid duplicates (a self-closing match inside an already-matched paired element)
    const pos = match.index;
    const alreadyCaptured = elements.some(
      (el) => {
        const elStart = xml.indexOf(el);
        return pos >= elStart && pos < elStart + el.length;
      }
    );
    if (!alreadyCaptured) {
      elements.push(match[0]);
    }
  }

  return elements;
}

/**
 * Extract an XML attribute value.
 */
function extractAttribute(xml: string, attr: string): string | null {
  const regex = new RegExp(`${attr}="([^"]*)"`, "i");
  const match = xml.match(regex);
  return match ? match[1] : null;
}

/**
 * Check if the SOAP response indicates a success.
 */
function isResponseSuccess(xml: string): boolean {
  const responseClass = extractAttribute(xml, "ResponseClass");
  return responseClass === "Success";
}

// ─── Calendar Discovery ─────────────────────────────────────────

export interface DiscoveredEwsCalendar {
  folderId: string;
  changeKey: string;
  displayName: string;
}

/**
 * Discover calendars on the Exchange server.
 * Gets the default Calendar folder (and optionally sub-calendars).
 */
export async function discoverEwsCalendars(
  ewsUrl: string,
  creds: EwsCredentials
): Promise<DiscoveredEwsCalendar[]> {
  const client = createNtlmClient(creds);

  // Get the default Calendar folder
  const soapBody = `
    <m:GetFolder>
      <m:FolderShape>
        <t:BaseShape>Default</t:BaseShape>
      </m:FolderShape>
      <m:FolderIds>
        <t:DistinguishedFolderId Id="calendar">
          <t:Mailbox>
            <t:EmailAddress>${escapeXml(creds.email)}</t:EmailAddress>
          </t:Mailbox>
        </t:DistinguishedFolderId>
      </m:FolderIds>
    </m:GetFolder>`;

  const { status, text } = await ewsSoapRequest(ewsUrl, soapBody, creds, client);

  if (status === 401 || status === 403) {
    throw Object.assign(new Error("Authentication failed"), { code: 401 });
  }

  if (status !== 200) {
    throw new Error(`EWS request failed with status ${status}`);
  }

  if (!isResponseSuccess(text)) {
    // Try without Mailbox element (some servers don't need it)
    const fallbackBody = `
    <m:GetFolder>
      <m:FolderShape>
        <t:BaseShape>Default</t:BaseShape>
      </m:FolderShape>
      <m:FolderIds>
        <t:DistinguishedFolderId Id="calendar"/>
      </m:FolderIds>
    </m:GetFolder>`;

    const fallback = await ewsSoapRequest(ewsUrl, fallbackBody, creds, client);

    if (fallback.status === 401 || fallback.status === 403) {
      throw Object.assign(new Error("Authentication failed"), { code: 401 });
    }

    if (!isResponseSuccess(fallback.text)) {
      throw new Error("Failed to discover Exchange calendar folder");
    }

    return parseGetFolderResponse(fallback.text);
  }

  return parseGetFolderResponse(text);
}

function parseGetFolderResponse(xml: string): DiscoveredEwsCalendar[] {
  const calendars: DiscoveredEwsCalendar[] = [];
  const folders = extractAllElements(xml, "CalendarFolder");

  for (const folder of folders) {
    const folderIdElement = extractAllElements(folder, "FolderId")[0];
    if (!folderIdElement) continue;

    const folderId = extractAttribute(folderIdElement, "Id");
    const changeKey = extractAttribute(folderIdElement, "ChangeKey");
    const displayName = extractTag(folder, "DisplayName") ?? "Calendar";

    if (folderId && changeKey) {
      calendars.push({ folderId, changeKey, displayName });
    }
  }

  // If no CalendarFolder found, try generic Folder elements
  if (calendars.length === 0) {
    const genericFolders = extractAllElements(xml, "Folder");
    for (const folder of genericFolders) {
      const folderIdElement = extractAllElements(folder, "FolderId")[0];
      if (!folderIdElement) continue;

      const folderId = extractAttribute(folderIdElement, "Id");
      const changeKey = extractAttribute(folderIdElement, "ChangeKey");
      const displayName = extractTag(folder, "DisplayName") ?? "Calendar";

      if (folderId && changeKey) {
        calendars.push({ folderId, changeKey, displayName });
      }
    }
  }

  return calendars;
}

// ─── Event Fetching (Full Sync) ─────────────────────────────────

/**
 * Fetch all calendar events using FindItem with CalendarView.
 * CalendarView automatically expands recurring events into individual occurrences.
 * Uses a shared NTLM client for connection reuse across paginated requests.
 */
async function fetchEventsFullSync(
  ewsUrl: string,
  folderId: string,
  creds: EwsCredentials,
  calendar: ExternalCalendar,
  client: AxiosInstance
): Promise<{ events: MappedEvent[]; syncState: string | null }> {
  const now = new Date();
  const startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const endDate = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

  const allEvents: MappedEvent[] = [];
  let offset = 0;
  const maxEntries = 500;
  let hasMore = true;

  while (hasMore) {
    const soapBody = `
    <m:FindItem Traversal="Shallow">
      <m:ItemShape>
        <t:BaseShape>Default</t:BaseShape>
        <t:AdditionalProperties>
          <t:FieldURI FieldURI="item:Subject"/>
          <t:FieldURI FieldURI="item:Body"/>
          <t:FieldURI FieldURI="calendar:Start"/>
          <t:FieldURI FieldURI="calendar:End"/>
          <t:FieldURI FieldURI="calendar:Location"/>
          <t:FieldURI FieldURI="calendar:IsAllDayEvent"/>
          <t:FieldURI FieldURI="calendar:IsCancelled"/>
          <t:FieldURI FieldURI="item:ItemId"/>
        </t:AdditionalProperties>
      </m:ItemShape>
      <m:CalendarView StartDate="${startDate.toISOString()}" EndDate="${endDate.toISOString()}" MaxEntriesReturned="${maxEntries}"/>
      <m:ParentFolderIds>
        <t:FolderId Id="${escapeXml(folderId)}"/>
      </m:ParentFolderIds>
    </m:FindItem>`;

    const { status, text } = await ewsSoapRequest(ewsUrl, soapBody, creds, client);

    if (status === 401 || status === 403) {
      throw Object.assign(new Error("Authentication failed"), { code: 401 });
    }

    if (!isResponseSuccess(text)) {
      console.error("EWS FindItem failed:", text.slice(0, 500));
      break;
    }

    const items = extractAllElements(text, "CalendarItem");
    for (const item of items) {
      const mapped = mapEwsEvent(item, calendar);
      if (mapped) {
        allEvents.push(mapped);
      }
    }

    // Check if there are more results
    const includesLast = extractAttribute(text, "IncludesLastItemInRange");
    if (includesLast === "true" || items.length < maxEntries) {
      hasMore = false;
    } else {
      offset += items.length;
    }
  }

  // Get initial SyncState for incremental sync (reuse same client)
  const syncState = await getInitialSyncState(ewsUrl, folderId, creds, client);

  return { events: allEvents, syncState };
}

/**
 * Get the initial SyncState by calling SyncFolderItems without a prior state.
 * We paginate through all results to obtain the final SyncState.
 */
async function getInitialSyncState(
  ewsUrl: string,
  folderId: string,
  creds: EwsCredentials,
  client: AxiosInstance
): Promise<string | null> {
  let currentSyncState = "";
  let includesLast = false;

  while (!includesLast) {
    const syncStateElement = currentSyncState
      ? `<m:SyncState>${escapeXml(currentSyncState)}</m:SyncState>`
      : "";

    const soapBody = `
    <m:SyncFolderItems>
      <m:ItemShape>
        <t:BaseShape>IdOnly</t:BaseShape>
      </m:ItemShape>
      <m:SyncFolderId>
        <t:FolderId Id="${escapeXml(folderId)}"/>
      </m:SyncFolderId>
      ${syncStateElement}
      <m:MaxChangesReturned>512</m:MaxChangesReturned>
    </m:SyncFolderItems>`;

    const { text } = await ewsSoapRequest(ewsUrl, soapBody, creds, client);

    const newSyncState = extractTag(text, "SyncState");
    if (!newSyncState) {
      return currentSyncState || null;
    }
    currentSyncState = newSyncState;

    const includesLastStr = extractAttribute(text, "IncludesLastItemInRange");
    includesLast = includesLastStr === "true";
  }

  return currentSyncState || null;
}

// ─── Event Fetching (Incremental Sync) ──────────────────────────

/**
 * Fetch changed events using SyncFolderItems with a stored SyncState.
 * Uses a shared NTLM client for connection reuse.
 */
async function fetchEventsIncrementalSync(
  ewsUrl: string,
  folderId: string,
  syncState: string,
  creds: EwsCredentials,
  calendar: ExternalCalendar,
  client: AxiosInstance
): Promise<{ events: MappedEvent[]; syncState: string | null }> {
  const allEvents: MappedEvent[] = [];
  let currentSyncState = syncState;
  let includesLast = false;

  while (!includesLast) {
    const soapBody = `
    <m:SyncFolderItems>
      <m:ItemShape>
        <t:BaseShape>Default</t:BaseShape>
        <t:AdditionalProperties>
          <t:FieldURI FieldURI="item:Subject"/>
          <t:FieldURI FieldURI="item:Body"/>
          <t:FieldURI FieldURI="calendar:Start"/>
          <t:FieldURI FieldURI="calendar:End"/>
          <t:FieldURI FieldURI="calendar:Location"/>
          <t:FieldURI FieldURI="calendar:IsAllDayEvent"/>
          <t:FieldURI FieldURI="calendar:IsCancelled"/>
        </t:AdditionalProperties>
      </m:ItemShape>
      <m:SyncFolderId>
        <t:FolderId Id="${escapeXml(folderId)}"/>
      </m:SyncFolderId>
      <m:SyncState>${escapeXml(currentSyncState)}</m:SyncState>
      <m:MaxChangesReturned>512</m:MaxChangesReturned>
    </m:SyncFolderItems>`;

    const { status, text } = await ewsSoapRequest(ewsUrl, soapBody, creds, client);

    if (status === 401 || status === 403) {
      throw Object.assign(new Error("Authentication failed"), { code: 401 });
    }

    // Check if SyncState is invalid (server returns error)
    if (!isResponseSuccess(text)) {
      const responseCode = extractTag(text, "ResponseCode");
      if (
        responseCode === "ErrorInvalidSyncStateData" ||
        responseCode === "ErrorSyncFolderNotFound"
      ) {
        // SyncState is stale, signal caller to fall back to full sync
        return { events: [], syncState: null };
      }
      throw new Error(`EWS SyncFolderItems failed: ${responseCode}`);
    }

    const newSyncState = extractTag(text, "SyncState");
    if (newSyncState) {
      currentSyncState = newSyncState;
    }

    // Process Create/Update changes
    const creates = extractAllElements(text, "Create");
    const updates = extractAllElements(text, "Update");

    for (const change of [...creates, ...updates]) {
      const items = extractAllElements(change, "CalendarItem");
      for (const item of items) {
        const mapped = mapEwsEvent(item, calendar);
        if (mapped) {
          allEvents.push(mapped);
        }
      }
    }

    // Process Delete changes
    const deletes = extractAllElements(text, "Delete");
    for (const del of deletes) {
      const itemIdElement = extractAllElements(del, "ItemId")[0];
      if (itemIdElement) {
        const itemId = extractAttribute(itemIdElement, "Id");
        if (itemId) {
          allEvents.push({
            externalId: itemId,
            title: "",
            description: null,
            location: null,
            startAt: new Date(),
            endAt: new Date(),
            allDay: false,
            isCancelled: true,
          });
        }
      }
    }

    const includesLastStr = extractAttribute(text, "IncludesLastItemInRange");
    includesLast = includesLastStr === "true";
  }

  return { events: allEvents, syncState: currentSyncState };
}

// ─── Event Mapping ──────────────────────────────────────────────

/**
 * Map an EWS CalendarItem XML element to a MappedEvent.
 */
function mapEwsEvent(
  itemXml: string,
  calendar: ExternalCalendar
): MappedEvent | null {
  // Extract ItemId
  const itemIdElement = extractAllElements(itemXml, "ItemId")[0];
  const itemId = itemIdElement
    ? extractAttribute(itemIdElement, "Id")
    : null;
  if (!itemId) return null;

  // Check if cancelled
  const isCancelledStr = extractTag(itemXml, "IsCancelled");
  if (isCancelledStr === "true") {
    return {
      externalId: itemId,
      title: "",
      description: null,
      location: null,
      startAt: new Date(),
      endAt: new Date(),
      allDay: false,
      isCancelled: true,
    };
  }

  // Extract event fields
  const subject = extractTag(itemXml, "Subject") ?? "Untitled";
  const bodyContent = extractTag(itemXml, "Body");
  const startStr = extractTag(itemXml, "Start");
  const endStr = extractTag(itemXml, "End");
  const location = extractTag(itemXml, "Location");
  const isAllDayStr = extractTag(itemXml, "IsAllDayEvent");

  if (!startStr || !endStr) return null;

  const startAt = new Date(startStr);
  const endAt = new Date(endStr);
  const allDay = isAllDayStr === "true";

  // Validate dates
  if (isNaN(startAt.getTime()) || isNaN(endAt.getTime())) {
    return null;
  }

  // Apply privacy mode
  const isBusyFreeOnly = calendar.privacyMode === "BUSY_FREE_ONLY";

  return {
    externalId: itemId,
    title: isBusyFreeOnly ? "Busy" : subject,
    description: isBusyFreeOnly ? null : bodyContent,
    location: isBusyFreeOnly ? null : location,
    startAt,
    endAt,
    allDay,
    isCancelled: false,
  };
}

// ─── Utility ────────────────────────────────────────────────────

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ─── EWS Adapter ────────────────────────────────────────────────

export class EwsAdapter implements CalendarProviderAdapter {
  async refreshAuth(connection: ExternalCalendarConnection): Promise<void> {
    if (!connection.caldavUrl) {
      throw Object.assign(new Error("No EWS URL configured"), { code: 401 });
    }

    const creds = parseCredentials(connection);

    // Test authentication with a simple GetFolder request
    const soapBody = `
    <m:GetFolder>
      <m:FolderShape>
        <t:BaseShape>IdOnly</t:BaseShape>
      </m:FolderShape>
      <m:FolderIds>
        <t:DistinguishedFolderId Id="calendar"/>
      </m:FolderIds>
    </m:GetFolder>`;

    const { status } = await ewsSoapRequest(
      connection.caldavUrl,
      soapBody,
      creds
    );

    if (status === 401 || status === 403) {
      await db.externalCalendarConnection.update({
        where: { id: connection.id },
        data: { status: "EXPIRED" },
      });
      throw Object.assign(new Error("EWS authentication failed"), {
        code: 401,
      });
    }
  }

  async fetchEvents(
    connection: ExternalCalendarConnection,
    calendar: ExternalCalendar
  ): Promise<{ events: MappedEvent[]; nextSyncToken: string | null }> {
    const creds = parseCredentials(connection);
    const ewsUrl = connection.caldavUrl!;
    const folderId = calendar.externalCalendarId;

    // Create a single NTLM client for the entire sync operation.
    // This keeps the TCP connection and NTLM session alive across
    // all SOAP requests, preventing 401 errors on follow-up requests.
    let client = createNtlmClient(creds);

    // Try incremental sync if we have a sync token
    if (calendar.lastSyncToken) {
      try {
        const result = await fetchEventsIncrementalSync(
          ewsUrl,
          folderId,
          calendar.lastSyncToken,
          creds,
          calendar,
          client
        );

        // If syncState is null, the token was invalid — fall back to full sync
        if (result.syncState !== null) {
          return {
            events: result.events,
            nextSyncToken: result.syncState,
          };
        }

        console.warn(
          `EWS SyncState invalid for calendar ${calendar.id}, falling back to full sync`
        );
      } catch (err) {
        const isAuth = (err as { code?: number }).code === 401 ||
          (err as { code?: number }).code === 403;
        if (isAuth) {
          // NTLM handshake can fail transiently on the first request
          // of a fresh client (e.g. stale TCP connection, server-side
          // session timeout).  Create a new client so the full-sync
          // fallback starts with a clean TCP + NTLM session.
          client = createNtlmClient(creds);
        } else {
          console.warn(
            `EWS incremental sync failed for calendar ${calendar.id}, falling back to full sync:`,
            err
          );
        }
      }
    }

    // Full sync (also serves as fallback when incremental sync fails)
    const result = await fetchEventsFullSync(ewsUrl, folderId, creds, calendar, client);

    return {
      events: result.events,
      nextSyncToken: result.syncState,
    };
  }
}
