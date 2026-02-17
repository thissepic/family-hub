# Family Hub

A self-hosted Progressive Web App (PWA) that serves as a centralized command center for family life. Replaces scattered group chats, sticky notes, and spreadsheets with a single unified platform.

Built for households of 6+ members. Deployable on a Raspberry Pi or a small VPS. Available in English and German.

## Features

- **Multi-Family Support** &mdash; Users can belong to multiple families with a single account, switching between them seamlessly
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
- **Family Invitations** &mdash; Invite users to join a family via email link, optionally linking to an existing unlinked profile
- **Registration & User Accounts** &mdash; User account registration with email/password or OAuth, independent from family membership
- **OAuth Sign-In** &mdash; Sign in or register with Google or Microsoft accounts
- **Two-Factor Authentication** &mdash; TOTP-based 2FA with recovery codes for user account security
- **Email Verification** &mdash; Email address verification, password reset, and email change flows via SMTP

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
| Auth | Three-layer (user account + family selection + member profile) via [iron-session](https://github.com/vvo/iron-session) + bcrypt, OAuth (Google/Microsoft), 2FA ([otplib](https://github.com/yeojz/otplib)) |
| Email | [nodemailer](https://nodemailer.com/) via BullMQ queue |
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
│   │   ├── (auth)/           # Auth pages: login, registration, profile/family selection
│   │   │   ├── families/     # Family selection & management
│   │   │   ├── create-family/# New family creation wizard
│   │   │   ├── account/      # User account settings (2FA, OAuth, email, sessions)
│   │   │   └── invite/       # Invitation accept/decline page
│   │   ├── (dashboard)/      # Protected pages (calendar, tasks, chores, etc.)
│   │   ├── hub/              # TV/kiosk display mode
│   │   ├── offline/          # PWA offline fallback
│   │   └── api/              # tRPC handler, calendar OAuth callbacks, push endpoints
│   ├── components/
│   │   ├── ui/               # shadcn/ui primitives
│   │   ├── providers/        # Theme, tRPC, Socket.IO, service worker providers
│   │   ├── layout/           # Sidebar, TopNav, BottomNav
│   │   ├── account/          # Account settings components (2FA, OAuth, sessions)
│   │   ├── family/           # Family management & invitation components
│   │   └── [module]/         # Feature-specific components
│   ├── lib/
│   │   ├── trpc/routers/     # 17 tRPC routers per module
│   │   ├── calendar-sync/    # External calendar sync engine
│   │   ├── chores/           # Rotation & scheduling logic
│   │   ├── rewards/          # XP engine & constants
│   │   ├── notifications/    # In-app & push notification helpers
│   │   ├── socket/           # Socket.IO server & events
│   │   ├── maintenance/      # Background job coordination (BullMQ)
│   │   ├── email/            # SMTP transporter, templates, BullMQ queue & worker
│   │   ├── auth.ts           # Session management (3-layer: user → family → member)
│   │   ├── oauth-auth.ts     # OAuth sign-in/link/register logic
│   │   ├── two-factor.ts     # TOTP generation, verification, recovery codes
│   │   └── db.ts             # Prisma client singleton
│   └── i18n/                 # next-intl configuration
├── messages/                 # Translation files (en.json, de.json)
├── public/                   # PWA manifest, service worker, icons
├── scripts/                  # Build-time scripts (SW version injection)
├── docker-compose.yml        # PostgreSQL, Redis, Caddy, App, Migrate
├── Dockerfile                # 3-stage Alpine build
├── Dockerfile.migrate        # Prisma migration runner
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

Open [http://localhost:3000](http://localhost:3000). You'll be guided through creating a user account and your first family.

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

Startup order:
  1. PostgreSQL + Redis start
  2. migrate service runs prisma migrate deploy, then exits
  3. app service starts (depends on successful migration)
```

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| **Core** | | | |
| `DATABASE_URL` | Yes | &mdash; | PostgreSQL connection string |
| `REDIS_URL` | Yes | &mdash; | Redis connection string |
| `SESSION_SECRET` | Yes | &mdash; | iron-session encryption key (32+ chars) |
| `SESSION_TTL` | No | `86400` | Default session duration in seconds (24h) |
| `REMEMBER_ME_TTL` | No | `2592000` | "Remember Me" session duration in seconds (30d) |
| `NEXT_PUBLIC_APP_URL` | Yes | &mdash; | Public URL of the app |
| **Docker** | | | |
| `DOMAIN` | Docker | `localhost` | Domain for Caddy TLS |
| `POSTGRES_PASSWORD` | Docker | `familyhub` | PostgreSQL password |
| **Socket.IO** | | | |
| `SOCKET_PORT` | No | `3001` | Socket.IO server port |
| `NEXT_PUBLIC_SOCKET_URL` | No | auto-detected | Socket.IO client URL (derived from `window.location` in production) |
| **Email (SMTP)** | | | |
| `SMTP_HOST` | No | &mdash; | SMTP server hostname |
| `SMTP_PORT` | No | &mdash; | SMTP server port |
| `SMTP_SECURE` | No | `false` | Use TLS for SMTP connection |
| `SMTP_USER` | No | &mdash; | SMTP authentication username |
| `SMTP_PASS` | No | &mdash; | SMTP authentication password |
| `SMTP_FROM` | No | &mdash; | Sender address (e.g. `Family Hub <noreply@example.com>`) |
| **OAuth (Calendar Sync)** | | | |
| `GOOGLE_CLIENT_ID` | No | &mdash; | Google OAuth client ID (shared with auth) |
| `GOOGLE_CLIENT_SECRET` | No | &mdash; | Google OAuth client secret |
| `GOOGLE_REDIRECT_URI` | No | &mdash; | Google Calendar OAuth callback URL |
| `MICROSOFT_CLIENT_ID` | No | &mdash; | Microsoft OAuth client ID (shared with auth) |
| `MICROSOFT_CLIENT_SECRET` | No | &mdash; | Microsoft OAuth client secret |
| `MICROSOFT_TENANT_ID` | No | `common` | Azure AD tenant |
| `MICROSOFT_REDIRECT_URI` | No | &mdash; | Microsoft Calendar OAuth callback URL |
| **OAuth (Sign-In)** | | | |
| `GOOGLE_AUTH_REDIRECT_URI` | No | &mdash; | Google sign-in OAuth callback URL |
| `MICROSOFT_AUTH_REDIRECT_URI` | No | &mdash; | Microsoft sign-in OAuth callback URL |
| **Security** | | | |
| `TOKEN_ENCRYPTION_KEY` | No | &mdash; | AES-256-GCM key for OAuth tokens and 2FA secrets |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | No | &mdash; | Web Push VAPID public key |
| `VAPID_PRIVATE_KEY` | No | &mdash; | Web Push VAPID private key |
| `VAPID_SUBJECT` | No | &mdash; | Web Push contact (mailto: URI) |
| `RATE_LIMIT_LOGIN_ATTEMPTS` | No | `5` | Max failed login attempts per window |
| `RATE_LIMIT_LOGIN_WINDOW` | No | `900` | Login rate limit window in seconds (15 min) |
| `ACCOUNT_LOCKOUT_THRESHOLD` | No | `10` | Failed attempts before account lockout |
| `ACCOUNT_LOCKOUT_DURATION` | No | `3600` | Account lockout duration in seconds (1h) |
| **Backups** | | | |
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

Family Hub uses a three-layer authentication system that decouples user accounts from families:

1. **User login** &mdash; Users register with an email and password (or via OAuth with Google/Microsoft). On login, the user account is authenticated and a user-level session is created. Users are redirected to `/families` to select a family.
2. **Two-factor authentication (optional)** &mdash; If 2FA is enabled on the user account, the user must enter a TOTP code from an authenticator app (or a recovery code) before the session is granted.
3. **Family selection** &mdash; The user selects which family to interact with. Users can belong to multiple families. This upgrades the session to a family-level session.
4. **Profile selection** &mdash; After selecting a family, the user selects their member profile and enters a personal PIN (hashed with bcrypt). This upgrades the session to a full session with member identity and role.
5. A 24-hour encrypted session cookie is set via iron-session (extendable to 30 days with "Remember Me"). Cookies use `SameSite=lax` to support OAuth redirect flows.
6. Two roles: **Admin** (full management) and **Member** (personal use).
7. Rate limiting protects against brute-force attacks (5 login attempts per 15 min, account lockout after 10 failures, 5 PIN attempts per 15 min per member, 5 TOTP attempts per 15 min).

### Multi-Family Support

A single user account can belong to multiple families. After logging in, users see a family selection page listing all their families. Users can:

- Create new families
- Accept invitations to join existing families
- Switch between families without logging out

### Family Invitations

Admins can invite new users to join their family:

- **Email invitations** &mdash; An invitation email with a unique link is sent. The recipient creates a user account (or logs in) and joins the family.
- **Link-only invitations** &mdash; A shareable invitation link without a specific email. Anyone with the link can accept.
- **Profile-bound invitations** &mdash; Admins can create invitations for specific unlinked member profiles. When accepted, the user's account is linked to the existing profile (preserving XP, chore history, etc.) instead of creating a new member.

### OAuth Sign-In

Users can register or sign in using Google or Microsoft accounts via OAuth 2.0. OAuth uses the same client credentials as calendar sync but with separate redirect URIs (`/api/auth/google/callback`, `/api/auth/microsoft/callback`).

- **New registration:** OAuth redirects to the registration flow. A user account is created with the OAuth identity linked. Email is automatically marked as verified.
- **Existing account:** If the OAuth email matches a verified user account, the OAuth identity is auto-linked and the user is logged in.
- **Account linking:** Users can link/unlink OAuth providers in Account Settings. OAuth-only accounts can set a password later.

### Two-Factor Authentication (2FA)

Any user can enable TOTP-based two-factor authentication in Account Settings (`/account`). Requires email verification first.

- **Setup:** Scan QR code with any authenticator app (Google Authenticator, Authy, etc.), verify with a 6-digit code.
- **Recovery codes:** 10 single-use recovery codes (format: `XXXX-XXXX`) are generated on setup. Download and store them securely.
- **Login flow:** After email/password verification, a pending token (5 min TTL, stored in Redis) redirects the user to `/verify-2fa` where they enter a TOTP code or recovery code.
- **Security:** TOTP secrets are encrypted with AES-256-GCM before database storage. Recovery codes are bcrypt-hashed.

### Email Verification & Password Reset

Email verification, password reset, and email change flows require SMTP configuration (see [Environment Variables](#environment-variables)).

- **Verification:** A verification email is sent on registration. An unverified-email banner appears on the dashboard until verified. Tokens expire after 24 hours.
- **Password reset:** Users request a reset at `/forgot-password`. A reset link (1h expiry) is emailed. After reset, all active sessions are invalidated.
- **Email change:** Users can change their account email in Account Settings. A notification is sent to the old email and a verification link to the new one.
- **Development:** Use `npx maildev` for a local SMTP server (port 1025) with a web UI on port 1080.

Emails are sent via a BullMQ queue with 3 retry attempts. The app functions without SMTP &mdash; email features are silently disabled.

Registration creates a user account with email and password (or OAuth). After registration, the user is guided to create their first family or accept a pending invitation.

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

Locale is determined by: member preference > family default > user default > `en`. The preference is stored as a cookie and can be changed per member in settings.

## Documentation

Detailed documentation is available in the [`docs/`](./docs/) directory:

| Document | Description |
|---|---|
| [Architecture](./docs/architecture.md) | System overview, request flow, data flow patterns, provider architecture |
| [Database Schema](./docs/database.md) | All 41 models, 27 enums, relationships, and management commands |
| [API Reference](./docs/api-reference.md) | All 17 tRPC routers with 120+ procedures, authorization levels |
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
