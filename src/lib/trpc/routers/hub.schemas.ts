import { z } from "zod/v4";

export const PANEL_KEYS = [
  "clock",
  "schedule",
  "chores",
  "tasks",
  "meals",
  "shopping",
  "notes",
  "leaderboard",
  "achievements",
  "activity",
  "upcoming",
] as const;

export type PanelKey = (typeof PANEL_KEYS)[number];

export const panelKeySchema = z.enum(PANEL_KEYS);

// ─── Public (token-based) ────────────────────────────────────

export const getHubDataInput = z.object({
  token: z.string().min(1),
  panels: z.array(panelKeySchema).min(1).max(PANEL_KEYS.length),
});

// ─── Admin (session-based) ───────────────────────────────────

export const updateHubSettingsInput = z.object({
  visiblePanels: z.array(panelKeySchema).optional(),
  layoutMode: z.enum(["AUTO", "CUSTOM"]).optional(),
  rotationEnabled: z.boolean().optional(),
  rotationIntervalSec: z.number().int().min(10).max(120).optional(),
  theme: z.enum(["LIGHT", "DARK", "AUTO"]).optional(),
  fontScale: z.enum(["SMALL", "MEDIUM", "LARGE", "XL"]).optional(),
  nightDimEnabled: z.boolean().optional(),
  nightDimStart: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  nightDimEnd: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  weatherEnabled: z.boolean().optional(),
  weatherLocationLat: z.number().min(-90).max(90).optional(),
  weatherLocationLon: z.number().min(-180).max(180).optional(),
});

// ─── Hub settings type (returned from DB) ────────────────────

export type HubSettings = {
  id: string;
  familyId: string;
  visiblePanels: PanelKey[];
  layoutMode: "AUTO" | "CUSTOM";
  rotationEnabled: boolean;
  rotationIntervalSec: number;
  theme: "LIGHT" | "DARK" | "AUTO";
  fontScale: "SMALL" | "MEDIUM" | "LARGE" | "XL";
  nightDimEnabled: boolean;
  nightDimStart: string | null;
  nightDimEnd: string | null;
  weatherEnabled: boolean;
  weatherLocationLat: number | null;
  weatherLocationLon: number | null;
  accessToken: string | null;
};
