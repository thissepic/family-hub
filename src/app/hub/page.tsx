"use client";

import { useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { PANEL_KEYS, type PanelKey } from "@/lib/trpc/routers/hub.schemas";
import { ClockPanel } from "@/components/hub/panels/clock-panel";
import { SchedulePanel } from "@/components/hub/panels/schedule-panel";
import { ChoresPanel } from "@/components/hub/panels/chores-panel";
import { TasksPanel } from "@/components/hub/panels/tasks-panel";
import { MealsPanel } from "@/components/hub/panels/meals-panel";
import { ShoppingPanel } from "@/components/hub/panels/shopping-panel";
import { NotesPanel } from "@/components/hub/panels/notes-panel";
import { LeaderboardPanel } from "@/components/hub/panels/leaderboard-panel";
import { AchievementPanel } from "@/components/hub/panels/achievement-panel";
import { ActivityPanel } from "@/components/hub/panels/activity-panel";
import { UpcomingPanel } from "@/components/hub/panels/upcoming-panel";
import { NightDimmer } from "@/components/hub/night-dimmer";
import { RotationController } from "@/components/hub/rotation-controller";
import { Loader2, AlertTriangle } from "lucide-react";

const FONT_SCALE_CLASSES: Record<string, string> = {
  SMALL: "text-sm",
  MEDIUM: "text-base",
  LARGE: "text-lg",
  XL: "text-xl",
};

const PANELS_PER_PAGE = 6;

export default function HubDisplayPage() {
  const t = useTranslations("hub");
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const trpc = useTRPC();

  // Fetch hub data with polling
  const {
    data: hubData,
    isLoading,
    error,
  } = useQuery({
    ...trpc.hub.getData.queryOptions({
      token: token ?? "",
      panels: [...PANEL_KEYS],
    }),
    enabled: !!token,
    refetchInterval: 30_000,
    retry: 3,
    retryDelay: 5_000,
  });

  // Request screen wake lock
  useEffect(() => {
    let wakeLock: WakeLockSentinel | null = null;

    async function requestWakeLock() {
      try {
        if ("wakeLock" in navigator) {
          wakeLock = await navigator.wakeLock.request("screen");
        }
      } catch {
        // Wake lock not supported or denied
      }
    }

    requestWakeLock();

    // Re-acquire on visibility change
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        requestWakeLock();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      wakeLock?.release();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  // Refresh at midnight
  useEffect(() => {
    function msUntilMidnight() {
      const now = new Date();
      const midnight = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1
      );
      return midnight.getTime() - now.getTime();
    }

    const timer = setTimeout(() => {
      window.location.reload();
    }, msUntilMidnight());

    return () => clearTimeout(timer);
  }, []);

  const settings = hubData?.settings;
  const panels = hubData?.panels as Record<string, unknown> | undefined;

  // Determine visible panels (excluding clock which is always shown separately)
  const visiblePanels = useMemo(() => {
    let raw = settings?.visiblePanels;
    // Prisma Json field may return a double-serialized string — parse it
    if (typeof raw === "string") {
      try { raw = JSON.parse(raw); } catch { /* ignore */ }
    }
    const arr = Array.isArray(raw) ? raw : [];
    return (arr as PanelKey[]).filter((p) => p !== "clock");
  }, [settings?.visiblePanels]);

  // Theme class
  const themeClass = useMemo(() => {
    if (!settings?.theme) return "dark";
    if (settings.theme === "AUTO") {
      return typeof window !== "undefined" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }
    return settings.theme === "DARK" ? "dark" : "light";
  }, [settings?.theme]);

  // Apply theme to html element
  useEffect(() => {
    document.documentElement.classList.remove("dark", "light");
    document.documentElement.classList.add(themeClass);
  }, [themeClass]);

  // No token
  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto" />
          <p className="text-lg text-muted-foreground">{t("invalidToken")}</p>
        </div>
      </div>
    );
  }

  // Loading
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Error
  if (error || !hubData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
          <p className="text-lg text-muted-foreground">
            {t("connectionError")}
          </p>
          <p className="text-sm text-muted-foreground">{t("reconnecting")}</p>
        </div>
      </div>
    );
  }

  const fontClass = FONT_SCALE_CLASSES[settings?.fontScale ?? "MEDIUM"];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function renderPanel(key: PanelKey) {
    const panelData = panels?.[key];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = panelData as any;

    switch (key) {
      case "schedule":
        return <SchedulePanel key={key} data={d ?? []} />;
      case "chores":
        return <ChoresPanel key={key} data={d ?? []} />;
      case "tasks":
        return <TasksPanel key={key} data={d ?? []} />;
      case "meals":
        return <MealsPanel key={key} data={d ?? []} />;
      case "shopping":
        return (
          <ShoppingPanel
            key={key}
            data={d ?? { items: [], totalUnchecked: 0 }}
          />
        );
      case "notes":
        return <NotesPanel key={key} data={d ?? []} />;
      case "leaderboard":
        return <LeaderboardPanel key={key} data={d ?? []} />;
      case "achievements":
        return <AchievementPanel key={key} data={d ?? []} />;
      case "activity":
        return <ActivityPanel key={key} data={d ?? []} />;
      case "upcoming":
        return <UpcomingPanel key={key} data={d ?? []} />;
      default:
        return null;
    }
  }

  const shouldRotate =
    settings?.rotationEnabled && visiblePanels.length > PANELS_PER_PAGE;
  const totalPages = Math.ceil(visiblePanels.length / PANELS_PER_PAGE);

  return (
    <div className={`min-h-screen bg-background p-4 md:p-6 ${fontClass}`}>
      {/* Clock — always visible at top */}
      <ClockPanel
        weatherEnabled={settings?.weatherEnabled}
        weatherLat={settings?.weatherLocationLat}
        weatherLon={settings?.weatherLocationLon}
      />

      {/* Panels grid with optional rotation */}
      {shouldRotate ? (
        <RotationController
          enabled={true}
          intervalSec={settings?.rotationIntervalSec ?? 30}
          totalPages={totalPages}
        >
          {(currentPage) => {
            const start = currentPage * PANELS_PER_PAGE;
            const pagePanels = visiblePanels.slice(
              start,
              start + PANELS_PER_PAGE
            );
            return (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {pagePanels.map((key) => renderPanel(key))}
              </div>
            );
          }}
        </RotationController>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {visiblePanels.map((key) => renderPanel(key))}
        </div>
      )}

      {/* Night dimmer overlay */}
      <NightDimmer
        enabled={settings?.nightDimEnabled ?? false}
        startTime={settings?.nightDimStart ?? null}
        endTime={settings?.nightDimEnd ?? null}
      />
    </div>
  );
}
