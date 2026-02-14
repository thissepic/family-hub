# Architecture

This document describes the system architecture, data flow patterns, and component design of Family Hub.

## System Overview

```
┌─────────────────────────────────────────────────────────┐
│                        Clients                          │
│  Browser (PWA)  ·  Hub Display (kiosk)  ·  Mobile (PWA) │
└────────────┬──────────────────┬──────────────────┬──────┘
             │  HTTPS           │  WSS             │  Push
             ▼                  ▼                  ▼
┌────────────────────┐ ┌────────────────┐ ┌──────────────┐
│  Caddy (:80/:443)  │ │  Socket.IO     │ │  Web Push    │
│  Reverse proxy     │ │  (:3001)       │ │  (VAPID)     │
│  Auto TLS          │ │  Real-time     │ │  Background  │
└────────┬───────────┘ └──────┬─────────┘ └──────────────┘
         │                    │
         ▼                    ▼
┌─────────────────────────────────────────────────────────┐
│                  Next.js App (:3000)                     │
│                                                         │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  App Router  │  │  tRPC Server │  │  API Routes   │  │
│  │  (pages)     │  │  (16 routers)│  │  (OAuth, push)│  │
│  └──────┬──────┘  └──────┬───────┘  └───────┬───────┘  │
│         │                │                   │          │
│         ▼                ▼                   ▼          │
│  ┌──────────────────────────────────────────────────┐   │
│  │              Prisma ORM (type-safe DB client)    │   │
│  └──────────────────────┬───────────────────────────┘   │
│                         │                               │
│  ┌──────────────────────┼───────────────────────────┐   │
│  │   BullMQ Workers     │    (background jobs)      │   │
│  │   - Calendar sync    │    - Maintenance           │   │
│  └──────────────────────┼───────────────────────────┘   │
└─────────────────────────┼───────────────────────────────┘
                          │
              ┌───────────┼──────────┐
              ▼           ▼          ▼
       ┌──────────┐ ┌──────────┐ ┌──────────┐
       │PostgreSQL│ │  Redis   │ │ External │
       │  (:5432) │ │  (:6379) │ │ APIs     │
       │  34 models│ │  Job     │ │ Google   │
       │  23 enums │ │  queues  │ │ Outlook  │
       └──────────┘ └──────────┘ │ CalDAV   │
                                 │ EWS      │
                                 └──────────┘
```

## Request Flow

### tRPC Requests

Every API call goes through the tRPC pipeline:

```
Client Component
  │
  ▼
useTRPC().router.procedure.useQuery/useMutation()    (TanStack React Query)
  │
  ▼
tRPC React Provider (superjson serialization)
  │
  ▼
HTTP POST /api/trpc/{procedure}
  │
  ▼
createTRPCContext()  →  reads session from iron-session cookie
  │
  ▼
Middleware chain:
  publicProcedure    →  no auth check
  accountProcedure   →  familyId required (UNAUTHORIZED if missing)
  protectedProcedure →  full session required (UNAUTHORIZED if missing)
  adminProcedure     →  full session + ADMIN role (FORBIDDEN if member)
  │
  ▼
Zod input validation (from *_schemas.ts files)
  │
  ▼
Procedure handler (business logic + Prisma queries)
  │
  ▼
Response  →  superjson serialized back to client
```

### Real-Time Updates

Mutations that affect shared state emit Socket.IO events after the database write:

```
tRPC Mutation (e.g. shopping.addItem)
  │
  ├── 1. Prisma write (database)
  │
  ├── 2. emitToFamily(familyId, "shopping:item-added", { listId, item })
  │        │
  │        ▼
  │   Socket.IO server broadcasts to room `family:{familyId}`
  │        │
  │        ▼
  │   All connected clients in the family receive the event
  │
  └── 3. Return response to calling client
```

### XP Award Pipeline

Task/chore completions trigger a multi-step transactional pipeline:

```
Task completed / Chore completed
  │
  ▼
awardXp() called inside Prisma $transaction
  │
  ├── 1. Fetch family XpSettings
  ├── 2. Update member streak (check yesterday's activity)
  ├── 3. Calculate streak multiplier (1x → 3x)
  ├── 4. Apply multiplier → final XP + points
  ├── 5. Create XpEvent record (audit trail)
  ├── 6. Update MemberXpProfile (totalXp, points)
  ├── 7. Recalculate level from new totalXp
  ├── 8. If level-up → create notification + activity event
  ├── 9. If COLLABORATIVE mode → contribute to active FamilyGoal
  ├── 10. Evaluate all achievements → unlock if conditions met
  └── 11. Return pendingPush array
         │
         ▼  (after transaction commits)
  flushPendingPush()  →  sends Web Push notifications
```

## Layer Architecture

### Frontend Layers

```
src/app/                    Pages (Next.js App Router)
  │
  ├── layout.tsx            Root layout (wraps all providers)
  │     └── Providers:      ThemeProvider, TRPCProvider, SocketProvider, SWRegister
  │
  ├── (auth)/               Public pages (login, register, profiles, setup)
  ├── (dashboard)/          Protected pages (all modules)
  │     └── layout.tsx      Dashboard layout (Sidebar + TopNav + BottomNav)
  ├── hub/                  Kiosk display (token-protected)
  └── api/                  Server endpoints

src/components/             Reusable UI
  │
  ├── ui/                   Primitives (shadcn/ui: Button, Card, Dialog, etc.)
  ├── providers/            Context providers (theme, tRPC, socket, SW)
  ├── layout/               Shell components (Sidebar, TopNav, BottomNav)
  └── [module]/             Feature components (calendar, chores, rewards, etc.)
```

### Backend Layers

```
src/lib/
  │
  ├── auth.ts               Session management (iron-session)
  ├── db.ts                 Prisma client singleton
  │
  ├── trpc/
  │   ├── init.ts           tRPC initialization, procedure types
  │   ├── client.ts         Client-side hooks
  │   └── routers/          Business logic (16 routers, 112+ procedures)
  │       ├── _app.ts       Root router (combines all routers)
  │       ├── [module].ts   Module router
  │       └── [module]_schemas.ts   Zod validation schemas
  │
  ├── calendar-sync/        External calendar sync engine
  ├── chores/               Chore rotation algorithms
  ├── rewards/              XP engine & achievement evaluation
  ├── notifications/        In-app + push notification creation
  ├── socket/               Socket.IO server & typed events
  └── maintenance/          BullMQ background job workers
```

## Authentication & Authorization

### Session Model

Sessions are encrypted cookies managed by iron-session. The system uses a two-layer session model:

```typescript
/** Account-level session (after email/password login) */
interface SessionData {
  familyId: string;       // UUID of the family
  memberId?: string;      // Set after profile selection
  role?: "ADMIN" | "MEMBER";
  sessionToken?: string;  // Tracks active session in DB
}

/** Full session with profile selected (after PIN entry) */
interface FullSessionData extends SessionData {
  memberId: string;
  role: "ADMIN" | "MEMBER";
}
```

- Cookie: `HttpOnly`, `Secure` (production), `SameSite=strict`
- Encryption: AES (iron-session uses `SESSION_SECRET`)
- TTL: 24 hours (default), 30 days with "Remember Me"
- Active sessions tracked in `ActiveSession` table for admin visibility

### Authorization Levels

| Level | Middleware | Use |
|---|---|---|
| `publicProcedure` | None | Registration, `hasFamily` check, hub data |
| `accountProcedure` | `familyId` required | Profile listing, profile selection (after email/password login) |
| `protectedProcedure` | Full session required (`memberId` + `role`) | All standard CRUD operations |
| `adminProcedure` | Full session + ADMIN role | Family settings, member management, reward/achievement CRUD |

### Authentication Flow

```
Registration (new family):
1. GET /register  →  3-step wizard
2. Step 1: Email + password + family name + language
3. Step 2: Admin profile (name, PIN, color)
4. Step 3: Completion → auto-login → redirect to dashboard

Login (existing family):
1. GET /login  →  email + password form
2. POST account.login({ email, password, rememberMe })
3. Server: bcrypt.compare(password, family.passwordHash)
4. Success: setAccountSession(familyId, rememberMe)  →  account-level cookie
5. Redirect to /profiles

Profile selection:
6. GET /profiles  →  account.listMembers()  →  show member avatars
7. User taps avatar + enters PIN
8. POST auth.selectProfile({ memberId, pin })
9. Server: rate-limit check (5 attempts / 15 min per member)
10. Server: bcrypt.compare(pin, member.pinHash)
11. Success: upgradeSession(memberId, role)  →  full session cookie
12. Set locale cookie from member preference
13. Redirect to dashboard

Profile switching (without re-login):
- POST auth.switchProfile()  →  downgradeSession()  →  back to /profiles
```

## Data Flow Patterns

### Optimistic Updates (Shopping List)

The shopping list uses Socket.IO for real-time sync across devices:

```
Device A: addItem("Milk")
  │
  ├── tRPC mutation → Prisma insert → return item
  ├── Socket emit: "shopping:item-added" → all family clients
  │
  ▼
Device B: receives "shopping:item-added"
  └── TanStack Query cache invalidation → UI update
```

### Background Job Scheduling

Jobs are scheduled using BullMQ CRON patterns and stored in Redis:

```
Server startup (instrumentation.ts)
  │
  ├── startMaintenanceWorker()
  │     ├── cleanup-old-notifications   "0 3 * * *"     (daily 3:00 AM)
  │     ├── weekly-recap                "0 18 * * 0"    (Sunday 6:00 PM)
  │     └── daily-backup                "30 3 * * *"    (daily 3:30 AM)
  │
  └── startSyncWorker()
        └── periodic-sync              "*/5 * * * *"   (every 5 minutes)
```

## Provider Architecture

The root layout wraps the entire app in several context providers:

```tsx
<ThemeProvider>              // next-themes: dark/light mode
  <TRPCProvider>             // tRPC client + TanStack Query
    <SocketProvider>         // Socket.IO connection (joins family room)
      <SWRegister>           // Service worker registration
        {children}
      </SWRegister>
    </SocketProvider>
  </TRPCProvider>
</ThemeProvider>
```

The **SocketProvider** extracts `familyId` from the session and passes it as a handshake query parameter. On connect, the server joins the socket to room `family:{familyId}`.

## Deployment Modes

| Mode | Stack | Use Case |
|---|---|---|
| Development | `npm run dev` | Local development, hot reload |
| Docker (LAN) | `docker compose up` with `DOMAIN=localhost` | Raspberry Pi on home network |
| Docker (Public) | `docker compose up` with real domain | VPS with automatic HTTPS |

All three modes use the same codebase and Docker configuration. The only difference is the `DOMAIN` environment variable, which controls Caddy's TLS behavior.
