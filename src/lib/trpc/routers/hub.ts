import { TRPCError } from "@trpc/server";
import { router, publicProcedure, adminProcedure } from "../init";
import { db } from "@/lib/db";
import { randomUUID } from "crypto";
import {
  getHubDataInput,
  updateHubSettingsInput,
  type PanelKey,
  type HubSettings,
} from "./hub.schemas";

// ─── Helpers ────────────────────────────────────────────────────────

async function validateHubToken(token: string) {
  const settings = await db.hubDisplaySettings.findFirst({
    where: { accessToken: token },
  });

  if (!settings) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Invalid hub access token",
    });
  }

  return {
    familyId: settings.familyId,
    settings: { ...settings, visiblePanels: parseVisiblePanels(settings.visiblePanels) } as unknown as HubSettings,
  };
}

/** Prisma Json fields may be double-serialized. Ensure visiblePanels is a real array. */
function parseVisiblePanels(raw: unknown): string[] {
  let val = raw;
  if (typeof val === "string") {
    try { val = JSON.parse(val); } catch { /* ignore */ }
  }
  return Array.isArray(val) ? val : [];
}

/** Recursively walk Tiptap JSON and extract a plain-text preview (max `limit` chars). */
function extractTextPreview(body: unknown, limit = 200): string {
  if (!body || typeof body !== "object") return "";
  const parts: string[] = [];

  function walk(node: unknown) {
    if (!node || typeof node !== "object") return;
    const n = node as { type?: string; text?: string; content?: unknown[] };
    if (n.text) {
      parts.push(n.text);
      return;
    }
    if (Array.isArray(n.content)) {
      for (const child of n.content) {
        walk(child);
      }
      if (n.type && n.type !== "doc") parts.push(" ");
    }
  }

  walk(body);
  const joined = parts.join("").replace(/\s+/g, " ").trim();
  return joined.length > limit ? joined.slice(0, limit) + "..." : joined;
}

function todayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function todayDate() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

// ─── Panel data fetchers ────────────────────────────────────────────

async function fetchSchedule(familyId: string) {
  const { start, end } = todayRange();

  const events = await db.calendarEvent.findMany({
    where: {
      familyId,
      startAt: { gte: start, lt: end },
    },
    include: {
      assignees: {
        include: {
          member: { select: { id: true, name: true, color: true } },
        },
      },
    },
    orderBy: { startAt: "asc" },
    take: 30,
  });

  return events.map((e) => ({
    id: e.id,
    title: e.title,
    startAt: e.startAt,
    endAt: e.endAt,
    allDay: e.allDay,
    category: e.category,
    location: e.location,
    assignees: e.assignees.map((a) => a.member),
  }));
}

async function fetchChores(familyId: string) {
  const today = todayDate();

  const instances = await db.choreInstance.findMany({
    where: {
      chore: { familyId },
      periodStart: { lte: today },
      periodEnd: { gte: today },
    },
    include: {
      chore: { select: { id: true, title: true, category: true } },
      assignedMember: { select: { id: true, name: true, color: true } },
    },
    orderBy: [{ status: "asc" }, { chore: { title: "asc" } }],
    take: 50,
  });

  return instances.map((i) => ({
    id: i.id,
    choreTitle: i.chore.title,
    category: i.chore.category,
    status: i.status,
    completedAt: i.completedAt,
    member: i.assignedMember,
  }));
}

async function fetchTasks(familyId: string) {
  const today = todayDate();

  // Get tasks with their assignees and today's completions
  const tasks = await db.task.findMany({
    where: { familyId },
    include: {
      assignees: {
        include: {
          member: { select: { id: true, name: true, color: true } },
        },
      },
      completions: {
        where: { date: today },
      },
    },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    take: 50,
  });

  return tasks.map((t) => ({
    id: t.id,
    title: t.title,
    priority: t.priority,
    assignees: t.assignees.map((a) => a.member),
    completions: t.completions.map((c) => ({
      memberId: c.memberId,
      completedAt: c.completedAt,
    })),
  }));
}

async function fetchMeals(familyId: string) {
  const today = todayDate();

  const meals = await db.mealPlan.findMany({
    where: { familyId, date: today },
    include: {
      recipe: { select: { id: true, title: true } },
    },
    orderBy: { slot: "asc" },
  });

  return meals.map((m) => ({
    id: m.id,
    slot: m.slot,
    recipeName: m.recipe?.title ?? null,
    freeformName: m.freeformName,
  }));
}

async function fetchShopping(familyId: string) {
  const list = await db.shoppingList.findFirst({
    where: { familyId },
    include: {
      items: {
        where: { checked: false },
        orderBy: [{ category: "asc" }, { createdAt: "asc" }],
        take: 30,
      },
    },
  });

  if (!list) return { items: [], totalUnchecked: 0 };

  const totalUnchecked = await db.shoppingItem.count({
    where: { listId: list.id, checked: false },
  });

  return {
    items: list.items.map((i) => ({
      id: i.id,
      name: i.name,
      quantity: i.quantity,
      unit: i.unit,
      category: i.category,
    })),
    totalUnchecked,
  };
}

async function fetchNotes(familyId: string) {
  const notes = await db.note.findMany({
    where: { familyId, pinned: true },
    select: {
      id: true,
      title: true,
      body: true,
      color: true,
      category: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 6,
  });

  return notes.map((n) => ({
    id: n.id,
    title: n.title,
    bodyPreview: n.body
      ? typeof n.body === "string"
        ? n.body.slice(0, 200)
        : extractTextPreview(n.body, 200) || null
      : null,
    color: n.color,
    category: n.category,
  }));
}

async function fetchLeaderboard(familyId: string) {
  const profiles = await db.memberXpProfile.findMany({
    where: { member: { familyId } },
    include: {
      member: { select: { id: true, name: true, color: true } },
    },
    orderBy: { totalXp: "desc" },
  });

  return profiles.map((p) => ({
    memberId: p.member.id,
    name: p.member.name,
    color: p.member.color,
    totalXp: p.totalXp,
    level: p.level,
    currentStreak: p.currentStreak,
    points: p.points,
  }));
}

async function fetchAchievements(familyId: string) {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const recent = await db.memberAchievement.findMany({
    where: {
      achievement: { familyId },
      unlockedAt: { gte: sevenDaysAgo },
    },
    include: {
      member: { select: { id: true, name: true, color: true } },
      achievement: {
        select: { id: true, name: true, rarity: true, description: true },
      },
    },
    orderBy: { unlockedAt: "desc" },
    take: 20,
  });

  return recent.map((r) => ({
    id: r.id,
    memberName: r.member.name,
    memberColor: r.member.color,
    achievementName: r.achievement.name,
    rarity: r.achievement.rarity,
    description: r.achievement.description,
    unlockedAt: r.unlockedAt,
  }));
}

async function fetchActivity(familyId: string) {
  const events = await db.activityEvent.findMany({
    where: { familyId },
    include: {
      member: { select: { id: true, name: true, color: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return events.map((e) => ({
    id: e.id,
    type: e.type,
    description: e.description,
    memberName: e.member.name,
    memberColor: e.member.color,
    createdAt: e.createdAt,
  }));
}

async function fetchUpcoming(familyId: string) {
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const dayAfter3 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 4);

  const events = await db.calendarEvent.findMany({
    where: {
      familyId,
      startAt: { gte: tomorrow, lt: dayAfter3 },
    },
    include: {
      assignees: {
        include: {
          member: { select: { id: true, name: true, color: true } },
        },
      },
    },
    orderBy: { startAt: "asc" },
    take: 30,
  });

  // Group by date
  const grouped: Record<string, typeof events> = {};
  for (const event of events) {
    const dateKey = event.startAt.toISOString().split("T")[0];
    if (!grouped[dateKey]) grouped[dateKey] = [];
    grouped[dateKey].push(event);
  }

  return Object.entries(grouped).map(([date, dayEvents]) => ({
    date,
    events: dayEvents.map((e) => ({
      id: e.id,
      title: e.title,
      startAt: e.startAt,
      endAt: e.endAt,
      allDay: e.allDay,
      assignees: e.assignees.map((a) => a.member),
    })),
  }));
}

// ─── Panel fetcher map ──────────────────────────────────────────────

const PANEL_FETCHERS: Record<
  PanelKey,
  (familyId: string) => Promise<unknown>
> = {
  clock: async () => null, // Clock is client-side only
  schedule: fetchSchedule,
  chores: fetchChores,
  tasks: fetchTasks,
  meals: fetchMeals,
  shopping: fetchShopping,
  notes: fetchNotes,
  leaderboard: fetchLeaderboard,
  achievements: fetchAchievements,
  activity: fetchActivity,
  upcoming: fetchUpcoming,
};

// ─── Router ─────────────────────────────────────────────────────────

export const hubRouter = router({
  // ─── Admin: Get settings ──────────────────────────────────────────
  getSettings: adminProcedure.query(async ({ ctx }) => {
    let settings = await db.hubDisplaySettings.findUnique({
      where: { familyId: ctx.session.familyId },
    });

    if (!settings) {
      settings = await db.hubDisplaySettings.create({
        data: { familyId: ctx.session.familyId },
      });
    }

    return { ...settings, visiblePanels: parseVisiblePanels(settings.visiblePanels) } as unknown as HubSettings;
  }),

  // ─── Admin: Update settings ───────────────────────────────────────
  updateSettings: adminProcedure
    .input(updateHubSettingsInput)
    .mutation(async ({ ctx, input }) => {
      const settings = await db.hubDisplaySettings.upsert({
        where: { familyId: ctx.session.familyId },
        create: {
          familyId: ctx.session.familyId,
          ...input,
        },
        update: input,
      });

      return { ...settings, visiblePanels: parseVisiblePanels(settings.visiblePanels) } as unknown as HubSettings;
    }),

  // ─── Admin: Generate access token ────────────────────────────────
  generateToken: adminProcedure.mutation(async ({ ctx }) => {
    const token = randomUUID();

    await db.hubDisplaySettings.upsert({
      where: { familyId: ctx.session.familyId },
      create: {
        familyId: ctx.session.familyId,
        accessToken: token,
      },
      update: { accessToken: token },
    });

    return { token };
  }),

  // ─── Admin: Revoke access token ──────────────────────────────────
  revokeToken: adminProcedure.mutation(async ({ ctx }) => {
    await db.hubDisplaySettings.update({
      where: { familyId: ctx.session.familyId },
      data: { accessToken: null },
    });

    return { success: true };
  }),

  // ─── Public: Get hub data ─────────────────────────────────────────
  getData: publicProcedure
    .input(getHubDataInput)
    .query(async ({ input }) => {
      const { familyId, settings } = await validateHubToken(input.token);

      // Fetch only requested panels in parallel
      const panelEntries = await Promise.all(
        input.panels.map(async (panel) => {
          const fetcher = PANEL_FETCHERS[panel];
          const data = await fetcher(familyId);
          return [panel, data] as const;
        }),
      );

      const panels: Record<string, unknown> = {};
      for (const [key, data] of panelEntries) {
        panels[key] = data;
      }

      return {
        settings: {
          visiblePanels: parseVisiblePanels(settings.visiblePanels),
          layoutMode: settings.layoutMode,
          rotationEnabled: settings.rotationEnabled,
          rotationIntervalSec: settings.rotationIntervalSec,
          theme: settings.theme,
          fontScale: settings.fontScale,
          nightDimEnabled: settings.nightDimEnabled,
          nightDimStart: settings.nightDimStart,
          nightDimEnd: settings.nightDimEnd,
          weatherEnabled: settings.weatherEnabled,
          weatherLocationLat: settings.weatherLocationLat,
          weatherLocationLon: settings.weatherLocationLon,
        },
        panels,
      };
    }),
});
