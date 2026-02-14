"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "sonner";
import { Settings } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export function XpSettingsPanel() {
  const t = useTranslations("rewards");
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { data: settings } = useQuery(
    trpc.rewards.getSettings.queryOptions()
  );

  const [taskLow, setTaskLow] = useState(5);
  const [taskMed, setTaskMed] = useState(10);
  const [taskHigh, setTaskHigh] = useState(20);
  const [choreEasy, setChoreEasy] = useState(10);
  const [choreMed, setChoreMed] = useState(25);
  const [choreHard, setChoreHard] = useState(50);
  const [streak7, setStreak7] = useState(1.5);
  const [streak14, setStreak14] = useState(2.0);
  const [streak30, setStreak30] = useState(3.0);
  const [pointsRatio, setPointsRatio] = useState(0.1);
  const [isCollaborative, setIsCollaborative] = useState(false);

  useEffect(() => {
    if (settings) {
      const taskXp = settings.taskXpValues as Record<string, number>;
      const choreXp = settings.choreXpValues as Record<string, number>;
      const streaks = settings.streakMultipliers as Record<string, number>;

      setTaskLow(taskXp.LOW ?? 5);
      setTaskMed(taskXp.MEDIUM ?? 10);
      setTaskHigh(taskXp.HIGH ?? 20);
      setChoreEasy(choreXp.EASY ?? 10);
      setChoreMed(choreXp.MEDIUM ?? 25);
      setChoreHard(choreXp.HARD ?? 50);
      setStreak7(streaks["7"] ?? 1.5);
      setStreak14(streaks["14"] ?? 2.0);
      setStreak30(streaks["30"] ?? 3.0);
      setPointsRatio(settings.pointsPerXpRatio);
      setIsCollaborative(settings.mode === "COLLABORATIVE");
    }
  }, [settings]);

  const updateMutation = useMutation(
    trpc.rewards.updateSettings.mutationOptions({
      onSuccess: () => {
        toast.success(t("settingsSaved"));
        queryClient.invalidateQueries({ queryKey: [["rewards"]] });
      },
    })
  );

  const handleSave = () => {
    updateMutation.mutate({
      taskXpValues: { LOW: taskLow, MEDIUM: taskMed, HIGH: taskHigh },
      choreXpValues: { EASY: choreEasy, MEDIUM: choreMed, HARD: choreHard },
      streakMultipliers: {
        "7": streak7,
        "14": streak14,
        "30": streak30,
      },
      pointsPerXpRatio: pointsRatio,
      mode: isCollaborative ? "COLLABORATIVE" : "COMPETITIVE",
    });
  };

  if (!settings) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Settings className="h-4 w-4" />
          {t("xpSettings")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Task XP */}
        <div>
          <Label className="text-xs font-semibold">{t("taskXpValues")}</Label>
          <div className="grid grid-cols-3 gap-2 mt-1">
            <div>
              <Label className="text-[10px] text-muted-foreground">
                {t("low")}
              </Label>
              <Input
                type="number"
                min={0}
                value={taskLow}
                onChange={(e) => setTaskLow(Number(e.target.value))}
                className="h-8"
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">
                {t("medium")}
              </Label>
              <Input
                type="number"
                min={0}
                value={taskMed}
                onChange={(e) => setTaskMed(Number(e.target.value))}
                className="h-8"
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">
                {t("high")}
              </Label>
              <Input
                type="number"
                min={0}
                value={taskHigh}
                onChange={(e) => setTaskHigh(Number(e.target.value))}
                className="h-8"
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Chore XP */}
        <div>
          <Label className="text-xs font-semibold">{t("choreXpValues")}</Label>
          <div className="grid grid-cols-3 gap-2 mt-1">
            <div>
              <Label className="text-[10px] text-muted-foreground">
                {t("easy")}
              </Label>
              <Input
                type="number"
                min={0}
                value={choreEasy}
                onChange={(e) => setChoreEasy(Number(e.target.value))}
                className="h-8"
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">
                {t("medium")}
              </Label>
              <Input
                type="number"
                min={0}
                value={choreMed}
                onChange={(e) => setChoreMed(Number(e.target.value))}
                className="h-8"
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">
                {t("hard")}
              </Label>
              <Input
                type="number"
                min={0}
                value={choreHard}
                onChange={(e) => setChoreHard(Number(e.target.value))}
                className="h-8"
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Streak Multipliers */}
        <div>
          <Label className="text-xs font-semibold">
            {t("streakMultipliers")}
          </Label>
          <div className="grid grid-cols-3 gap-2 mt-1">
            <div>
              <Label className="text-[10px] text-muted-foreground">
                {t("days7")}
              </Label>
              <Input
                type="number"
                min={1}
                step={0.1}
                value={streak7}
                onChange={(e) => setStreak7(Number(e.target.value))}
                className="h-8"
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">
                {t("days14")}
              </Label>
              <Input
                type="number"
                min={1}
                step={0.1}
                value={streak14}
                onChange={(e) => setStreak14(Number(e.target.value))}
                className="h-8"
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">
                {t("days30")}
              </Label>
              <Input
                type="number"
                min={1}
                step={0.1}
                value={streak30}
                onChange={(e) => setStreak30(Number(e.target.value))}
                className="h-8"
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Points ratio */}
        <div>
          <Label className="text-xs font-semibold">
            {t("pointsPerXpRatio")}
          </Label>
          <Input
            type="number"
            min={0}
            max={10}
            step={0.01}
            value={pointsRatio}
            onChange={(e) => setPointsRatio(Number(e.target.value))}
            className="h-8 mt-1"
          />
          <p className="text-[10px] text-muted-foreground mt-0.5">
            e.g. 0.1 = 10 XP earns 1 point
          </p>
        </div>

        <Separator />

        {/* Mode toggle */}
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-xs font-semibold">{t("xpMode")}</Label>
            <p className="text-[10px] text-muted-foreground">
              {isCollaborative
                ? t("modeCollaborative")
                : t("modeCompetitive")}
            </p>
          </div>
          <Switch
            checked={isCollaborative}
            onCheckedChange={setIsCollaborative}
          />
        </div>

        <Button
          className="w-full"
          onClick={handleSave}
          disabled={updateMutation.isPending}
        >
          {t("save")}
        </Button>
      </CardContent>
    </Card>
  );
}
