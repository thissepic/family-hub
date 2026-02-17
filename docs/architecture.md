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
│  │  (pages)     │  │  (17 routers)│  │  (OAuth, push)│  │
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
│  │   - Email            │                            │   │
│  └──────────────────────┼───────────────────────────┘   │
└─────────────────────────┼───────────────────────────────┘
                          │
              ┌───────────┼──────────┐
              ▼           ▼          ▼
       ┌──────────┐ ┌──────────┐ ┌──────────┐
       │PostgreSQL│ │  Redis   │ │ External │
       │  (:5432) │ │  (:6379) │ │ APIs     │
       │  41 models│ │  Job     │ │ Google   │
       │  27 enums │ │  queues  │ │ Outlook  │
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
  userProcedure      →  userId required (UNAUTHORIZED if missing)
  familyProcedure    →  userId + familyId required (UNAUTHORIZED if missing)
  protectedProcedure →  full session required: userId + familyId + memberId + role
  adminProcedure     →  full session + ADMIN role (FORBIDDEN if member)
  │
  ▼
Zod input validation
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
  ├── (auth)/               Auth pages
  │     ├── login/          Email/password login
  │     ├── register/       User account registration
  │     ├── families/       Family selector (after login)
  │     ├── create-family/  New family creation wizard
  │     ├── profiles/       Member profile selection (PIN-based)
  │     ├── account/        Account settings (email, password, 2FA, OAuth)
  │     ├── invite/[token]/ Invitation acceptance page
  │     ├── setup/          First-time setup wizard
  │     ├── verify-email/   Email verification
  │     ├── reset-password/ Password reset
  │     └── verify-2fa/     Two-factor verification
  │
  ├── (dashboard)/          Protected pages (all modules)
  │     └── layout.tsx      Dashboard layout (Sidebar + TopNav + BottomNav)
  ├── hub/                  Kiosk display (token-protected)
  └── api/                  Server endpoints

src/components/             Reusable UI
  │
  ├── ui/                   Primitives (shadcn/ui: Button, Card, Dialog, etc.)
  ├── providers/            Context providers (theme, tRPC, socket, SW)
  ├── layout/               Shell components (Sidebar, TopNav, BottomNav)
  ├── auth/                 Auth components (login screen, register wizard, family selector, user toolbar)
  ├── account/              Account settings components
  ├── family/               Family creation wizard, invitation acceptance
  ├── settings/             Family settings, invitations panel, member dialog
  └── [module]/             Feature components (calendar, chores, rewards, etc.)
```

### Backend Layers

```
src/lib/
  │
  ├── auth.ts               Session management (iron-session, 3-layer model)
  ├── db.ts                 Prisma client singleton
  │
  ├── trpc/
  │   ├── init.ts           tRPC initialization, 5 procedure types
  │   ├── client.ts         Client-side hooks
  │   └── routers/          Business logic (17 routers)
  │       ├── _app.ts       Root router (combines all routers)
  │       ├── account.ts    User authentication & settings
  │       ├── auth.ts       Session lifecycle (family/profile selection)
  │       ├── family.ts     Registration, family CRUD
  │       ├── members.ts    Member management, profile linking
  │       ├── invitations.ts Family invitation system
  │       └── [module].ts   Feature routers
  │
  ├── calendar-sync/        External calendar sync engine
  ├── chores/               Chore rotation algorithms
  ├── rewards/              XP engine & achievement evaluation
  ├── notifications/        In-app + push notification creation
  ├── socket/               Socket.IO server & typed events
  ├── maintenance/          BullMQ background job workers
  ├── email/                SMTP transporter, HTML templates, BullMQ queue & worker
  ├── oauth-auth.ts         OAuth sign-in/link/register logic
  ├── two-factor.ts         TOTP generation, QR codes, recovery codes
  └── two-factor-pending.ts Redis-based pending 2FA tokens
```

## Authentication & Authorization

### Session Model

Sessions are encrypted cookies managed by iron-session. The system uses a **three-layer session model**:

```typescript
/** Layer 1: User-level session (after email/password or OAuth login) */
interface SessionData {
  userId: string;       // UUID of the user
  familyId?: string;    // Set after family selection
  memberId?: string;    // Set after profile resolution
  role?: "ADMIN" | "MEMBER";
  sessionToken?: string;  // Tracks active session in DB
}

/** Layer 2: Family-level session (user + family selected) */
interface FamilySessionData extends SessionData {
  familyId: string;
}

/** Layer 3: Full session (user + family + member profile resolved) */
interface FullSessionData extends FamilySessionData {
  memberId: string;
  role: "ADMIN" | "MEMBER";
}
```

**Type Guards:**
- `isUserSession(session)` &mdash; has `userId`
- `isFamilySession(session)` &mdash; has `userId` + `familyId`
- `isFullSession(session)` &mdash; has `userId` + `familyId` + `memberId` + `role`

**Session Lifecycle Functions:**
- `setUserSession(userId, rememberMe)` &mdash; creates Layer 1 session after login
- `selectFamily(familyId)` &mdash; sets `familyId`, auto-resolves `memberId` if user is linked to a member
- `upgradeSession(memberId, role)` &mdash; sets `memberId` + `role` (PIN-based profile selection)
- `downgradeToFamily()` &mdash; removes `memberId` (switch profile within same family)
- `downgradeToUser()` &mdash; removes `familyId` + `memberId` (switch to different family)
- `clearSession()` &mdash; full logout

**Cookie properties:**
- `HttpOnly`, `Secure` (production), `SameSite=lax` (required for OAuth redirect flows)
- Encryption: AES (iron-session uses `SESSION_SECRET`)
- TTL: 24 hours (default), 30 days with "Remember Me"
- Active sessions tracked in `ActiveSession` table for user visibility

### Authorization Levels

| Level | Middleware | Required Session | Use |
|---|---|---|---|
| `publicProcedure` | None | None | Registration, login, hub data, invitation lookup |
| `userProcedure` | `userId` required | Layer 1 | Account settings, family listing, 2FA, OAuth, invitation acceptance |
| `familyProcedure` | `userId` + `familyId` required | Layer 2 | Family details, profile selection |
| `protectedProcedure` | Full session required | Layer 3 | All standard CRUD operations |
| `adminProcedure` | Full session + ADMIN role | Layer 3 + ADMIN | Family settings, member management, invitation management |

### Authentication Flows

```
Registration (email/password):
1. GET /register  →  email + password form
2. POST family.registerUser({ email, password, locale })
3. Server: hash password, create User, setUserSession(userId)
4. Verification email sent (24h expiry, non-blocking)
5. Redirect to /families (create a family or accept invitations)

Registration (OAuth):
1. GET /register → click "Sign up with Google/Microsoft"
2. Redirect to provider → user authorizes → callback
3. If email not linked → store OAuth data in sealed cookie → redirect to /register?oauth=provider
4. POST family.registerUserWithOAuth({ locale })
5. Server: create User + OAuthAccount, emailVerified=true, setUserSession(userId)
6. Redirect to /families

Login (email/password):
1. GET /login  →  email + password form
2. POST account.login({ email, password, rememberMe })
3. Server: find User, bcrypt.compare(password, user.passwordHash)
4. If 2FA disabled: setUserSession(userId, rememberMe) → redirect to /families
5. If 2FA enabled: createPendingToken({ userId, rememberMe }) → redirect to /verify-2fa?token=...

Login (OAuth):
1. GET /login → click "Sign in with Google/Microsoft"
2. Redirect to provider → user authorizes → callback
3. If OAuth identity exists → setUserSession(userId) → redirect to /families
4. If email matches verified user → auto-link OAuth → setUserSession(userId) → redirect to /families
5. If no match → redirect to /register?oauth=provider

Two-Factor Verification:
1. GET /verify-2fa?token=...  →  TOTP code or recovery code input
2. POST account.verifyTwoFactor({ token, code })
3. Server: validate pending token (5 min TTL, Redis)
4. Server: verify TOTP code (±1 time step) or match recovery code (bcrypt)
5. Success: consume pending token → setUserSession(userId) → redirect to /families

Family selection:
1. GET /families → account.listFamilies() or family.listFamilies() → show family cards
2. User clicks a family
3. POST auth.selectFamily({ familyId })
4. Server: verify user is a member of this family
5. If user has a linked FamilyMember (userId match) → auto-resolve to full session → redirect to /
6. If no linked member → set familyId only → redirect to /profiles

Family creation:
1. GET /create-family → wizard form
2. POST family.createFamily({ name, locale, adminName, adminColor, adminPin })
3. Server: create Family + FamilyMember (with userId) + MemberXpProfile
4. Auto-select the new family → full session → redirect to /

Profile selection (unlinked profiles):
5. GET /profiles  →  auth members list (via getSession + listMembers)  →  show member avatars
6. User taps avatar + enters PIN
7. POST auth.selectProfile({ memberId, pin })
8. Server: rate-limit check (5 attempts / 15 min per member)
9. Server: bcrypt.compare(pin, member.pinHash)
10. Success: upgradeSession(memberId, role) → full session cookie
11. Set locale cookie from member preference
12. Redirect to dashboard

Invitation acceptance:
1. GET /invite/[token] → invitations.getByToken({ token })
2. If not logged in → redirect to /login (with returnUrl)
3. If profile-bound invitation (forMember set) → show existing profile info
4. If regular invitation → show name/color form
5. POST invitations.accept({ token, memberName?, memberColor? })
6. Server: create FamilyMember or link existing profile to user
7. Auto-select family → redirect to /

Profile switching (without re-login):
- POST auth.switchProfile()  →  downgradeToFamily()  →  back to /profiles

Family switching:
- POST auth.switchFamily()  →  downgradeToUser()  →  back to /families
```

### OAuth Account Linking

```
From Account Settings (/account) → Linked Accounts:
1. User clicks "Link Google/Microsoft" → /api/auth/{provider}?action=link
2. OAuth state includes userId → callback creates OAuthAccount record
3. Redirect back to account settings with success message

Safeguards:
- Cannot unlink the last authentication method
- OAuth-only accounts can set a password at any time
- Auto-linking only occurs when OAuth email matches a verified user account
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
  ├── startSyncWorker()
  │     └── periodic-sync              "*/5 * * * *"   (every 5 minutes)
  │
  └── startEmailWorker()
        └── Processes email jobs (verification, password reset, email change, invitation)
            Concurrency: 2, retries: 3, exponential backoff (3s base)
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
