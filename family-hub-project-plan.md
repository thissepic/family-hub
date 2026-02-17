# Family Hub — Project Plan

> **Note (February 2026):** The authentication model described in this original planning document has been significantly reworked. The initial design used a single-layer family-based auth model (one family = one email/password + member PINs). The implemented system uses a **three-layer model**: User Account (email/password or OAuth, 2FA) → Family Selection (multi-family support) → Member Profile (PIN). User accounts are fully decoupled from families, enabling multi-family membership and a family invitation system. Sections below describing authentication, the database schema, and the setup wizard reflect the original design intent, not the current implementation. See `docs/architecture.md` and `docs/database.md` for the current architecture.

## 1. Vision

A self-hosted web application that acts as a centralized command center for family life. It replaces scattered group chats, sticky notes, and spreadsheets with a single place the whole family opens every day. Designed as a **Progressive Web App (PWA)** so it installs on any phone, tablet, or desktop like a native app — no app store needed. A dedicated TV/kiosk mode turns any screen into an always-on family dashboard.

**Target audience:** 6+ family members. **Languages:** English & German. **Deployment:** Docker Compose on Raspberry Pi or Hetzner VPS.

---

## 2. Feature Breakdown

### 2.1 Family Members & Profiles

Every person in the household gets a profile. This is the foundation everything else connects to.

| Detail | Description |
|---|---|
| **Fields** | Name, avatar (upload or pick an icon), personal color (used across calendar, tasks, etc.), PIN or password |
| **Roles** | `admin` (parents — full control) and `member` (kids — can view everything, limited editing) |
| **Auth model** | Simple family-internal auth. One household = one "family" unit. Members log in by selecting their name and entering a PIN. If hosted on Hetzner (public internet), a household-level password gate or Tailscale/Headscale adds an extra layer of security. |
| **Settings** | Each member can toggle notification preferences, set a default calendar view, choose language (EN/DE), and set theme preference. |

### 2.2 Shared Calendar

The heart of the app. A unified view of everyone's lives — combining locally-created events with synced events from external calendars (Google, Apple, Outlook, etc.) so nobody has to enter anything twice.

| Detail | Description |
|---|---|
| **Views** | Month, week, day, and agenda (list). |
| **Events** | Title, description, start/end datetime, location (optional), assigned member(s), category tag, recurrence rules (daily, weekly, monthly, yearly, custom). |
| **Color coding** | Each event inherits the color of the assigned member. Multi-person events show stacked colors or a gradient. External synced events get a subtle badge/icon indicating the source (e.g., Google logo). |
| **Categories** | School, Work, Medical, Sports, Social, Family, Other (customizable). |
| **Conflict detection** | Visual warning when two events overlap for the same person — works across both local and synced events. |
| **Birthdays & Anniversaries** | Special recurring event type that appears with an icon. |
| **Notifications** | Configurable reminders (e.g., 15 min, 1 hour, 1 day before). Delivered via browser push notifications (PWA). Reminders for synced events are optional (the external calendar likely handles its own). |

**External Calendar Sync:**

Each family member can connect one or more external calendar accounts and choose exactly which calendar groups to sync into the Family Hub.

| Detail | Description |
|---|---|
| **Supported providers** | **Google Calendar** (OAuth2 + Calendar API), **Apple iCloud** (CalDAV), **Microsoft Outlook/365** (Microsoft Graph API), **Any CalDAV server** (Nextcloud, Synology, Radicale, etc.). |
| **Calendar selection** | After connecting an account, the member sees a list of all their calendars/groups (e.g., "Work", "Personal", "Kids' School", "Sports Team"). They toggle on only the ones they want to share with the family. Private calendars stay private. |
| **Sync direction** | **Inbound by default:** External → Family Hub (read-only mirror). Events from external calendars appear in the shared view but can't be edited in Family Hub — edits happen in the source calendar. **Optional two-way sync:** Events created in Family Hub can be pushed back to a designated external calendar. |
| **Sync frequency** | Background sync every 5–15 minutes (configurable). Manual "sync now" button available. Uses webhook/push notifications where supported (Google Calendar API supports push) for near-instant updates. |
| **Privacy controls** | Per-calendar choice: **Full details** (title, time, location, description visible) or **Busy/Free only** (time blocks shown but title replaced with "Busy" — useful for work calendars where colleagues' meeting titles shouldn't be visible to the whole family). |
| **Visual distinction** | Synced events are visually marked (small source icon) so it's clear what lives in Family Hub vs. what's pulled from an external calendar. Local events can be edited in-app; synced events link out to the source. |
| **Token management** | OAuth tokens stored encrypted in the database. Refresh tokens handled automatically. Members can disconnect a calendar at any time, which removes synced events and revokes the token. |
| **Conflict handling** | If a synced event overlaps with a local event for the same person, the conflict detection applies equally. |
| **Offline resilience** | Last-synced data is cached. If the external provider is unreachable, the most recent version of synced events remains visible. |

**Connection flow (example — Google Calendar):**
1. Member goes to Settings → My Calendars → "Connect Google Calendar."
2. Redirected to Google OAuth consent screen — grants read (and optionally write) access.
3. App fetches the list of the member's Google Calendars.
4. Member toggles on the calendars they want to share (e.g., ✅ "Family", ✅ "Kids School", ❌ "Work Meetings").
5. Selected calendars sync immediately, events appear in the shared calendar in the member's color.
6. Background sync keeps them updated going forward.

**Import/Export (manual):**

| Detail | Description |
|---|---|
| **iCal import** | Upload a `.ics` file to bulk-import events (useful for one-time migration or sharing from unsupported providers). |
| **iCal export** | Export the full Family Hub calendar (or a filtered view per member/category) as `.ics` for use elsewhere. |
| **CalDAV server (stretch goal)** | Optionally expose the Family Hub calendar itself as a CalDAV server — allowing external apps to subscribe to it natively. |

### 2.3 Daily Tasks

A simple daily to-do system for one-off and recurring personal tasks (not household chores — those go in 2.4).

| Detail | Description |
|---|---|
| **Task fields** | Title, description, assigned member(s), due time (optional), priority (low/medium/high), recurrence pattern. |
| **Recurrence** | Daily, specific weekdays (e.g., Mon/Wed/Fri), weekly, monthly. |
| **Daily view** | "Today's Board" — shows each family member's tasks for the day as a checklist. Completed tasks get a satisfying strikethrough + checkmark. |
| **Templates** | Save a set of tasks as a template (e.g., "Weekend Cleaning") that can be activated with one click. |
| **Examples** | Homework, practice piano, pack school bag, call grandma, water the plants. |

### 2.4 Chore Management & Rotation

A dedicated system for recurring household responsibilities with automatic rotation and fairness tracking. This is separate from daily tasks because chores have ownership cycles, accountability, and need a clear "whose turn is it?" answer at all times.

| Detail | Description |
|---|---|
| **Chore fields** | Title, description, frequency (daily / weekly / biweekly / monthly), difficulty level (easy / medium / hard), estimated time, category (Kitchen, Bathroom, Garden, Laundry, General — customizable). |
| **Rotation pool** | Each chore has a pool of assigned members who rotate through it. E.g., "Clean bathroom" is assigned to Anna, Ben, and Clara — they cycle weekly. |
| **Rotation patterns** | **Round-robin** (default): members take turns in fixed order. **Random**: shuffled each cycle. **Weighted**: members with fewer chores get priority (fairness balancing). |
| **Rotation calendar** | Visual calendar/timeline showing who is responsible for what chore in the current and upcoming weeks. Clear "This week / Next week" view so there are no surprises. |
| **Swap requests** | A member can request to swap their turn with another member. The other member gets a notification and can accept or decline. |
| **Completion tracking** | Each chore instance must be marked as done. If not completed by the deadline, it shows as overdue with a visual indicator. |
| **Verification (optional)** | Parents/admins can enable "needs verification" on a chore — it stays in a "pending review" state until an admin confirms it's done properly. |
| **Fairness dashboard** | A simple overview showing how chores are distributed across members: total chores per person, difficulty-weighted workload, completion rate. Helps ensure no one is carrying an unfair load. |
| **Streaks & stats** | Per-member streak counter (consecutive on-time completions). Weekly/monthly completion percentage shown as a progress bar. Motivational, especially for kids. |
| **Chore sets** | Group related chores into sets (e.g., "Kitchen duties" = dishes + wipe counters + take out trash). Entire sets can rotate as a unit. |
| **Skip & exceptions** | Mark a member as "away" for a period (vacation, sick) — rotation automatically skips them and adjusts. |

### 2.5 Grocery / Shopping List

A shared, real-time list that anyone can add to, and someone can check off items at the store.

| Detail | Description |
|---|---|
| **Items** | Name, quantity, unit (optional), category (produce, dairy, bakery, etc.), added by (auto-filled). |
| **Categories** | Auto-grouped so items in the same aisle appear together. Categories are customizable. |
| **Check-off** | Tap to mark purchased. Checked items move to the bottom, grayed out. |
| **Recurring items** | Mark items as "always on the list" — they reappear when the list is cleared. |
| **Multiple lists** | Support for separate lists (Groceries, Hardware Store, Pharmacy, etc.). |
| **Real-time sync** | Changes appear instantly for everyone — important so two people don't buy the same thing. |

### 2.6 Meal Planner

Plan the week's meals and optionally auto-generate a shopping list from them.

| Detail | Description |
|---|---|
| **Planning grid** | 7-day view, with slots for Breakfast, Lunch, Dinner, and Snack. |
| **Recipes** | Simple recipe store: title, ingredients list, instructions, servings, prep/cook time, tags (vegetarian, quick, kid-friendly, etc.). |
| **Drag & drop** | Assign recipes to meal slots by dragging. Or type a freeform meal name if no recipe exists. |
| **Generate shopping list** | Button to push all ingredients from the week's planned meals into the grocery list, de-duplicating and summing quantities. |
| **Favorites** | Star frequently made meals for quick access. |
| **History** | See what was planned in previous weeks to avoid repetition. |

### 2.7 Notes / Bulletin Board

A shared pinboard for important information.

| Detail | Description |
|---|---|
| **Notes** | Title, rich-text body (basic formatting: bold, italic, lists, links), color/label, pinned status, created by. |
| **Pinned notes** | Appear at the top of the board and optionally on the dashboard. |
| **Categories** | Important Info, School, Household, Fun, etc. (customizable). |
| **Search** | Full-text search across all notes. |
| **Attachments** | Optionally attach an image or PDF (e.g., school letter, permission slip). |

### 2.8 Family Hub Display (TV / Kiosk Mode)

A dedicated full-screen view designed to run on a wall-mounted TV, tablet, or spare monitor. No login required — it shows the whole family's day at a glance. Think of it as a digital family notice board that's always on.

| Detail | Description |
|---|---|
| **Access** | Accessible via a special URL (`/hub` or `/display`) — no PIN login needed so the TV browser can auto-load it. Optional config token in the URL to prevent outsiders from viewing if exposed to the internet. |
| **Layout** | A clean, high-contrast multi-column grid optimized for readability from across the room. Large fonts, generous spacing, family member colors used prominently. Auto-adapts to screen aspect ratio (16:9 TV vs. portrait tablet). |
| **Auto-refresh** | Real-time updates via WebSocket — no manual refresh needed. Chore completions, new appointments, and list changes appear live. Auto-advances to the next day at midnight. |
| **Screen wake** | Uses the Screen Wake Lock API to prevent the TV/tablet browser from sleeping. Night dimming on a configurable schedule to reduce brightness in the evening. |

**Panels / Widgets:**

| Panel | Content |
|---|---|
| **Today's Date & Time** | Large clock + date display. Current day prominently shown (e.g., "Wednesday, February 11"). Optional weather widget via Open-Meteo (free, open source, no API key). |
| **Today's Schedule** | Full-family agenda for today, organized as a timeline. Each event shows the member's color + avatar, time, and title. Upcoming events highlighted, past events dimmed. |
| **Chores Overview** | Today's and this week's chores grouped by family member. Shows status: ✅ done, 🔲 pending, ⚠️ overdue. Whose turn it is for each chore is immediately obvious. |
| **Tasks Board** | Each family member's tasks for today shown in their color column. Completed tasks checked off, remaining tasks prominent. |
| **Meals** | What's for breakfast / lunch / dinner today, pulled from the meal planner. |
| **Shopping List** | Current item count and the top items — a visual nudge for whoever is heading to the store. |
| **Pinned Notes** | Any urgent or pinned notes displayed as cards. |
| **Leaderboard** | Family XP leaderboard showing each member's level, XP, and current streak. Highlights the weekly leader. In collaborative mode, shows progress toward the shared family goal instead. |
| **Achievement Feed** | Recent badge unlocks scroll as a ticker — e.g., "Anna unlocked Kitchen Master!" Level-up celebrations appear here too. |
| **Activity Feed** | Scrolling live stream of recent family activity — chore completions, new events, shopping list additions. Auto-updates in real-time. |
| **Upcoming** | A "coming up" strip showing the next 2–3 days of important events and chores so the family can look ahead. |

**Display Customization:**

| Setting | Options |
|---|---|
| **Visible panels** | Admins toggle which panels appear on the hub display in settings. |
| **Panel order & size** | Drag-and-drop panel arrangement. Panels can be set to "large" (e.g., calendar) or "compact" (e.g., shopping list). |
| **Rotation mode** | For smaller screens: cycle between panel groups every N seconds (like a slideshow) instead of showing all at once. |
| **Theme** | Can be set independently from the main app — e.g., always dark mode for the living room TV. |
| **Font size** | Small / Medium / Large / Extra Large — adjustable for room distance. |
| **Multiple hub configs** | Support different display profiles — e.g., a kitchen display emphasizing meals + shopping, vs. a hallway display emphasizing calendar + chores. |

### 2.9 Personal Dashboard (Home Screen)

The landing page when a logged-in member opens the app. A personalized summary — unlike the Hub Display (2.8) which is a shared family-wide view.

| Widget | Content |
|---|---|
| **Today's Calendar** | Compact agenda view of today's events for the whole family. |
| **My Tasks** | The logged-in member's personal tasks for today, with checkboxes. |
| **My Chores** | The logged-in member's chores due this week, with completion status and upcoming rotation preview. |
| **My XP & Level** | Current level, XP progress bar to next level, current streak, and recent badges earned. Points balance for the rewards shop. |
| **Recent Activity** | Compact activity feed showing the latest family actions. |
| **Shopping List Preview** | Item count + the top few items. |
| **Meal of the Day** | What's for lunch/dinner today. |
| **Pinned Notes** | Any notes marked as pinned. |
| **Quick Add** | Floating action button → add event, task, chore, shopping item, or note. |

*The notification bell (2.11) and global search bar (2.13) live in the top navigation bar, visible on every page including the dashboard.*

### 2.10 Rewards & XP System

A gamification layer that turns completing tasks and chores into a rewarding experience. Earn XP, level up, unlock achievements, and redeem rewards set by parents.

**XP & Levels:**

| Detail | Description |
|---|---|
| **XP sources** | Completing a task: earns XP based on priority (low = 5, medium = 10, high = 20). Completing a chore: earns XP based on difficulty (easy = 10, medium = 25, hard = 50). Bonus XP for on-time completion, streaks, and helping others (swap acceptance). |
| **XP multipliers** | Streak multiplier: 7-day streak = 1.5x, 14-day = 2x, 30-day = 3x (configurable). Weekend bonus: optional extra XP for chores done on weekends. |
| **Levels** | XP thresholds define levels (e.g., Level 1 = 0 XP, Level 2 = 100 XP, Level 5 = 1000 XP, etc.). Each level has a fun name or title (configurable by admins — e.g., "Dish Apprentice", "Chore Champion", "Household Legend"). |
| **Level-up animation** | Satisfying visual celebration when leveling up — confetti, sound effect (optional), shown both in the app and on the Hub Display. |
| **XP history** | Each member can see a log of XP earned: what action, when, and how much. Transparent so there are no disputes. |

**Achievements & Badges:**

| Detail | Description |
|---|---|
| **Achievement types** | Milestone-based (e.g., "First Chore Completed", "100 Tasks Done", "30-Day Streak"). Category-based (e.g., "Kitchen Master" — complete 50 kitchen chores). Special (e.g., "Early Bird" — complete all tasks before 9am, "Team Player" — accept 10 swap requests). |
| **Badges** | Each achievement unlocks a visual badge displayed on the member's profile. |
| **Rarity tiers** | Common, Rare, Epic, Legendary — adds excitement and collectibility. |
| **New badge notification** | Shown as a push notification + displayed on the Hub Display when someone unlocks a new badge. |

**Rewards Shop:**

| Detail | Description |
|---|---|
| **Reward currency** | Members can accumulate **points** (separate from XP — XP is for leveling, points are for spending). Points earned alongside XP, or at a configurable ratio (e.g., 1 point per 10 XP). |
| **Reward catalog** | Admins (parents) define available rewards with point costs. Examples: "Pick tonight's movie" (50 pts), "Extra screen time — 30 min" (100 pts), "Skip one chore" (200 pts), "Choose weekend activity" (300 pts), "€10 pocket money" (500 pts). |
| **Redemption flow** | Member browses rewards → redeems → request goes to admin for approval → admin confirms → points deducted. |
| **Reward history** | Full log of redeemed rewards per member. |

**Leaderboard & Stats:**

| Detail | Description |
|---|---|
| **Family leaderboard** | Rankings by XP, level, tasks completed, or current streak. Visible on the Hub Display as a fun competitive element. |
| **Weekly recap** | End-of-week summary: who earned the most XP, longest streak, most chores completed, new badges unlocked. Can display as a card on the Hub Display every Sunday. |
| **Fairness note** | Leaderboard is opt-in per family — some families may prefer a collaborative rather than competitive approach. In collaborative mode, the family has a shared XP pool and works toward collective goals (e.g., "Family reaches 5000 XP = pizza night"). |

**Admin Controls:**

| Detail | Description |
|---|---|
| **XP tuning** | Admins can adjust XP values per task/chore priority and difficulty, multiplier thresholds, and point conversion rates. |
| **Reward management** | Add, edit, remove, and temporarily disable rewards. Set point costs and approval requirements. |
| **Achievement management** | Enable/disable specific achievements. Create custom achievements with custom conditions. |
| **Mode toggle** | Switch between competitive (individual leaderboard) and collaborative (shared family goals) mode. |

### 2.11 In-App Notification Center

Push notifications get dismissed or missed. Every family member needs a centralized inbox inside the app to catch up on what happened.

| Detail | Description |
|---|---|
| **Bell icon** | Persistent bell icon in the top navigation bar with an unread count badge. Visible on every page. |
| **Notification feed** | Dropdown or full-page list of all notifications, newest first. Each notification shows: icon, message, timestamp, and a link to the relevant item. |
| **Notification sources** | Calendar reminders ("Dentist in 30 min"), chore deadlines ("Clean bathroom is due today"), swap requests ("Ben wants to swap *Dishes* with you"), reward approvals ("Your reward *Pick tonight's movie* was approved!"), achievement unlocks ("You earned *Kitchen Master*!"), level-ups, and admin announcements. |
| **Read / unread** | Tap to mark as read. "Mark all as read" button. Unread notifications appear bold. |
| **Push integration** | Each in-app notification also triggers a browser push notification (if the member has push enabled). The in-app feed is the persistent record; push is the real-time alert. |
| **Preferences** | Per-member settings to mute specific notification categories (e.g., "Don't notify me about shopping list changes"). |
| **Auto-cleanup** | Notifications older than 30 days are automatically archived/deleted to keep the feed manageable. |

### 2.12 Activity Feed

A family-wide stream of "what's happening" — answers the question "what did everyone do today?" without checking each module individually.

| Detail | Description |
|---|---|
| **Feed location** | Accessible via a dedicated `/activity` page. Also available as a compact widget on the Personal Dashboard and as a panel on the Hub Display. |
| **Event types** | Task completed ("Anna completed *Pack school bag* ✅"), chore completed ("Ben finished *Clean bathroom* ✅"), event created ("Clara added *Dentist* to calendar"), shopping item added ("Dad added *Milk* to Shopping List"), meal planned ("Mom planned *Pasta Bolognese* for Thursday dinner"), note pinned, achievement unlocked, level-up, reward redeemed. |
| **Member filtering** | Filter the feed by one or more family members. |
| **Date filtering** | "Today", "This week", or custom date range. |
| **Visual design** | Each entry shows the member's avatar + color, action description, and relative timestamp ("5 min ago", "2 hours ago"). Compact and scannable. |
| **Privacy** | All actions are visible to all family members — this is a family transparency tool. No private entries. |
| **Hub Display panel** | A scrolling live feed showing the most recent 10–15 activities, auto-updating in real-time. |

### 2.13 Global Search

One search bar to find anything across the entire app.

| Detail | Description |
|---|---|
| **Access** | Search icon in the top navigation bar + keyboard shortcut (`Ctrl/Cmd + K`) opens a command-palette-style overlay. |
| **Searchable content** | Calendar events (title, description, location), tasks (title, description), chores (title), recipes (title, ingredients, tags), notes (title, body text), shopping items (name), family members (name). |
| **Result grouping** | Results grouped by module: "Calendar (3)", "Recipes (2)", "Notes (1)". Each result shows a preview snippet with the search term highlighted. |
| **Quick actions** | Click a result to navigate directly to it. For common actions, the command palette also supports quick commands like "Add event", "New task", "New note" — typed naturally. |
| **Recency bias** | Recent and upcoming items ranked higher than old ones. |
| **Implementation** | PostgreSQL full-text search (`tsvector` / `tsquery`) — no external search engine needed. Prisma raw queries for the search, with a unified tRPC endpoint that queries all modules and merges results. |

### 2.14 First-Time Setup Wizard

A guided onboarding flow when the app is deployed for the first time. Without this, new users face an empty shell with no idea where to start.

| Detail | Description |
|---|---|
| **Trigger** | Automatically shown on first visit when no Family exists in the database. |
| **Step 1 — Create Family** | Enter family name, choose a family avatar or logo (optional), set default language (EN/DE), choose theme preference. |
| **Step 2 — Add Members** | Add each family member: name, avatar (upload or pick from built-in icons), personal color (color picker), role (admin/member), and PIN. At least one admin required. Can add more members later. |
| **Step 3 — Connect Calendars** | Optional step: each member can connect their external calendars (Google, Apple, Outlook) right away, or skip and do it later in settings. |
| **Step 4 — Set Up Chores** | Guided chore setup: add initial chores with categories, assign rotation pools, set frequency. Offers a "Starter Pack" of common household chores (dishes, vacuuming, laundry, trash, bathroom cleaning, etc.) that can be added with one click and customized. |
| **Step 5 — Configure Rewards** | Optional: set up the XP system — choose competitive vs. collaborative mode, add initial rewards to the shop. Can skip and configure later. |
| **Step 6 — Hub Display** | Optional: configure the TV/kiosk display — select which panels to show, set font size, and get the `/hub` URL to open on the TV. |
| **Completion** | "You're all set!" summary screen with quick links to each module. Confetti animation. The wizard can be re-run from admin settings if needed. |
| **Progressive setup** | The wizard is designed so only Steps 1–2 are required. Everything else can be skipped and configured later — minimizing friction for getting started. |

---

## 3. Technology Stack

### 3.1 Overview

All core technologies are open source. External API integrations (calendar sync, weather) use free tiers of commercial services and are clearly marked.

| Layer | Choice | License | Why |
|---|---|---|---|
| **Frontend** | **Next.js 14+ (App Router)** with React | MIT | Full-stack framework, SSR/SSG for speed, great DX, enormous ecosystem. |
| **Styling** | **Tailwind CSS** + **shadcn/ui** | MIT | Utility-first, highly customizable, shadcn gives polished accessible components. |
| **State / Real-time** | **React Query (TanStack Query)** + **WebSockets (Socket.IO)** | MIT | React Query for data fetching/caching, Socket.IO for real-time updates (shopping list, tasks). |
| **Backend / API** | **tRPC v11** with Next.js App Router integration | MIT | End-to-end TypeScript type safety, no code generation, automatic inference from backend to frontend. |
| **Database** | **PostgreSQL 16** | PostgreSQL (OSI) | Robust relational DB, perfect for structured family data. Built-in full-text search (`tsvector`/`tsquery`) powers Global Search without needing a separate search engine. |
| **ORM** | **Prisma** | Apache 2.0 | Excellent DX, type-safe queries, easy migrations. |
| **Auth** | **Custom PIN-based** (family-internal) + optional **NextAuth.js** for external access | ISC | Keeps it simple for daily use. NextAuth adds OAuth/password if you expose it to the internet. |
| **Calendar Sync** | **tsdav** (CalDAV client) + Google Calendar API ⚠️ + Microsoft Graph API ⚠️ | tsdav: MIT | Apple iCloud & Nextcloud via CalDAV using the fully open-source `tsdav` library. Google & Outlook via their REST APIs (OAuth2) — see cost notes below. |
| **Calendar UI** | **FullCalendar** | MIT | Mature, feature-rich open-source calendar component. Supports month/week/day views, drag-and-drop, and recurrence out of the box. |
| **Background Jobs** | **BullMQ** with Redis | MIT / BSD-3 | Handles periodic calendar sync, chore instance generation, overdue checks, notification cleanup, and `pg_dump` backups. |
| **i18n** | **next-intl** | MIT | Lightweight, App Router-native. Locale files for EN and DE with per-member language preference. |
| **Theming** | **Tailwind `dark:` + next-themes** | MIT | System preference detection with manual toggle. `next-themes` handles SSR-safe theme switching. |
| **Rich Text Editor** | **Tiptap** (open-source core only) | MIT | Basic formatting (bold, italic, lists, links, headings) is fully covered by the free MIT-licensed core. Pro extensions (collaboration, AI, etc.) are paid but **not needed** for this project. |
| **Push Notifications** | **Web Push API** (via PWA service worker) | Web standard (free) | Browser-native notifications for reminders. VAPID keys are free to generate. No external services needed. |
| **File Storage** | **Local filesystem** or **MinIO** (S3-compatible) | AGPL-3.0 | For note attachments, avatars, recipe images. MinIO if you want an S3-like API self-hosted. |
| **Weather** | **Open-Meteo API** | Open source (AGPL) | Free, no API key required, no rate limits for non-commercial use. Fully open-source backend. Used for the optional Hub Display weather widget. |
| **Deployment** | **Docker Compose** | Apache 2.0 | Single `docker-compose up` brings up Next.js app + PostgreSQL + Redis + Caddy. Runs identically on Raspberry Pi or Hetzner VPS. |
| **Reverse Proxy** | **Caddy** | Apache 2.0 | Automatic HTTPS via Let's Encrypt (free). Zero-config. |
| **Recurrence** | **rrule** | BSD (open source) | iCal-compliant recurrence rule parsing for calendar events and recurring tasks/chores. |

⚠️ = Free tier of a commercial API (see section 3.4 for details).

### 3.2 External API Cost & Licensing Notes

| Service | Cost | Notes |
|---|---|---|
| **Google Calendar API** | **Free** (quota: 1M requests/day) | Requires a Google Cloud project (free, no credit card). OAuth2 consent screen setup needed. Not open source, but free for personal use with very generous limits. |
| **Microsoft Graph API** | **Free** (quota: 10,000 requests/10 min) | Requires an Azure AD app registration (free). Not open source, but free for personal use. |
| **Apple iCloud CalDAV** | **Free** | Standard CalDAV protocol — accessed via the open-source `tsdav` library. No API key needed, just the user's Apple ID credentials. |
| **Open-Meteo** | **Free** (no API key, no rate limit) | Fully open-source weather API (AGPL). Self-hostable if desired. No account or registration needed. |
| **Let's Encrypt** | **Free** | Free TLS certificates, auto-renewed by Caddy. |
| **DuckDNS** | **Free** | Free dynamic DNS. Only needed for Raspberry Pi setups with a changing IP. |
| **Hetzner VPS** | **~€5/month** 💰 | Only if you choose VPS over Raspberry Pi. CX22 (2 vCPU, 4 GB RAM). The only recurring cost in the entire stack. |
| **Tailscale** | **Free** (personal: 100 devices, 3 users) | Client is open source (BSD-3). Coordination server is proprietary. For a fully self-hosted open-source alternative, use **Headscale** instead. |

💰 = Paid service. All other items are free.

### 3.3 Project Structure (Monorepo)

```
family-hub/
├── docker-compose.yml
├── .env.example
├── packages/
│   └── db/                    # Prisma schema + migrations + seed
│       ├── prisma/
│       │   ├── schema.prisma
│       │   └── migrations/
│       └── seed.ts
├── src/
│   ├── app/                   # Next.js App Router
│   │   ├── (auth)/            # Login / PIN entry + first-time setup wizard
│   │   ├── (dashboard)/       # Personal dashboard (logged-in)
│   │   ├── hub/               # Family Hub Display (TV/kiosk mode — no auth)
│   │   ├── calendar/          # Calendar module
│   │   ├── tasks/             # Personal tasks module
│   │   ├── chores/            # Chore management & rotation module
│   │   ├── shopping/          # Shopping list module
│   │   ├── meals/             # Meal planner module
│   │   ├── notes/             # Notes module
│   │   ├── rewards/           # XP, levels, achievements, rewards shop
│   │   ├── activity/          # Family activity feed
│   │   ├── notifications/     # Full notification inbox view
│   │   ├── settings/          # Family & member settings
│   │   └── api/               # tRPC router + HTTP handlers
│   ├── components/            # Shared UI components
│   │   ├── ui/                # shadcn/ui primitives
│   │   ├── calendar/
│   │   ├── tasks/
│   │   ├── chores/
│   │   ├── hub/               # Hub Display panels & layout
│   │   ├── shopping/
│   │   ├── meals/
│   │   ├── notes/
│   │   ├── rewards/           # XP bar, badges, leaderboard, rewards shop
│   │   ├── notifications/     # Bell icon, notification feed dropdown
│   │   ├── activity/          # Activity feed, activity item cards
│   │   ├── search/            # Command palette, search results
│   │   └── setup/             # Setup wizard steps
│   ├── lib/                   # Utilities, hooks, helpers
│   │   ├── db.ts              # Prisma client singleton
│   │   ├── auth.ts            # Auth helpers
│   │   ├── socket.ts          # Socket.IO setup
│   │   ├── notifications.ts   # Push notification helpers
│   │   └── trpc/              # tRPC setup
│   │       ├── client.ts      # Client-side tRPC hooks
│   │       ├── server.ts      # Server-side context + router
│   │       └── routers/       # Per-module routers
│   │           ├── family.ts
│   │           ├── calendar.ts
│   │           ├── tasks.ts
│   │           ├── chores.ts
│   │           ├── shopping.ts
│   │           ├── meals.ts
│   │           ├── notes.ts
│   │           ├── rewards.ts     # XP engine, achievements, rewards shop
│   │           ├── notifications.ts  # Notification CRUD, read/unread, preferences
│   │           ├── activity.ts    # Activity feed queries, filtering
│   │           ├── search.ts      # Global search across all modules
│   │           └── hub.ts         # Hub display settings & aggregated data
│   └── styles/
│       └── globals.css
├── locales/                   # i18n translation files (next-intl)
│   ├── en.json
│   └── de.json
├── public/
│   ├── manifest.json          # PWA manifest
│   └── sw.js                  # Service worker
└── README.md
```

### 3.4 Database Schema (Simplified)

```
Family
  ├── id, name, createdAt

FamilyMember
  ├── id, familyId, name, avatar, color, pin (hashed), role (admin|member), locale (en|de)

CalendarEvent
  ├── id, familyId, title, description, location
  ├── startAt, endAt, allDay, recurrenceRule
  ├── category, createdById
  ├── source (local|google|apple|outlook|caldav), externalId (nullable, unique per source)
  ├── externalCalendarId (FK → ExternalCalendar, nullable)
  ├── isReadOnly (bool — true for synced events)
  └── → EventAssignee (many-to-many with FamilyMember)

ExternalCalendarConnection
  ├── id, memberId (FK → FamilyMember)
  ├── provider (google|apple|outlook|caldav)
  ├── accountLabel (e.g., "Anna's Google")
  ├── accessTokenEncrypted, refreshTokenEncrypted, tokenExpiresAt
  ├── caldavUrl (nullable — for CalDAV providers)
  ├── syncEnabled (bool), lastSyncAt, syncIntervalMinutes
  └── status (active|expired|revoked)

ExternalCalendar
  ├── id, connectionId (FK → ExternalCalendarConnection)
  ├── externalCalendarId (provider's ID, e.g., Google calendar ID)
  ├── name (e.g., "Work", "Family", "Kids School")
  ├── color (from provider, nullable)
  ├── syncEnabled (bool — member toggles this per calendar)
  ├── privacyMode (full_details|busy_free_only)
  └── syncDirection (inbound_only|two_way)

Task
  ├── id, familyId, title, description, priority
  ├── recurrenceRule
  ├── createdById
  └── → TaskAssignee (many-to-many with FamilyMember)

TaskCompletion
  ├── id, taskId, memberId, completedAt, date

Chore
  ├── id, familyId, title, description, category
  ├── frequency (daily|weekly|biweekly|monthly), difficulty (easy|medium|hard)
  ├── estimatedMinutes, needsVerification (bool)
  ├── rotationPattern (round_robin|random|weighted)
  ├── createdById
  └── → ChoreAssignee (many-to-many with FamilyMember, includes sortOrder for rotation)

ChoreInstance
  ├── id, choreId, assignedMemberId, periodStart, periodEnd
  ├── status (pending|done|pending_review|overdue|skipped)
  ├── completedAt, verifiedById, verifiedAt

ChoreSwapRequest
  ├── id, choreInstanceId, requesterId, targetMemberId
  ├── status (pending|accepted|declined), respondedAt

ShoppingList
  ├── id, familyId, name

ShoppingItem
  ├── id, listId, name, quantity, unit, category
  ├── addedById, checked, checkedById

MealPlan
  ├── id, familyId, date, slot (breakfast|lunch|dinner|snack)
  ├── recipeId (nullable), freeformName (nullable)

Recipe
  ├── id, familyId, title, instructions, servings, prepTime, cookTime
  ├── tags, image, createdById
  └── → RecipeIngredient (name, quantity, unit)

Note
  ├── id, familyId, title, body (rich text JSON), color, pinned
  ├── category, createdById
  └── → NoteAttachment (filename, path, mimeType)

HubDisplaySettings
  ├── id, familyId
  ├── visiblePanels (JSON array of enabled panel keys)
  ├── layoutMode (auto|custom), columnConfig (JSON, nullable)
  ├── rotationEnabled (bool), rotationIntervalSec
  ├── theme (light|dark|auto), fontScale (small|medium|large|xl)
  ├── nightDimEnabled (bool), nightDimStart, nightDimEnd
  ├── weatherEnabled (bool), weatherLocationLat, weatherLocationLon
  ├── accessToken (nullable — for URL-based auth on public networks)

MemberXpProfile
  ├── id, memberId (FK → FamilyMember)
  ├── totalXp, level, currentStreak, longestStreak
  ├── points (spendable reward currency)

XpEvent
  ├── id, memberId, xpAmount, pointsAmount
  ├── source (task_completion|chore_completion|streak_bonus|swap_bonus|custom)
  ├── sourceId (nullable — FK to task/chore completion)
  ├── multiplier, description, earnedAt

Achievement
  ├── id, familyId, name, description, iconUrl
  ├── condition (JSON — defines trigger logic, e.g., {"type": "streak", "threshold": 30})
  ├── rarity (common|rare|epic|legendary)
  ├── xpReward, pointsReward, isCustom (bool), enabled (bool)

MemberAchievement
  ├── id, memberId, achievementId, unlockedAt

Reward
  ├── id, familyId, title, description, iconUrl
  ├── pointCost, requiresApproval (bool), enabled (bool)
  ├── createdById

RewardRedemption
  ├── id, rewardId, memberId, pointsSpent
  ├── status (pending_approval|approved|declined), requestedAt
  ├── reviewedById, reviewedAt

FamilyGoal (for collaborative mode)
  ├── id, familyId, title, description
  ├── targetXp, currentXp, rewardDescription
  ├── status (active|completed), startedAt, completedAt

XpSettings
  ├── id, familyId
  ├── taskXpValues (JSON — {low: 5, medium: 10, high: 20})
  ├── choreXpValues (JSON — {easy: 10, medium: 25, hard: 50})
  ├── streakMultipliers (JSON — {7: 1.5, 14: 2.0, 30: 3.0})
  ├── pointsPerXpRatio (e.g., 0.1 = 1 point per 10 XP)
  ├── mode (competitive|collaborative)

Notification
  ├── id, memberId (FK → FamilyMember)
  ├── type (calendar_reminder|chore_deadline|swap_request|reward_approval|achievement|level_up|admin_announcement)
  ├── title, message, linkUrl (nullable — deep link to relevant item)
  ├── sourceModule (calendar|tasks|chores|rewards|system)
  ├── sourceId (nullable — FK to related entity)
  ├── read (bool), readAt (nullable)
  ├── pushSent (bool), createdAt

ActivityEvent
  ├── id, familyId, memberId (FK → FamilyMember)
  ├── type (task_completed|chore_completed|event_created|event_updated|shopping_item_added|meal_planned|note_pinned|achievement_unlocked|level_up|reward_redeemed)
  ├── description (human-readable, e.g., "Anna completed Clean bathroom")
  ├── sourceModule (calendar|tasks|chores|shopping|meals|notes|rewards)
  ├── sourceId (nullable — FK to related entity)
  ├── metadata (JSON — extra context, e.g., {xpEarned: 25})
  ├── createdAt
```

---

## 4. Development Phases

### Phase 1 — Foundation & Setup Wizard (Week 1–2)
- Project scaffolding: Next.js, Tailwind, shadcn/ui, Prisma, Docker Compose.
- Dark/light theme toggle with `prefers-color-scheme` detection.
- i18n setup with `next-intl` (English + German locale files).
- Database schema + seed data.
- Family member auth (PIN login, session management).
- **First-time setup wizard**: create family → add members → skip-friendly optional steps.
- Dashboard layout shell with top nav (notification bell + search icon) + responsive sidebar + bottom nav on mobile.
- Global search UI shell (command palette with `Ctrl/Cmd+K`).

### Phase 2 — Calendar Core (Week 3–4)
- Calendar UI (month/week/day views) — using **FullCalendar** (MIT) or building on top of `date-fns`.
- Local event CRUD (create, read, update, delete).
- Recurrence rules (using `rrule` library).
- Color coding per member.
- Conflict detection.
- iCal (.ics) manual import/export.

### Phase 3a — External Calendar Sync: Google (Week 5–6)
- OAuth2 flow for Google Calendar (primary provider — most common).
- ExternalCalendarConnection + ExternalCalendar data model.
- Calendar discovery: fetch member's calendar list after OAuth, show toggle UI.
- Background sync engine: pull events from selected external calendars on a configurable interval.
- Privacy modes: full details vs. busy/free only.
- Visual distinction for synced vs. local events in the calendar UI.
- Token refresh handling + encrypted storage.
- Disconnect flow: revoke token, clean up synced events.
- Webhook/push listener for near-instant sync (Google Calendar push notifications API).

### Phase 3b — External Calendar Sync: Other Providers (Week 7)
- CalDAV support via `tsdav` library (Apple iCloud, Nextcloud, Radicale, generic CalDAV servers).
- Microsoft Outlook/365 via Microsoft Graph API (OAuth2).
- Adapt the sync engine and calendar discovery UI to handle multiple provider types.
- Optional two-way sync: push locally-created events to a designated external calendar.
- Provider-specific edge cases and token management.
- *Note: This phase can be deferred or partially implemented as a stretch goal without blocking other work.*

### Phase 4 — Daily Tasks (Week 8)
- Task CRUD with recurrence.
- "Today's Board" view grouped by member.
- Task completion tracking.
- Task templates.

### Phase 5 — Chore Management & Rotation (Week 9–10)
- Chore CRUD with categories and difficulty levels.
- Rotation engine: round-robin, random, weighted assignment.
- Rotation calendar view (current + upcoming weeks).
- ChoreInstance generation (auto-create instances for each period).
- Completion tracking with optional admin verification.
- Swap request flow (request → notify → accept/decline).
- Fairness dashboard: workload distribution, completion rates, streaks.
- Skip/away handling: mark member as unavailable, auto-adjust rotation.
- Chore sets (group related chores that rotate as a unit).

### Phase 6 — Shopping List (Week 11)
- List CRUD, item CRUD.
- Real-time sync via WebSocket.
- Category grouping + sorting.
- Multiple lists support.

### Phase 7 — Meal Planner (Week 12–13)
- Weekly grid UI with drag-and-drop.
- Recipe CRUD with ingredients.
- "Generate shopping list" feature.
- Favorites + history.

### Phase 8 — Notes (Week 14)
- Note CRUD with rich text editor (Tiptap open-source core, MIT).
- Pinning, categories, search.
- File attachments.

### Phase 9 — Notification Center & Activity Feed (Week 15)
- Notification data model + tRPC router.
- Bell icon with unread count in top nav bar.
- Notification feed (dropdown + full-page inbox view).
- Notification generation hooks: wire into calendar reminders, chore deadlines, swap requests, reward approvals, achievements.
- Read/unread management + "Mark all as read."
- Per-member notification preferences (mute specific categories).
- Auto-cleanup of old notifications (30-day retention).
- Activity feed data model + tRPC router.
- Activity event generation hooks: wire into task/chore completions, event creation, shopping additions, meal planning, note pinning.
- `/activity` page with member and date filtering.
- Compact activity widget for the Personal Dashboard.
- Push notification integration: trigger browser push alongside in-app notifications.

### Phase 10 — Rewards & XP System (Week 16–17)
- MemberXpProfile setup: XP, level, points, streaks tracked per member.
- XP engine: automatic XP/points award on task and chore completion.
- XP settings admin panel: configure XP values, multipliers, point conversion ratio.
- Streak tracking and multiplier logic.
- Achievement system: define conditions, evaluate on completion events, unlock badges.
- Built-in achievements + admin UI for custom achievements.
- Rewards shop: admin creates rewards with point costs, members browse and redeem.
- Redemption approval flow for parents.
- Leaderboard view (competitive mode) and family goal tracker (collaborative mode).
- Weekly recap generation.
- Level-up animation and badge unlock notifications (integrates with Notification Center).
- XP history log per member (transparency).

### Phase 11 — Global Search (Week 18)
- PostgreSQL full-text search setup (`tsvector` / `tsquery`) across all modules.
- Unified tRPC search endpoint that queries calendar events, tasks, chores, recipes, notes, shopping items, and members.
- Command palette UI (`Ctrl/Cmd+K`) with result grouping by module.
- Search result previews with highlighted terms.
- Quick action commands ("Add event", "New task", etc.) in the palette.
- Recency-biased ranking.

### Phase 12 — Family Hub Display / TV Mode (Week 19)
- `/hub` route with no-auth access (optional token protection).
- Multi-column responsive layout optimized for large screens.
- Real-time updates via WebSocket (schedule, chores, tasks, shopping list, meals, XP, activity).
- Screen Wake Lock API integration.
- All panels: schedule, chores, tasks, meals, shopping, notes, leaderboard, achievement feed, activity feed, upcoming.
- Panel toggle settings (admin configures which panels appear).
- Rotation mode for smaller screens.
- Independent theme + font size settings.
- Multiple hub display profiles (kitchen vs. hallway).
- Optional weather widget (Open-Meteo — free, open source, no API key).
- Night dimming schedule.

### Phase 13 — Polish & PWA (Week 20–21)
- PWA setup: manifest, service worker, offline support.
- Push notifications for calendar reminders, chore deadlines, and all notification types.
- Responsive design audit (phone, tablet, desktop, TV).
- Performance optimization (lazy loading, code splitting, image optimization).
- Accessibility audit: keyboard navigation, screen reader labels, color contrast, focus indicators.
- End-to-end testing + bug fixes.
- Setup wizard refinement based on first-run testing.
- Documentation + automated `pg_dump` backup cron job.

---

## 5. Hosting & Deployment

Two deployment targets — pick whichever suits your setup at the time:

| Option | Setup | Cost | Notes |
|---|---|---|---|
| **Raspberry Pi (home)** | Docker Compose + Caddy + Tailscale (or Headscale) | **Free** | Zero monthly cost, LAN-fast. Tailscale (free personal tier) or Headscale (fully self-hosted open-source alternative) for secure remote access without opening ports. Use DuckDNS (free) or Tailscale MagicDNS for a friendly hostname. |
| **Hetzner VPS** | Docker Compose + Caddy with Let's Encrypt | **~€5/month** 💰 | Accessible from anywhere. CX22 (2 vCPU, 4 GB RAM — plenty for a family app). Caddy handles automatic HTTPS. This is the **only recurring cost** in the entire stack. |

Both options use the same `docker-compose.yml` — the app is fully portable between them. Start on the Pi, migrate to Hetzner if you need more reliability or remote access, or vice versa.

**Backup strategy:** Automated `pg_dump` via a daily cron job inside the Docker setup. Dumps saved to a local directory (mounted volume). Simple, reliable, and easy to restore from.

**Docker Compose services:**

| Service | Image | Purpose |
|---|---|---|
| `app` | Custom (Next.js) | The Family Hub application |
| `db` | `postgres:16-alpine` | PostgreSQL database |
| `redis` | `redis:7-alpine` | BullMQ job queue (calendar sync, chore generation, overdue checks) |
| `caddy` | `caddy:2-alpine` | Reverse proxy + automatic HTTPS |

---

## 6. Finalized Decisions

| Question | Decision | Notes |
|---|---|---|
| **API approach** | tRPC v11 | Full end-to-end type safety. Routers organized per module (calendar, tasks, chores, shopping, meals, notes, rewards, notifications, activity, search, hub). |
| **Notifications** | In-app center + browser push | Notification Center (bell icon + inbox) is the persistent record. Browser push (Web Push API via PWA) provides real-time alerts. |
| **Design priority** | Equal mobile + desktop | Responsive-first design with Tailwind breakpoints. Touch-friendly targets (min 44px), but full desktop layouts for calendar and meal planner. |
| **Rich text for notes** | Tiptap (open-source core) | MIT license. Basic formatting (bold, italic, lists, links, headings) is fully free. Paid "Pro" extensions exist but are not needed. |
| **Multi-family support** | No (single family) | Simplifies auth and data model. Can be added later if needed. |
| **Color theme** | Light + Dark with system toggle | Uses Tailwind's `dark:` variant + `prefers-color-scheme` media query. Manual override toggle in settings. |
| **Language** | English + German (i18n) | Use `next-intl` for internationalization. All UI strings externalized into locale files (`en.json`, `de.json`). Family-level default language setting + per-member override. |
| **Search** | PostgreSQL full-text search | Built-in `tsvector`/`tsquery` — no external engine needed. Command palette UI with `Ctrl/Cmd+K`. |
| **Onboarding** | First-time setup wizard | Guided 6-step flow (create family → add members → connect calendars → set up chores → configure rewards → hub display). Only steps 1–2 required; rest skippable. |
| **Hosting** | Raspberry Pi (free) or Hetzner VPS (~€5/month 💰) | Same Docker Compose setup for both. Hetzner is the only potential recurring cost. |
| **Backup** | Automated `pg_dump` | Daily cron job, dumps to a mounted local directory. |

---

## 7. Summary

| | |
|---|---|
| **Modules** | 14 (Profiles, Calendar, Tasks, Chores, Shopping, Meals, Notes, Hub Display, Dashboard, Rewards/XP, Notifications, Activity Feed, Global Search, Setup Wizard) |
| **Tech stack** | Next.js + tRPC + Prisma + PostgreSQL + Socket.IO + Redis + Tailwind/shadcn — all open source (MIT / Apache 2.0 / BSD) |
| **Timeline** | 13 phases across ~21 weeks |
| **Deployment** | Docker Compose on Raspberry Pi (free) or Hetzner VPS (~€5/month) |
| **Platforms** | PWA — works on phone, tablet, desktop, and TV |
| **Licensing** | 100% open-source core. Only external API free tiers (Google Calendar, Microsoft Graph) and optional Hetzner VPS are non-open-source dependencies. |
| **Recurring cost** | €0 (Raspberry Pi) or ~€5/month (Hetzner VPS) — nothing else |

This plan is finalized and ready for development. Phase 1 starts with project scaffolding, the setup wizard, and the app shell.
