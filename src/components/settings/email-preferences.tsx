"use client";

import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  ShieldCheck,
  ShieldOff,
  Link2,
  Unlink,
  Mail,
  Info,
} from "lucide-react";

const EMAIL_NOTIFICATION_TYPES = [
  { type: "TWO_FACTOR_ENABLED" as const, icon: ShieldCheck, labelKey: "twoFactorEnabled" },
  { type: "TWO_FACTOR_DISABLED" as const, icon: ShieldOff, labelKey: "twoFactorDisabled" },
  { type: "OAUTH_LINKED" as const, icon: Link2, labelKey: "oauthLinked" },
  { type: "OAUTH_UNLINKED" as const, icon: Unlink, labelKey: "oauthUnlinked" },
  { type: "EMAIL_CHANGE_NOTIFICATION" as const, icon: Mail, labelKey: "emailChangeNotification" },
] as const;

export function EmailPreferences() {
  const t = useTranslations("settings");
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { data: preferences } = useQuery(
    trpc.account.getEmailPreferences.queryOptions()
  );

  const updateMutation = useMutation(
    trpc.account.updateEmailPreference.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [["account", "getEmailPreferences"]] });
      },
      onError: () => {
        toast.error(t("emailPreferenceSaveFailed"));
      },
    })
  );

  const isEnabled = (type: string) => {
    const pref = preferences?.find((p) => p.type === type);
    return pref?.enabled ?? true;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("emailPreferences")}</CardTitle>
        <CardDescription>{t("emailPreferencesDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {EMAIL_NOTIFICATION_TYPES.map(({ type, icon: Icon, labelKey }) => (
          <div
            key={type}
            className="flex items-center justify-between rounded-md border p-3"
          >
            <div className="flex items-center gap-3">
              <Icon className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor={`email-pref-${type}`} className="cursor-pointer font-normal">
                {t(`emailNotificationType_${labelKey}`)}
              </Label>
            </div>
            <Switch
              id={`email-pref-${type}`}
              checked={isEnabled(type)}
              onCheckedChange={(enabled) =>
                updateMutation.mutate({ type, enabled })
              }
              disabled={updateMutation.isPending}
            />
          </div>
        ))}
        <div className="flex items-start gap-2 rounded-md bg-muted/50 p-3">
          <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-sm text-muted-foreground">
            {t("emailAlwaysSentNote")}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
