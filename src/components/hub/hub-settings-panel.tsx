"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "sonner";
import {
  PANEL_KEYS,
  type PanelKey,
} from "@/lib/trpc/routers/hub.schemas";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Copy,
  RefreshCw,
  Trash2,
  ExternalLink,
  MapPin,
  Loader2,
} from "lucide-react";

const PANEL_LABEL_KEYS: Record<PanelKey, string> = {
  clock: "panelClock",
  schedule: "panelSchedule",
  chores: "panelChores",
  tasks: "panelTasks",
  meals: "panelMeals",
  shopping: "panelShopping",
  notes: "panelNotes",
  leaderboard: "panelLeaderboard",
  achievements: "panelAchievements",
  activity: "panelActivity",
  upcoming: "panelUpcoming",
};

interface HubSettingsPanelProps {
  compact?: boolean; // For setup wizard mode
}

export function HubSettingsPanel({ compact }: HubSettingsPanelProps) {
  const t = useTranslations("hub");
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery(
    trpc.hub.getSettings.queryOptions()
  );

  // Local state for form
  const [visiblePanels, setVisiblePanels] = useState<PanelKey[]>([]);
  const [layoutMode, setLayoutMode] = useState<"AUTO" | "CUSTOM">("AUTO");
  const [rotationEnabled, setRotationEnabled] = useState(false);
  const [rotationIntervalSec, setRotationIntervalSec] = useState(30);
  const [theme, setTheme] = useState<"LIGHT" | "DARK" | "AUTO">("DARK");
  const [fontScale, setFontScale] = useState<
    "SMALL" | "MEDIUM" | "LARGE" | "XL"
  >("MEDIUM");
  const [nightDimEnabled, setNightDimEnabled] = useState(false);
  const [nightDimStart, setNightDimStart] = useState("22:00");
  const [nightDimEnd, setNightDimEnd] = useState("06:00");
  const [weatherEnabled, setWeatherEnabled] = useState(false);
  const [weatherLat, setWeatherLat] = useState<string>("");
  const [weatherLon, setWeatherLon] = useState<string>("");

  // Sync server state to form
  useEffect(() => {
    if (!settings) return;
    setVisiblePanels(Array.isArray(settings.visiblePanels) ? settings.visiblePanels as PanelKey[] : []);
    setLayoutMode(settings.layoutMode);
    setRotationEnabled(settings.rotationEnabled);
    setRotationIntervalSec(settings.rotationIntervalSec);
    setTheme(settings.theme);
    setFontScale(settings.fontScale);
    setNightDimEnabled(settings.nightDimEnabled);
    setNightDimStart(settings.nightDimStart ?? "22:00");
    setNightDimEnd(settings.nightDimEnd ?? "06:00");
    setWeatherEnabled(settings.weatherEnabled);
    setWeatherLat(settings.weatherLocationLat?.toString() ?? "");
    setWeatherLon(settings.weatherLocationLon?.toString() ?? "");
  }, [settings]);

  const updateMutation = useMutation(
    trpc.hub.updateSettings.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.hub.getSettings.queryKey() });
        toast.success(t("settingsSaved"));
      },
    })
  );

  const generateTokenMutation = useMutation(
    trpc.hub.generateToken.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.hub.getSettings.queryKey() });
        toast.success(t("tokenGenerated"));
      },
    })
  );

  const revokeTokenMutation = useMutation(
    trpc.hub.revokeToken.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.hub.getSettings.queryKey() });
        toast.success(t("tokenRevoked"));
      },
    })
  );

  function handleSave() {
    updateMutation.mutate({
      visiblePanels,
      layoutMode,
      rotationEnabled,
      rotationIntervalSec,
      theme,
      fontScale,
      nightDimEnabled,
      nightDimStart,
      nightDimEnd,
      weatherEnabled,
      weatherLocationLat: weatherLat ? parseFloat(weatherLat) : undefined,
      weatherLocationLon: weatherLon ? parseFloat(weatherLon) : undefined,
    });
  }

  function togglePanel(key: PanelKey) {
    setVisiblePanels((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]
    );
  }

  function handleUseMyLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setWeatherLat(pos.coords.latitude.toFixed(4));
        setWeatherLon(pos.coords.longitude.toFixed(4));
      },
      () => {
        // Permission denied or error
      }
    );
  }

  function copyHubUrl() {
    if (!settings?.accessToken) return;
    const url = `${window.location.origin}/hub?token=${settings.accessToken}`;
    navigator.clipboard.writeText(url);
    toast.success(t("copyUrl"));
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hubUrl = settings?.accessToken
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/hub?token=${settings.accessToken}`
    : null;

  return (
    <div className="space-y-6">
      {/* Access Token Section */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <h4 className="font-semibold">{t("accessUrl")}</h4>
          <p className="text-sm text-muted-foreground">
            {t("tokenDescription")}
          </p>

          {hubUrl ? (
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={hubUrl}
                readOnly
                className="font-mono text-xs"
              />
              <Button variant="outline" size="icon" onClick={copyHubUrl}>
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => window.open(hubUrl, "_blank")}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              {t("noToken")}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => generateTokenMutation.mutate()}
              disabled={generateTokenMutation.isPending}
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              {t("generateToken")}
            </Button>
            {settings?.accessToken && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => revokeTokenMutation.mutate()}
                disabled={revokeTokenMutation.isPending}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                {t("revokeToken")}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Visible Panels */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <h4 className="font-semibold">{t("visiblePanels")}</h4>
          <div className="grid grid-cols-2 gap-2">
            {PANEL_KEYS.map((key) => (
              <label
                key={key}
                className="flex items-center gap-2 rounded-lg p-2 hover:bg-accent cursor-pointer"
              >
                <Checkbox
                  checked={visiblePanels.includes(key)}
                  onCheckedChange={() => togglePanel(key)}
                />
                <span className="text-sm">
                  {t(PANEL_LABEL_KEYS[key] as "panelClock")}
                </span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Appearance — skip in compact mode */}
      {!compact && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <h4 className="font-semibold">{t("theme")}</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("theme")}</Label>
                <Select
                  value={theme}
                  onValueChange={(v) =>
                    setTheme(v as "LIGHT" | "DARK" | "AUTO")
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DARK">{t("themeDark")}</SelectItem>
                    <SelectItem value="LIGHT">{t("themeLight")}</SelectItem>
                    <SelectItem value="AUTO">{t("themeAuto")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t("fontScale")}</Label>
                <Select
                  value={fontScale}
                  onValueChange={(v) =>
                    setFontScale(v as "SMALL" | "MEDIUM" | "LARGE" | "XL")
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SMALL">{t("fontSmall")}</SelectItem>
                    <SelectItem value="MEDIUM">{t("fontMedium")}</SelectItem>
                    <SelectItem value="LARGE">{t("fontLarge")}</SelectItem>
                    <SelectItem value="XL">{t("fontXL")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Rotation */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>{t("rotationMode")}</Label>
                <Switch
                  checked={rotationEnabled}
                  onCheckedChange={setRotationEnabled}
                />
              </div>
              {rotationEnabled && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    {t("rotationInterval")}
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={10}
                      max={120}
                      value={rotationIntervalSec}
                      onChange={(e) =>
                        setRotationIntervalSec(parseInt(e.target.value) || 30)
                      }
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">
                      {t("rotationSeconds", { seconds: rotationIntervalSec })}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Night Dimming */}
      {!compact && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold">{t("nightDimming")}</h4>
              <Switch
                checked={nightDimEnabled}
                onCheckedChange={setNightDimEnabled}
              />
            </div>
            {nightDimEnabled && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs">{t("nightDimStart")}</Label>
                  <Input
                    type="time"
                    value={nightDimStart}
                    onChange={(e) => setNightDimStart(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t("nightDimEnd")}</Label>
                  <Input
                    type="time"
                    value={nightDimEnd}
                    onChange={(e) => setNightDimEnd(e.target.value)}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Weather */}
      {!compact && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold">{t("weather")}</h4>
              <Switch
                checked={weatherEnabled}
                onCheckedChange={setWeatherEnabled}
              />
            </div>
            {weatherEnabled && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs">Latitude</Label>
                    <Input
                      type="number"
                      step="0.0001"
                      value={weatherLat}
                      onChange={(e) => setWeatherLat(e.target.value)}
                      placeholder="-90 to 90"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Longitude</Label>
                    <Input
                      type="number"
                      step="0.0001"
                      value={weatherLon}
                      onChange={(e) => setWeatherLon(e.target.value)}
                      placeholder="-180 to 180"
                    />
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleUseMyLocation}
                >
                  <MapPin className="mr-1.5 h-3.5 w-3.5" />
                  {t("weatherSetLocation")}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Save Button */}
      <Button
        onClick={handleSave}
        disabled={updateMutation.isPending}
        className="w-full"
      >
        {updateMutation.isPending && (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        )}
        {t("save")}
      </Button>
    </div>
  );
}
