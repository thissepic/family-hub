# Real-Time Updates, Background Jobs & Service Worker

This document covers three interconnected systems: Socket.IO for real-time updates, BullMQ for background jobs, and the service worker for PWA support.

## Socket.IO (Real-Time)

Source files: `src/lib/socket/server.ts`, `src/lib/socket/events.ts`.

### Architecture

Socket.IO runs on a separate port (default: 3001) alongside the Next.js app (port 3000). In Docker, Caddy routes `/socket.io/*` requests to port 3001.

```
Client (browser)
  │
  ├── SocketProvider (React context)
  │   └── connects with query: { familyId }
  │
  ▼
Socket.IO Server (:3001)
  │
  ├── On connect: socket.join("family:{familyId}")
  │
  └── Events broadcast to room "family:{familyId}"
      └── All family members' browsers receive the event
```

### Connection Setup

The `SocketProvider` component initializes the Socket.IO client:

1. Reads `familyId` from the session
2. Connects to the Socket.IO server with `{ familyId }` in the handshake query. The URL is derived from `window.location` at runtime (falls back to `NEXT_PUBLIC_SOCKET_URL` if set), allowing transparent operation behind reverse proxies like Caddy.
3. Transports: WebSocket (preferred), polling (fallback)
4. CORS: configured to accept the app's origin with credentials

### Server-to-Client Events

All events are one-directional (server to client). No client-to-server events are currently defined.

| Event | Payload | Emitted By |
|---|---|---|
| `shopping:item-added` | `{ listId, item: ShoppingItemData }` | `shopping.addItem` mutation |
| `shopping:item-updated` | `{ listId, item: ShoppingItemData }` | `shopping.updateItem` mutation |
| `shopping:item-toggled` | `{ listId, itemId, checked }` | `shopping.checkItem` mutation |
| `shopping:item-deleted` | `{ listId, itemId }` | `shopping.deleteItem` mutation |
| `shopping:checked-cleared` | `{ listId }` | `shopping.clearChecked` mutation |
| `activity:new-event` | `{ description, memberId }` | Activity event creation |
| `hub:data-changed` | `{ modules: string[] }` | Various mutations affecting hub panels |
| `notification:new` | `{ memberId, title, type }` | Notification creation |

### ShoppingItemData

```typescript
interface ShoppingItemData {
  id: string;
  listId: string;
  name: string;
  quantity: string | null;
  unit: string | null;
  category: string | null;
  checked: boolean;
  isRecurring: boolean;
}
```

### Emitting Events

Server-side code uses the `emitToFamily` helper:

```typescript
import { emitToFamily } from "@/lib/socket/server";

// Inside a tRPC mutation handler:
emitToFamily(familyId, "shopping:item-added", { listId, item });
```

This broadcasts to all sockets in the `family:{familyId}` room. If Socket.IO is not initialized (e.g., during build or in edge runtime), the call silently no-ops.

### Client-Side Subscription

Components subscribe to events via the Socket.IO client from the context provider:

```typescript
import { useSocket } from "@/components/providers/socket-provider";

const socket = useSocket();

useEffect(() => {
  if (!socket) return;
  socket.on("shopping:item-added", (data) => {
    // Invalidate TanStack Query cache or update local state
  });
  return () => { socket.off("shopping:item-added"); };
}, [socket]);
```

---

## BullMQ (Background Jobs)

Source files: `src/lib/maintenance/`, `src/lib/calendar-sync/`, `src/lib/email/`.

### Overview

Three BullMQ queues run as workers inside the Next.js server process:

| Queue | Worker | Concurrency | Purpose |
|---|---|---|---|
| `maintenance` | `createMaintenanceWorker` | 1 | Scheduled housekeeping |
| `calendar-sync` | `createSyncWorker` | 3 | External calendar sync |
| `email` | `createEmailWorker` | 2 | Transactional email delivery |

All queues use Redis (via `ioredis`) for job storage and scheduling.

### Maintenance Jobs

| Job Name | Schedule | Description |
|---|---|---|
| `cleanup-old-notifications` | `0 3 * * *` (daily 3:00 AM) | Delete read notifications older than 30 days |
| `weekly-recap` | `0 18 * * 0` (Sunday 6:00 PM) | Generate weekly family recap notification |
| `daily-backup` | `30 3 * * *` (daily 3:30 AM) | `pg_dump` + gzip, prune old backups |

### Calendar Sync Jobs

| Job Name | Schedule | Description |
|---|---|---|
| `periodic-sync` | `*/5 * * * *` (every 5 min) | Iterate all active connections, sync if interval passed |
| `sync-connection` | On-demand | Sync a specific connection (used by manual trigger / OAuth callback) |

### Email Jobs

Source files: `src/lib/email/queue.ts`, `src/lib/email/worker.ts`, `src/lib/email/templates.ts`, `src/lib/email/transporter.ts`.

| Job Name | Trigger | Description |
|---|---|---|
| `verification` | On registration, on resend | Send email verification link (24h expiry) |
| `password-reset` | On password reset request | Send password reset link (1h expiry) |
| `email-change-notification` | On email change | Notify old email address about the change |
| `email-change-verification` | On email change | Send verification link to new email address |

**Architecture:**

```
tRPC mutation (e.g. account.resendVerification)
  │
  ├── 1. createEmailToken() → SHA-256 hash stored in DB, raw token in URL
  │
  ├── 2. enqueueVerificationEmail() → add job to BullMQ "email" queue
  │
  └── 3. Return response (non-blocking; email sent asynchronously)

Email Worker (background):
  │
  ├── 1. Pick job from queue
  ├── 2. Render bilingual HTML template (EN/DE)
  ├── 3. Send via nodemailer SMTP transporter
  └── 4. On failure: retry up to 3 times (exponential backoff, 3s base)
```

**Email Templates:**

All emails use responsive HTML with a branded header (Family Hub blue), call-to-action buttons, and fallback plain-text links. Templates support English and German. The language is determined by the family's `defaultLocale`.

**SMTP Configuration:**

The transporter reads from `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM` environment variables. If SMTP is not configured, the worker silently skips email delivery and the app continues to function without email features.

For development, use `npx maildev` which provides an SMTP server on port 1025 and a web UI on port 1080.

**Job Options:**
- Attempts: 3
- Backoff: exponential, starting at 3 seconds
- Completed jobs kept: 200
- Failed jobs kept: 50
- Transporter auto-resets on connection errors for retry

### Job Configuration

**Default job options (maintenance queue):**
- Attempts: 3
- Backoff: exponential, starting at 5 seconds
- Completed jobs kept: 50 most recent
- Failed jobs kept: 20 most recent

**Calendar sync queue:**
- Concurrency: 3 parallel workers
- Retry on network/server errors (up to 3 attempts)
- Auth errors (401/403) do not retry; connection marked as EXPIRED

### Startup

Workers are initialized in `instrumentation.ts` (Next.js server startup hook):

```typescript
// instrumentation.ts
import { startMaintenanceWorker } from "@/lib/maintenance/bootstrap";
import { startSyncWorker } from "@/lib/calendar-sync/bootstrap";
import { startEmailWorker } from "@/lib/email/bootstrap";
import { initSocketServer } from "@/lib/socket/server";

export async function register() {
  initSocketServer();
  await startMaintenanceWorker();
  await startSyncWorker();
  await startEmailWorker();
}
```

If a worker fails to start (e.g., Redis not available, SMTP not configured), the error is caught and logged, but the app continues to function without the affected background jobs.

### Weekly Recap

The weekly recap job generates a summary notification for each family:

1. Query top XP earner this week
2. Query member with most chore completions
3. Query new achievements unlocked this week
4. Query longest current streak
5. Create an `ADMIN_ANNOUNCEMENT` notification for each member (respecting mute preferences)
6. Create an activity event

### Daily Backup

The backup job runs `pg_dump`:

1. Execute: `pg_dump "$DATABASE_URL" | gzip > /backups/familyhub_YYYY-MM-DD.sql.gz`
2. Prune: `find /backups -name "familyhub_*.sql.gz" -mtime +$RETENTION_DAYS -delete`
3. Timeout: 120 seconds

The backup directory and retention period are configurable via `BACKUP_DIR` and `BACKUP_RETENTION_DAYS`.

---

## Service Worker (PWA)

Source files: `public/sw.template.js`, `scripts/inject-sw-version.mjs`, `src/components/providers/sw-register.tsx`.

### Build Pipeline

```
npm run dev / npm run build
  │
  ├── predev / prebuild hook
  │   └── scripts/inject-sw-version.mjs
  │       ├── Read public/sw.template.js
  │       ├── Generate BUILD_ID = timestamp + random hex
  │       ├── Replace __BUILD_ID__ → actual build ID
  │       └── Write public/sw.js
  │
  └── Next.js build continues
```

Every build gets a unique build ID, ensuring the service worker updates and clears caches on deploy.

### Caching Strategy

| Request Type | Pattern | Strategy | Rationale |
|---|---|---|---|
| Navigation (HTML) | `request.mode === "navigate"` | Network-only, `/offline` fallback | Always serve fresh HTML |
| Next.js assets | `/_next/static/*` | Cache-first | Filenames contain content hashes (immutable) |
| Other static | Icons, fonts, manifest | Network-first, cache fallback | Avoid stale non-hashed assets |
| API routes | `/api/*` | Passthrough (no caching) | Mutations and dynamic data |
| Socket.IO | `/socket.io/*` | Passthrough (no caching) | WebSocket traffic |

### Lifecycle

**Install:**
1. Open cache `family-hub-{BUILD_ID}`
2. Precache: `/offline`, `/manifest.json`
3. `self.skipWaiting()` (activate immediately)

**Activate:**
1. Delete all caches that don't match the current `CACHE_NAME`
2. `self.clients.claim()` (take control of all open tabs)

### Web Push Handling

The service worker handles push notifications:

**Push event:**
```
1. Parse event.data as JSON: { title, message, tag, linkUrl }
2. Show notification with:
   - body: message
   - icon: /icons/icon-192.png
   - tag: data.tag or "family-hub"
   - vibrate: [100, 50, 100]
   - data.linkUrl for click navigation
```

**Notification click:**
```
1. Close the notification
2. Find an existing app window (same origin)
3. If found → focus and navigate to linkUrl
4. If not found → open new window at linkUrl
```

### Registration

The `SWRegister` client component registers the service worker on mount:

```typescript
useEffect(() => {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js");
  }
}, []);
```

### Offline Page

When a navigation request fails (user is offline), the service worker serves the cached `/offline` page. This page shows a "You're offline" message with a retry button.
