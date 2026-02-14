# External Calendar Sync

Family Hub can sync events from external calendar providers into its local calendar. The sync engine supports four providers and runs as a BullMQ background job.

Source files: `src/lib/calendar-sync/`.

## Supported Providers

| Provider | Adapter | Auth Method | Incremental Sync |
|---|---|---|---|
| Google Calendar | `GoogleCalendarAdapter` | OAuth 2.0 | Yes (sync tokens) |
| Microsoft Outlook | `OutlookCalendarAdapter` | OAuth 2.0 (MSAL) | Yes (delta tokens) |
| Apple / CalDAV | `CaldavAdapter` | Username + password | No (full fetch) |
| Exchange (EWS) | `EwsAdapter` | Username + password | No (full fetch) |

Apple iCloud calendars are handled by the CalDAV adapter, as iCloud exposes calendars via the CalDAV protocol.

## Architecture

```
┌──────────────────────────────────────────────────┐
│                  BullMQ Worker                    │
│             ("calendar-sync" queue)               │
│                 concurrency: 3                    │
│                                                   │
│   ┌──────────────────────────────────────────┐    │
│   │           Provider Adapter Registry      │    │
│   │                                          │    │
│   │  GOOGLE     → GoogleCalendarAdapter      │    │
│   │  OUTLOOK    → OutlookCalendarAdapter     │    │
│   │  APPLE      → CaldavAdapter              │    │
│   │  CALDAV     → CaldavAdapter              │    │
│   │  EXCHANGE_EWS → EwsAdapter               │    │
│   └──────────────────────────────────────────┘    │
│                       │                           │
│                       ▼                           │
│   CalendarProviderAdapter interface:              │
│   ├── refreshAuth(connection) → void              │
│   └── fetchEvents(connection, calendar)           │
│       → { events: MappedEvent[], nextSyncToken }  │
└──────────────────────────────────────────────────┘
                        │
                        ▼
            ┌───────────────────────┐
            │  MappedEvent (shared) │
            │                       │
            │  externalId: string   │
            │  title: string        │
            │  description: string  │
            │  location: string     │
            │  startAt: Date        │
            │  endAt: Date          │
            │  allDay: boolean      │
            │  isCancelled: boolean │
            └───────────────────────┘
```

All providers map their events into the common `MappedEvent` format before local database operations.

## Sync Workflow

### Periodic Sync

A repeatable BullMQ job runs every 5 minutes:

```
periodic-sync job fires
  │
  ├── Fetch all connections where status = ACTIVE AND syncEnabled = true
  │
  └── For each connection:
       │
       ├── Check: has syncIntervalMinutes elapsed since lastSyncAt?
       │   └── No → skip
       │
       ├── adapter.refreshAuth(connection)
       │   └── Refreshes OAuth tokens if expired
       │
       ├── For each calendar (where syncEnabled = true):
       │   │
       │   ├── adapter.fetchEvents(connection, calendar)
       │   │   └── Returns MappedEvent[] + nextSyncToken
       │   │
       │   └── For each MappedEvent:
       │       │
       │       ├── isCancelled? → DELETE from local DB
       │       │
       │       ├── Exists locally (by externalId)?
       │       │   └── Yes → UPDATE
       │       │   └── No  → CREATE (source = provider, isReadOnly = true)
       │       │
       │       └── Update calendar.lastSyncToken
       │
       └── Update connection.lastSyncAt
```

### On-Demand Sync

A user can trigger an immediate sync via `calendarSync.triggerSync({ connectionId })`. This enqueues a `sync-connection` job with `force: true`, bypassing the interval check.

## OAuth Flows

### Google Calendar

```
1. Client calls calendarSync.getGoogleAuthUrl()
2. Server generates OAuth URL with:
   - scope: calendar.readonly (or calendar for two-way)
   - state: sealed with iron-session (contains memberId)
   - redirect: GOOGLE_REDIRECT_URI
3. User authorizes in Google consent screen
4. Google redirects to /api/calendar-sync/google/callback
5. Server exchanges code for tokens
6. Tokens encrypted with TOKEN_ENCRYPTION_KEY (AES-256-GCM)
7. ExternalCalendarConnection created (status: ACTIVE)
8. Calendar list fetched from Google → ExternalCalendar records created
9. Initial sync triggered
```

**Required env vars:**
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`

### Microsoft Outlook

```
1. Client calls calendarSync.getOutlookAuthUrl()
2. Server generates MSAL authorization URL with:
   - scope: Calendars.Read (or Calendars.ReadWrite)
   - state: sealed with iron-session
   - redirect: MICROSOFT_REDIRECT_URI
3. User authorizes in Microsoft consent screen
4. Microsoft redirects to /api/calendar-sync/outlook/callback
5. Server exchanges code for tokens via MSAL
6. Tokens encrypted and stored
7. ExternalCalendarConnection created
8. Calendar list fetched from Microsoft Graph
9. Initial sync triggered
```

**Required env vars:**
- `MICROSOFT_CLIENT_ID`
- `MICROSOFT_CLIENT_SECRET`
- `MICROSOFT_TENANT_ID` (default: `common`)
- `MICROSOFT_REDIRECT_URI`

### CalDAV (Apple, Nextcloud, etc.)

```
1. Client calls calendarSync.connectCaldav({ serverUrl, username, password })
2. Server connects to CalDAV server
3. Discovers available calendars
4. Credentials encrypted and stored
5. ExternalCalendarConnection created
6. ExternalCalendar records created for each discovered calendar
7. Initial sync triggered
```

No OAuth required. Credentials are encrypted at rest.

### Exchange Web Services (EWS)

```
1. Client calls calendarSync.connectEws({ serverUrl, username, password })
2. Server connects to Exchange server via EWS
3. Discovers calendar folders
4. Credentials encrypted and stored
5. Connection and calendar records created
6. Initial sync triggered
```

## Sync Tokens (Incremental Sync)

Google and Outlook support incremental sync using sync tokens:

- **First sync**: Full fetch of all events. Provider returns a `syncToken`.
- **Subsequent syncs**: Send the `syncToken` to get only changes since last sync.
- **Token invalidated**: Full re-sync if the provider rejects the token.

Sync tokens are stored per calendar in `ExternalCalendar.lastSyncToken`.

CalDAV and EWS always perform a full fetch (no incremental sync support).

## Privacy Modes

Each external calendar can be configured with a privacy mode:

| Mode | Behavior |
|---|---|
| `FULL_DETAILS` | Full event title, description, and location are synced |
| `BUSY_FREE_ONLY` | Only time blocks are synced; title shows as "Busy" |

This is useful when syncing a work calendar where event details should remain private.

## Sync Direction

| Direction | Behavior |
|---|---|
| `INBOUND_ONLY` | External events sync to Family Hub (default) |
| `TWO_WAY` | Also pushes Family Hub events to the external calendar |

Two-way sync requires additional API permissions (write access to the external calendar).

## Connection States

| Status | Meaning |
|---|---|
| `ACTIVE` | Connection is working, sync runs normally |
| `EXPIRED` | OAuth tokens expired and could not be refreshed. User must reconnect. |
| `REVOKED` | User revoked access. Connection should be deleted. |

When a sync attempt receives a 401 or 403 error, the connection is automatically marked as `EXPIRED`.

## Error Handling

- **Auth errors (401/403):** Connection marked as `EXPIRED`. No retry.
- **Network errors:** BullMQ retries up to 3 times with exponential backoff (5s, 25s, 125s).
- **Per-calendar errors:** Caught individually; one failing calendar doesn't stop others from syncing.
- **Worker failures:** Logged but don't crash the application.

## Token Encryption

OAuth tokens and credentials are encrypted before storage using `src/lib/calendar-sync/encryption.ts`:

- Algorithm: AES-256-GCM
- Key: `TOKEN_ENCRYPTION_KEY` environment variable (64-character hex string = 32 bytes)
- Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
