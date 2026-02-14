# Hub Display (Kiosk Mode)

The Hub Display is a full-screen family dashboard designed for a shared screen (kitchen TV, iPad on the wall, etc.). It shows real-time panels with family data and auto-rotates through them.

Source files: `src/app/hub/`, `src/components/hub/`.

## Access

The hub is accessed at `/hub?token=<access-token>`. It does not require a PIN login, making it suitable for always-on displays.

**Token generation:**
- An admin generates the token via `hub.regenerateToken` in the settings
- The token is stored in `HubDisplaySettings.accessToken`
- The `hub.getData` procedure validates the token

**URL example:** `https://familyhub.example.com/hub?token=abc123def456`

## Panels

The hub displays data through specialized panel components. Each panel receives pre-aggregated data from the `hub.getData` tRPC query.

| Panel Key | Component | Data Shown |
|---|---|---|
| `clock` | ClockPanel | Current time, date, optional weather |
| `schedule` | SchedulePanel | Upcoming calendar events (next 7 days) |
| `chores` | ChoresPanel | Assigned chores for the current period |
| `tasks` | TasksPanel | Members' assigned tasks |
| `meals` | MealsPanel | This week's meal plan (breakfast/lunch/dinner) |
| `shopping` | ShoppingPanel | Active shopping list items with unchecked count |
| `notes` | NotesPanel | Pinned notes |
| `leaderboard` | LeaderboardPanel | Top 5 members by XP this week |
| `achievements` | AchievementPanel | Recently unlocked badges (past 7 days) |
| `activity` | ActivityPanel | Latest 20 family activity events |
| `upcoming` | UpcomingPanel | All deadlines and milestones in next 30 days |

The **clock panel** is always visible at the top of the display. All other panels appear in a responsive grid below.

## Layout

Panels are arranged in a responsive CSS grid:

| Viewport | Columns |
|---|---|
| Mobile | 1 column |
| Medium (md) | 2 columns |
| Large (xl) | 3 columns |

Maximum **6 panels per page**. If more than 6 panels are visible, rotation kicks in.

## Rotation

When more panels are visible than fit on one page (>6), the display auto-rotates:

```
Page 1: panels[0..5]  →  30 seconds  →  Page 2: panels[6..11]  →  ...  →  back to Page 1
```

**Configuration:**
- `rotationEnabled`: Boolean (must be `true` for rotation)
- `rotationIntervalSec`: Seconds per page (default: 30)

The `RotationController` component manages the timer and calls a render function with the current page index.

## Configuration (HubDisplaySettings)

All settings are stored per family in the `HubDisplaySettings` model and managed via `hub.updateSettings` (admin only).

| Setting | Type | Default | Description |
|---|---|---|---|
| `visiblePanels` | JSON (PanelKey[]) | All panels | Which panels to show |
| `layoutMode` | AUTO / CUSTOM | AUTO | Grid layout mode |
| `columnConfig` | JSON | null | Custom grid configuration |
| `rotationEnabled` | boolean | true | Auto-rotate pages |
| `rotationIntervalSec` | number | 30 | Seconds per rotation page |
| `theme` | LIGHT / DARK / AUTO | DARK | Display theme |
| `fontScale` | SMALL / MEDIUM / LARGE / XL | MEDIUM | Text size |
| `nightDimEnabled` | boolean | false | Enable night dimming overlay |
| `nightDimStart` | string (HH:MM) | 22:00 | Dim start time |
| `nightDimEnd` | string (HH:MM) | 06:00 | Dim end time |
| `weatherEnabled` | boolean | false | Show weather in clock panel |
| `weatherLocationLat` | float | null | Weather location latitude |
| `weatherLocationLon` | float | null | Weather location longitude |

## Font Scaling

| Scale | CSS Class |
|---|---|
| SMALL | `text-sm` |
| MEDIUM | `text-base` |
| LARGE | `text-lg` |
| XL | `text-xl` |

The font scale class is applied to the root container, affecting all panel text.

## Night Dimmer

When enabled, the `NightDimmer` component renders a semi-transparent dark overlay during nighttime hours. This reduces screen brightness for displays in bedrooms or hallways.

- Active between `nightDimStart` and `nightDimEnd`
- Overlay opacity provides gentle dimming without fully hiding content

## Special Behaviors

### Screen Wake Lock

The hub page requests a `navigator.wakeLock` to prevent the screen from sleeping:

```javascript
if ("wakeLock" in navigator) {
  wakeLock = await navigator.wakeLock.request("screen");
}
```

The lock is re-acquired when the page becomes visible again (e.g., after the user switches away and back).

### Midnight Refresh

A timer is set to reload the page at midnight, ensuring the display starts fresh with the new day's data:

```javascript
setTimeout(() => window.location.reload(), msUntilMidnight());
```

### Data Polling

Hub data is refreshed every 30 seconds via TanStack Query's `refetchInterval`. This provides near-real-time updates without WebSocket dependency for the hub display.

Additionally, Socket.IO `hub:data-changed` events can trigger immediate refetches when mutations occur in other parts of the app.

## Data Flow

```
Hub Display Page
  │
  ├── useQuery(hub.getData({ token, panels: [...] }))
  │   └── refetchInterval: 30s
  │
  ▼
hub.getData procedure (server):
  │
  ├── Validate token against HubDisplaySettings.accessToken
  ├── Determine requested panels
  │
  └── For each panel, aggregate data:
      ├── schedule: CalendarEvent (next 7 days, expanded recurrences)
      ├── chores: ChoreInstance (current period, with assignees)
      ├── tasks: Task (with assignees and today's completions)
      ├── meals: MealPlan (this week, with recipe names)
      ├── shopping: ShoppingItem (unchecked items, count)
      ├── notes: Note (pinned only)
      ├── leaderboard: MemberXpProfile (top 5 by weekly XP)
      ├── achievements: MemberAchievement (past 7 days)
      ├── activity: ActivityEvent (latest 20)
      └── upcoming: CalendarEvent + ChoreInstance (next 30 days)
```

## Setting Up a Display

1. Go to **Settings** in the Family Hub app
2. Navigate to the **Hub Display** section
3. Configure visible panels, theme, font scale, and rotation
4. Copy the hub URL with the access token
5. Open the URL on the display device (TV, tablet, etc.)
6. For always-on displays, use the device's kiosk mode or browser fullscreen (F11)
