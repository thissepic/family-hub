# API Reference

Family Hub uses [tRPC 11](https://trpc.io/) for its API layer. All procedures are type-safe from client to server via shared TypeScript types. The API is accessed at `/api/trpc`.

## Authorization

Every procedure uses one of five authorization levels:

| Symbol | Level | Description |
|---|---|---|
| -- | `public` | No authentication required |
| :key: | `user` | User-level session required (email/password or OAuth login completed) |
| :family: | `family` | Family-level session required (user login + family selected) |
| :lock: | `protected` | Full session required (user login + family selected + member profile selected) |
| :shield: | `admin` | Full session with ADMIN role required |

The middleware chain is: `public → user → family → protected → admin`. Each level extends the previous one.

## Routers

Family Hub has **17 tRPC routers** with 120+ procedures.

### account

User account management (login, OAuth, 2FA, session management, email verification, email preferences).

| Procedure | Type | Auth | Description |
|---|---|---|---|
| `login` | mutation | public | Authenticate with email + password. Returns `{ requiresTwoFactor, twoFactorToken }` if 2FA is enabled |
| `verifyTwoFactor` | mutation | public | Verify TOTP code or recovery code using a pending 2FA token |
| `listFamilies` | query | :key: | List families the user belongs to (for family selection after login) |
| `requestPasswordChange` | mutation | :key: | Request a password change (sends verification email with token) |
| `changeEmail` | mutation | :key: | Change the user account email (requires password, sends verification to new email) |
| `activeSessions` | query | :key: | List all active sessions for the user |
| `invalidateSession` | mutation | :key: | Remotely invalidate a specific session |
| `loginAttempts` | query | :key: | View login attempt history |
| `verifyEmail` | mutation | public | Verify email address using a token from verification email |
| `resendVerification` | mutation | :key: | Resend verification email (rate-limited) |
| `requestPasswordReset` | mutation | public | Request a password reset email (always returns success to prevent enumeration) |
| `resetPassword` | mutation | public | Reset password using token from email, invalidates all sessions |
| `setupTwoFactor` | mutation | :key: | Generate TOTP secret and QR code for 2FA setup (requires email verification) |
| `confirmTwoFactor` | mutation | :key: | Verify authenticator code and enable 2FA, returns recovery codes |
| `disableTwoFactor` | mutation | :key: | Disable 2FA (requires valid TOTP code) |
| `regenerateRecoveryCodes` | mutation | :key: | Generate new recovery codes (requires valid TOTP code) |
| `getTwoFactorStatus` | query | :key: | Get 2FA status: enabled, email verified, remaining recovery codes |
| `getLinkedAccounts` | query | :key: | List linked OAuth accounts (Google/Microsoft) |
| `unlinkOAuthAccount` | mutation | :key: | Unlink an OAuth provider (cannot unlink last auth method) |
| `setPassword` | mutation | :key: | Set password for OAuth-only accounts |
| `getEmailPreferences` | query | :key: | Get email notification preferences (2FA changes, OAuth linking, email changes) |
| `updateEmailPreference` | mutation | :key: | Update a specific email notification preference |

### auth

Family/profile selection, switching, and session lifecycle.

| Procedure | Type | Auth | Description |
|---|---|---|---|
| `selectFamily` | mutation | :key: | Select a family and upgrade session to family-level |
| `selectProfile` | mutation | :family: | Verify PIN and upgrade to full session with member identity |
| `switchProfile` | mutation | :family: | Downgrade full session back to family-level (return to profile selection) |
| `switchFamily` | mutation | :key: | Downgrade session back to user-level (return to family selection) |
| `logout` | mutation | public | Clear session cookie and remove active session |
| `getSession` | query | public | Return current session data (userId, familyId, memberId, role) |
| `hasFamily` | query | public | Check if any family exists (used to decide login vs. setup vs. register) |

### family

Family CRUD, user registration, and settings.

| Procedure | Type | Auth | Description |
|---|---|---|---|
| `get` | query | :family: | Get family details with all members |
| `registerUser` | mutation | public | Register a new user account with email + password (rate-limited, sends verification email) |
| `registerUserWithOAuth` | mutation | public | Register a new user account via OAuth (consumes pending OAuth cookie, auto-verifies email) |
| `createFamily` | mutation | :key: | Create a new family and become its admin (user must be logged in) |
| `listFamilies` | query | :key: | List all families the user belongs to |
| `update` | mutation | :shield: | Update family name, locale, theme |
| `deleteFamily` | mutation | :shield: | Delete the entire family and all associated data (requires confirmation) |

### members

Manage family members.

| Procedure | Type | Auth | Description |
|---|---|---|---|
| `list` | query | :lock: | List all members of the family (includes userId for linked status) |
| `update` | mutation | :lock: | Update member profile (members can update self, admins can update anyone) |
| `adminCreate` | mutation | :shield: | Admin-initiated member creation with optional email and automatic XP profile setup |
| `linkProfile` | mutation | :key: | Link the current user account to an existing unlinked member profile |
| `updateRole` | mutation | :shield: | Change member role ADMIN/MEMBER (safeguard: cannot demote last admin) |
| `adminResetPin` | mutation | :shield: | Reset another member's PIN |
| `delete` | mutation | :shield: | Remove a member (safeguard: cannot delete last admin) |
| `changePin` | mutation | :lock: | Change own PIN (requires current PIN verification) |

### invitations

Family invitation management (invite users to join a family).

| Procedure | Type | Auth | Description |
|---|---|---|---|
| `create` | mutation | :shield: | Create an invitation to join the family. Optionally for a specific unlinked profile (`forMemberId`). Sends email if address provided |
| `list` | query | :shield: | List pending/recent invitations for the current family |
| `revoke` | mutation | :shield: | Revoke a pending invitation (marks as EXPIRED) |
| `getByToken` | query | public | Get invitation details by token (for the accept/decline page) |
| `accept` | mutation | :key: | Accept an invitation. Creates a new member or links to existing profile if `forMemberId` is set |
| `decline` | mutation | :key: | Decline an invitation |
| `myPendingInvitations` | query | :key: | List pending invitations for the current user (matched by email, across all families) |

### calendar

Local calendar event CRUD.

| Procedure | Type | Auth | Description |
|---|---|---|---|
| `list` | query | :lock: | List events in date range (expands recurrence rules) |
| `create` | mutation | :lock: | Create a calendar event |
| `update` | mutation | :lock: | Update an event |
| `delete` | mutation | :lock: | Delete an event |
| `listConflicts` | query | :lock: | Find overlapping events for given time range |
| `importIcal` | mutation | :lock: | Import events from iCal (.ics) data |
| `exportIcal` | query | :lock: | Export events as iCal format |
| `getCategories` | query | :lock: | List available event categories |

### calendarSync

External calendar provider management.

| Procedure | Type | Auth | Description |
|---|---|---|---|
| `getGoogleAuthUrl` | query | :lock: | Generate Google OAuth URL |
| `listConnections` | query | :lock: | List all external calendar connections |
| `getConnection` | query | :lock: | Get single connection with calendars |
| `deleteConnection` | mutation | :lock: | Disconnect and delete a connection |
| `updateCalendar` | mutation | :lock: | Toggle sync, privacy mode, sync direction |
| `triggerSync` | mutation | :lock: | Force immediate sync for a connection |
| `refreshCalendarList` | mutation | :lock: | Re-discover calendars from the provider |
| `connectCaldav` | mutation | :lock: | Connect via CalDAV URL + credentials |
| `connectEws` | mutation | :lock: | Connect via Exchange EWS URL + credentials |
| `reconnect` | mutation | :lock: | Re-authorize an expired OAuth connection |

### tasks

Daily task management.

| Procedure | Type | Auth | Description |
|---|---|---|---|
| `list` | query | :lock: | List tasks (with filters for date, member, completion) |
| `create` | mutation | :lock: | Create a task |
| `update` | mutation | :lock: | Update a task |
| `delete` | mutation | :lock: | Delete a task |
| `complete` | mutation | :lock: | Mark task complete for a date (awards XP) |
| `uncomplete` | mutation | :lock: | Undo completion (removes XP) |
| `getHistory` | query | :lock: | Get completion history for a task |
| `listTemplates` | query | :lock: | List saved task templates |

### chores

Chore management, rotation, verification, and swaps.

| Procedure | Type | Auth | Description |
|---|---|---|---|
| `list` | query | :lock: | List all chores with current instances |
| `getById` | query | :lock: | Get single chore with full details |
| `create` | mutation | :shield: | Create a chore with rotation pool |
| `update` | mutation | :shield: | Update chore settings |
| `delete` | mutation | :shield: | Delete a chore |
| `listMyInstances` | query | :lock: | Get current member's assigned instances |
| `completeInstance` | mutation | :lock: | Mark instance done (awards XP) |
| `uncompleteInstance` | mutation | :lock: | Undo completion (removes XP) |
| `verifyInstance` | mutation | :shield: | Verify a completed instance (PENDING_REVIEW -> DONE) |
| `skipInstance` | mutation | :shield: | Skip an instance (no XP) |
| `requestSwap` | mutation | :lock: | Request to swap instance with another member |
| `respondToSwap` | mutation | :lock: | Accept or decline a swap request |
| `mySwapRequests` | query | :lock: | List pending swap requests |
| `fairnessStats` | query | :lock: | Get completion counts per member |
| `listSets` | query | :lock: | List chore sets |
| `createSet` | mutation | :shield: | Create a chore set |
| `updateSet` | mutation | :shield: | Update a chore set |
| `deleteSet` | mutation | :shield: | Delete a chore set |
| `addChoreToSet` | mutation | :shield: | Add a chore to a set |
| `removeChoreFromSet` | mutation | :shield: | Remove a chore from a set |

### shopping

Collaborative shopping lists.

| Procedure | Type | Auth | Description |
|---|---|---|---|
| `list` | query | :lock: | List all shopping lists |
| `listItems` | query | :lock: | List items in a shopping list |
| `addItem` | mutation | :lock: | Add an item (emits Socket.IO event) |
| `updateItem` | mutation | :lock: | Update an item (emits Socket.IO event) |
| `checkItem` | mutation | :lock: | Toggle checked state (emits Socket.IO event) |
| `deleteItem` | mutation | :lock: | Delete an item (emits Socket.IO event) |
| `clearChecked` | mutation | :lock: | Remove all checked items (emits Socket.IO event) |
| `importList` | mutation | :lock: | Import items from text |
| `createList` | mutation | :lock: | Create a new shopping list |
| `deleteList` | mutation | :lock: | Delete a shopping list |

### meals

Meal planning and recipe management.

| Procedure | Type | Auth | Description |
|---|---|---|---|
| `list` | query | :lock: | List meal plans for a date range |
| `plan` | mutation | :lock: | Assign a recipe to a date + slot |
| `unplan` | mutation | :lock: | Remove a meal plan entry |
| `listRecipes` | query | :lock: | List all recipes |
| `createRecipe` | mutation | :lock: | Create a recipe |
| `updateRecipe` | mutation | :lock: | Update a recipe |
| `deleteRecipe` | mutation | :lock: | Delete a recipe |
| `getRecipe` | query | :lock: | Get single recipe with ingredients |
| `generateShoppingList` | mutation | :lock: | Generate shopping items from a date range's meal plans |
| `importRecipe` | mutation | :lock: | Import recipe from URL or text |

### notes

Rich-text notes and bulletin board.

| Procedure | Type | Auth | Description |
|---|---|---|---|
| `list` | query | :lock: | List notes (pinned first) |
| `create` | mutation | :lock: | Create a note |
| `update` | mutation | :lock: | Update a note (title, body, color) |
| `delete` | mutation | :lock: | Delete a note |
| `pin` | mutation | :lock: | Pin a note |
| `unpin` | mutation | :lock: | Unpin a note |
| `addAttachment` | mutation | :lock: | Attach a file to a note |

### rewards

XP, achievements, rewards shop, and family goals.

| Procedure | Type | Auth | Description |
|---|---|---|---|
| `getProfile` | query | :lock: | Get member's XP profile (level, streak, points) |
| `getXpHistory` | query | :lock: | Get paginated XP event history |
| `getLeaderboard` | query | :lock: | Get family leaderboard (sorted by XP) |
| `getSettings` | query | :lock: | Get family XP settings |
| `updateSettings` | mutation | :shield: | Update XP values, multipliers, mode |
| `listRewards` | query | :lock: | List available rewards |
| `createReward` | mutation | :shield: | Create a reward |
| `updateReward` | mutation | :shield: | Update a reward |
| `deleteReward` | mutation | :shield: | Delete a reward |
| `redeem` | mutation | :lock: | Redeem points for a reward |
| `listRedemptions` | query | :lock: | List redemption history |
| `reviewRedemption` | mutation | :shield: | Approve or decline a redemption |
| `listAchievements` | query | :lock: | List all achievements (with unlock status) |
| `createAchievement` | mutation | :shield: | Create a custom achievement |
| `updateAchievement` | mutation | :shield: | Update an achievement |
| `deleteAchievement` | mutation | :shield: | Delete an achievement |
| `listGoals` | query | :lock: | List family goals |
| `createGoal` | mutation | :shield: | Create a family XP goal |
| `updateGoal` | mutation | :shield: | Update a goal |
| `deleteGoal` | mutation | :shield: | Delete a goal |

### notifications

In-app notification management.

| Procedure | Type | Auth | Description |
|---|---|---|---|
| `list` | query | :lock: | List notifications (paginated, newest first) |
| `markAsRead` | mutation | :lock: | Mark a single notification as read |
| `markAllAsRead` | mutation | :lock: | Mark all notifications as read |
| `delete` | mutation | :lock: | Delete a notification |
| `getPreferences` | query | :lock: | Get notification mute settings |
| `updatePreferences` | mutation | :lock: | Mute/unmute notification types |
| `getUnreadCount` | query | :lock: | Get count of unread notifications |

### activity

Family activity feed.

| Procedure | Type | Auth | Description |
|---|---|---|---|
| `list` | query | :lock: | List activity events (paginated, filterable by member/date) |

### search

Full-text search across all modules.

| Procedure | Type | Auth | Description |
|---|---|---|---|
| `search` | query | :lock: | PostgreSQL full-text search across events, tasks, chores, notes, recipes |

### hub

Data aggregation and settings for the hub/kiosk display.

| Procedure | Type | Auth | Description |
|---|---|---|---|
| `getData` | query | public | Fetch aggregated panel data (token-authenticated via query parameter) |
| `getSettings` | query | :shield: | Get hub display settings |
| `updateSettings` | mutation | :shield: | Update hub display configuration |
| `generateToken` | mutation | :shield: | Generate a new access token for hub URL |
| `revokeToken` | mutation | :shield: | Revoke the current access token |

## Client Usage

```typescript
import { useTRPC } from "@/lib/trpc/client";
import { useQuery, useMutation } from "@tanstack/react-query";

function MyComponent() {
  const trpc = useTRPC();

  // Query
  const { data } = useQuery(trpc.tasks.list.queryOptions({ date: "2025-01-15" }));

  // Mutation
  const completeMutation = useMutation(trpc.tasks.complete.mutationOptions());
  completeMutation.mutate({ taskId: "...", date: "2025-01-15" });
}
```

## REST API Routes

In addition to tRPC, the following REST endpoints exist:

| Route | Method | Purpose |
|---|---|---|
| **Calendar Sync OAuth** | | |
| `/api/calendar-sync/google` | GET | Initiate Google Calendar OAuth flow |
| `/api/calendar-sync/google/callback` | GET | Google Calendar OAuth callback |
| `/api/calendar-sync/outlook` | GET | Initiate Microsoft Calendar OAuth flow |
| `/api/calendar-sync/outlook/callback` | GET | Microsoft Calendar OAuth callback |
| **Authentication OAuth** | | |
| `/api/auth/google` | GET | Initiate Google sign-in/register OAuth flow (accepts `?action=link` for account linking) |
| `/api/auth/google/callback` | GET | Google sign-in OAuth callback (login, auto-link, or redirect to registration) |
| `/api/auth/microsoft` | GET | Initiate Microsoft sign-in/register OAuth flow (accepts `?action=link` for account linking) |
| `/api/auth/microsoft/callback` | GET | Microsoft sign-in OAuth callback (login, auto-link, or redirect to registration) |
| **Push Notifications** | | |
| `/api/push/subscribe` | POST | Register a Web Push subscription |
| `/api/push/unsubscribe` | POST | Remove a Web Push subscription |
| **File Uploads** | | |
| `/api/uploads` | POST | Upload a file (returns filename) |
| `/api/uploads/[filename]` | GET | Retrieve an uploaded file |
