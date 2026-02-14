"use client";

import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Calendar,
  RotateCcw,
  ArrowLeftRight,
  Gift,
  Award,
  TrendingUp,
  Megaphone,
} from "lucide-react";

const NOTIFICATION_TYPES = [
  { type: "CALENDAR_REMINDER" as const, icon: Calendar, labelKey: "calendarReminder" },
  { type: "CHORE_DEADLINE" as const, icon: RotateCcw, labelKey: "choreDeadline" },
  { type: "SWAP_REQUEST" as const, icon: ArrowLeftRight, labelKey: "swapRequest" },
  { type: "REWARD_APPROVAL" as const, icon: Gift, labelKey: "rewardApproval" },
  { type: "ACHIEVEMENT" as const, icon: Award, labelKey: "achievement" },
  { type: "LEVEL_UP" as const, icon: TrendingUp, labelKey: "levelUp" },
  { type: "ADMIN_ANNOUNCEMENT" as const, icon: Megaphone, labelKey: "adminAnnouncement" },
] as const;

export function NotificationPreferences() {
  const t = useTranslations("settings");
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { data: preferences } = useQuery(
    trpc.notifications.listPreferences.queryOptions()
  );

  const updateMutation = useMutation(
    trpc.notifications.updatePreference.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [["notifications", "listPreferences"]] });
      },
      onError: () => {
        toast.error(t("preferenceSaveFailed"));
      },
    })
  );

  const isMuted = (type: string) =>
    preferences?.find((p) => p.type === type)?.muted ?? false;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("notificationPreferences")}</CardTitle>
        <CardDescription>{t("notificationPreferencesDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {NOTIFICATION_TYPES.map(({ type, icon: Icon, labelKey }) => (
          <div
            key={type}
            className="flex items-center justify-between rounded-md border p-3"
          >
            <div className="flex items-center gap-3">
              <Icon className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor={`pref-${type}`} className="cursor-pointer font-normal">
                {t(`notificationType_${labelKey}`)}
              </Label>
            </div>
            <Switch
              id={`pref-${type}`}
              checked={!isMuted(type)}
              onCheckedChange={(enabled) =>
                updateMutation.mutate({ type, muted: !enabled })
              }
              disabled={updateMutation.isPending}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
