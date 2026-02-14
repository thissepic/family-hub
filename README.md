# Family Hub

A self-hosted Progressive Web App (PWA) that serves as a centralized command center for family life. Replaces scattered group chats, sticky notes, and spreadsheets with a single unified platform.

Built for households of 6+ members. Deployable on a Raspberry Pi or a small VPS. Available in English and German.

## Features

- **Shared Calendar** &mdash; Family events with recurrence support and external sync (Google, Apple/CalDAV, Outlook, Exchange)
- **Daily Tasks** &mdash; Personal task management with templates and history
- **Household Chores** &mdash; Rotating chore assignments with fairness tracking (round-robin, random, weighted)
- **Shopping List** &mdash; Real-time collaborative list with categories
- **Meal Planner** &mdash; Weekly breakfast/lunch/dinner grid with recipe management
- **Notes & Bulletin Board** &mdash; Rich text notes with attachments and pinning
- **XP & Rewards** &mdash; Gamification system with levels, achievements, leaderboard, and a rewards shop
- **Activity Feed** &mdash; Chronological log of all family activity
- **Hub Display** &mdash; TV/kiosk mode showing panels for clock, schedule, chores, meals, and more
- **Notifications** &mdash; In-app and Web Push notifications with per-member preferences
- **Global Search** &mdash; Full-text search across all modules (Cmd/Ctrl+K)
- **Registration & Setup** &mdash; Account registration wizard and guided first-time family configuration

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Next.js 16](https://nextjs.org/) (App Router, standalone output) |
| Language | TypeScript 5 |
| UI | [Tailwind CSS 4](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) + [Radix UI](https://www.radix-ui.com/) |
| API | [tRPC 11](https://trpc.io/) (end-to-end type safety) |
| Database | [PostgreSQL 16](https://www.postgresql.org/) via [Prisma 6](https://www.prisma.io/) |
| Real-time | [Socket.IO 4](https://socket.io/) |
| Background Jobs | [BullMQ 5](https://docs.bullmq.io/) + [Redis 7](https://redis.io/) |
| Auth | Two-layer (email/password + PIN) via [iron-session](https://github.com/vvo/iron-session) + bcrypt |
| Calendar | [FullCalendar 6](https://fullcalendar.io/) + [rrule](https://github.com/jkbrzt/rrule) |
| Rich Text | [Tiptap 3](https://tiptap.dev/) |
| i18n | [next-intl](https://next-intl-docs.vercel.app/) (EN/DE) |
| Push | [Web Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API) with VAPID |
| Deployment | Docker Compose + [Caddy 2](https://caddyserver.com/) (automatic HTTPS) |

## Project Structure

```
family-hub/
├── packages/db/prisma/       # Prisma schema, migrations, seed
├── src/
│   ├── app/
│   │   ├── (auth)/           # Login, registration & setup wizard pages
│   │   ├── (dashboard)/      # Protected pages (calendar, tasks, chores, etc.)
│   │   ├── hub/              # TV/kiosk display mode
│   │   ├── offline/          # PWA offline fallback
│   │   └── api/              # tRPC handler, calendar OAuth callbacks, push endpoints
│   ├── components/
│   │   ├── ui/               # shadcn/ui primitives
│   │   ├── providers/        # Theme, tRPC, Socket.IO, service worker providers
│   │   ├── layout/           # Sidebar, TopNav, BottomNav
│   │   └── [module]/         # Feature-specific components
│   ├── lib/
│   │   ├── trpc/routers/     # tRPC routers per module
│   │   ├── calendar-sync/    # External calendar sync engine
│   │   ├── chores/           # Rotation & scheduling logic
│   │   ├── rewards/          # XP engine & constants
│   │   ├── notifications/    # In-app & push notification helpers
│   │   ├── socket/           # Socket.IO server & events
│   │   ├── maintenance/      # Background job coordination (BullMQ)
│   │   ├── auth.ts           # Session management
│   │   └── db.ts             # Prisma client singleton
│   └── i18n/                 # next-intl configuration
├── messages/                 # Translation files (en.json, de.json)
├── public/                   # PWA manifest, service worker, icons
├── scripts/                  # Build-time scripts (SW version injection)
├── docker-compose.yml        # PostgreSQL, Redis, Caddy, App
├── Dockerfile                # 3-stage Alpine build
└── Caddyfile                 # Reverse proxy config
```

## Prerequisites

- **Node.js** 22+
- **PostgreSQL** 16+
- **Redis** 7+

Or just **Docker** and **Docker Compose** for production deployment.

## Getting Started

### 1. Clone and install

```bash
git clone https://github.com/thissepic/family-hub.git
cd family-hub
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set at minimum:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `SESSION_SECRET` | Random string, 32+ characters |
| `NEXT_PUBLIC_APP_URL` | Public URL (e.g. `http://localhost:3000`) |

See [Environment Variables](#environment-variables) for the full list.

### 3. Set up the database

```bash
npx prisma migrate deploy
npx prisma generate
```

Optionally seed with sample data:

```bash
npx prisma db seed
```

### 4. Start development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The setup wizard will guide you through creating your family on first visit.

## Production Deployment (Docker)

The included Docker Compose stack runs all services: Next.js app, PostgreSQL, Redis, and Caddy (automatic HTTPS).

### 1. Configure

```bash
cp .env.example .env
```

Set production values:

```env
DOMAIN=hub.thisisepic.de
POSTGRES_PASSWORD=<strong-password>
SESSION_SECRET=<random-32-chars>
NEXT_PUBLIC_APP_URL=https://hub.thisisepic.de
```

### 2. Deploy

```bash
docker compose up -d
```

Caddy automatically obtains TLS certificates via Let's Encrypt. The app is available at `https://<DOMAIN>`.

### Architecture

```
Internet
  │
  ▼
Caddy (:80/:443)  ──  automatic HTTPS
  │
  ├── /             → app:3000  (Next.js)
  └── /socket.io/*  → app:3001  (Socket.IO)
                         │
                         ├── PostgreSQL (:5432)
                         └── Redis (:6379)
```

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | &mdash; | PostgreSQL connection string |
| `REDIS_URL` | Yes | &mdash; | Redis connection string |
| `SESSION_SECRET` | Yes | &mdash; | iron-session encryption key (32+ chars) |
| `SESSION_TTL` | No | `86400` | Default session duration in seconds (24h) |
| `REMEMBER_ME_TTL` | No | `2592000` | "Remember Me" session duration in seconds (30d) |
| `NEXT_PUBLIC_APP_URL` | Yes | &mdash; | Public URL of the app |
| `DOMAIN` | Docker | `localhost` | Domain for Caddy TLS |
| `POSTGRES_PASSWORD` | Docker | `familyhub` | PostgreSQL password |
| `SOCKET_PORT` | No | `3001` | Socket.IO server port |
| `NEXT_PUBLIC_SOCKET_URL` | No | `http://localhost:3001` | Socket.IO client URL |
| `GOOGLE_CLIENT_ID` | No | &mdash; | Google Calendar OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | No | &mdash; | Google Calendar OAuth secret |
| `GOOGLE_REDIRECT_URI` | No | &mdash; | Google OAuth callback URL |
| `MICROSOFT_CLIENT_ID` | No | &mdash; | Outlook/Microsoft OAuth client ID |
| `MICROSOFT_CLIENT_SECRET` | No | &mdash; | Outlook/Microsoft OAuth secret |
| `MICROSOFT_TENANT_ID` | No | `common` | Azure AD tenant |
| `MICROSOFT_REDIRECT_URI` | No | &mdash; | Microsoft OAuth callback URL |
| `TOKEN_ENCRYPTION_KEY` | No | &mdash; | AES-256-GCM key for OAuth token storage |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | No | &mdash; | Web Push VAPID public key |
| `VAPID_PRIVATE_KEY` | No | &mdash; | Web Push VAPID private key |
| `VAPID_SUBJECT` | No | &mdash; | Web Push contact (mailto: URI) |
| `RATE_LIMIT_LOGIN_ATTEMPTS` | No | `5` | Max failed login attempts per window |
| `RATE_LIMIT_LOGIN_WINDOW` | No | `900` | Login rate limit window in seconds (15 min) |
| `ACCOUNT_LOCKOUT_THRESHOLD` | No | `10` | Failed attempts before account lockout |
| `ACCOUNT_LOCKOUT_DURATION` | No | `3600` | Account lockout duration in seconds (1h) |
| `BACKUP_DIR` | No | `/backups` | Database backup directory |
| `BACKUP_RETENTION_DAYS` | No | `7` | Days to keep backups |

**Generating keys:**

```bash
# Session secret
openssl rand -hex 32

# Token encryption key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# VAPID keys
npx web-push generate-vapid-keys
```

## NPM Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server (auto-injects SW version) |
| `npm run build` | Production build (auto-injects SW version) |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |

## External Calendar Sync

Family Hub can sync with external calendar providers. Each requires its own OAuth or credential setup:

| Provider | Setup |
|---|---|
| **Google Calendar** | Create OAuth credentials at [Google Cloud Console](https://console.cloud.google.com/apis/credentials) |
| **Microsoft Outlook** | Register an app at [Azure Portal](https://portal.azure.com/) (App registrations) |
| **Apple / CalDAV** | Connect with CalDAV server URL and credentials (works with Nextcloud, iCloud, etc.) |
| **Exchange (EWS)** | Connect with Exchange Web Services URL and credentials |

Sync supports inbound-only or two-way modes with configurable privacy (full details or busy/free only).

## Authentication

Family Hub uses a two-layer authentication system:

1. **Account login** &mdash; Each family registers with an email and password. On login, the family account is authenticated and a secure session is created.
2. **Profile selection** &mdash; After account login, the user selects their family member profile and enters a personal PIN (hashed with bcrypt). This upgrades the session to a full session with member identity and role.
3. A 24-hour encrypted session cookie is set via iron-session (extendable to 30 days with "Remember Me").
4. Two roles: **Admin** (full management) and **Member** (personal use).
5. Rate limiting protects against brute-force attacks (5 login attempts per 15 min, account lockout after 10 failures, 5 PIN attempts per 15 min per member).

The registration wizard guides new families through account creation, admin profile setup, and initial configuration.

## PWA & Offline Support

Family Hub is installable as a Progressive Web App:

- **Manifest** at `/manifest.json` &mdash; standalone display, themed icons
- **Service Worker** caches static assets and provides an offline fallback page
- **Web Push** notifications for chore deadlines, calendar reminders, achievement unlocks, etc.
- Build ID is injected into the service worker at build time to ensure cache busting on deploys

## Internationalization

Two languages are supported out of the box:

- English (`messages/en.json`)
- German (`messages/de.json`)

Locale is determined by: member preference > family default > `en`. The preference is stored as a cookie and can be changed per member in settings.

## Documentation

Detailed documentation is available in the [`docs/`](./docs/) directory:

| Document | Description |
|---|---|
| [Architecture](./docs/architecture.md) | System overview, request flow, data flow patterns, provider architecture |
| [Database Schema](./docs/database.md) | All 34 models, 23 enums, relationships, and management commands |
| [API Reference](./docs/api-reference.md) | All 16 tRPC routers with 112+ procedures, authorization levels |
| [Chore Rotation](./docs/chore-rotation.md) | Rotation algorithms, period calculation, swap workflow, instance lifecycle |
| [Rewards System](./docs/rewards-system.md) | XP engine, streak multipliers, achievements, reward redemption |
| [Calendar Sync](./docs/calendar-sync.md) | OAuth flows, provider adapters, sync tokens, privacy modes |
| [Real-Time & Jobs](./docs/realtime-and-jobs.md) | Socket.IO events, BullMQ job schedules, service worker strategy |
| [Hub Display](./docs/hub-display.md) | Kiosk mode setup, panel configuration, night dimming, rotation |

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

For security issues, see [SECURITY.md](./SECURITY.md).

## Disclaimer

This software is provided "as is", without warranty of any kind. The authors and contributors are not liable for any damages arising from the use of this software. Use it at your own risk. See [Section 15 and 16 of the AGPL-3.0 license](./LICENSE) for the full legal terms.

## License

This project is licensed under the [GNU Affero General Public License v3.0](./LICENSE). See the [LICENSE](./LICENSE) file for details.
