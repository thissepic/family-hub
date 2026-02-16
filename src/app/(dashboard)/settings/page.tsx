"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { User, Settings, Calendar, Bell, Monitor, ShieldCheck } from "lucide-react";
import { Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarSyncSettings } from "@/components/settings/calendar-sync-settings";
import { HubSettingsPanel } from "@/components/hub/hub-settings-panel";
import { NotificationPreferences } from "@/components/settings/notification-preferences";
import { PushSubscriptionSettings } from "@/components/settings/push-subscription-settings";
import { ProfileSettings } from "@/components/settings/profile-settings";
import { FamilySettings } from "@/components/settings/family-settings";
import { SecuritySettings } from "@/components/settings/security-settings";

function SettingsContent() {
  const t = useTranslations("settings");
  const tNav = useTranslations("nav");
  const trpc = useTRPC();
  const searchParams = useSearchParams();

  const { data: session, isLoading: sessionLoading } = useQuery(
    trpc.auth.getSession.queryOptions()
  );
  const isAdmin = session?.role === "ADMIN";

  const adminOnlyTabs = ["family", "security", "display"];
  const rawTab = searchParams.get("tab") ?? "profile";
  const defaultTab =
    !isAdmin && adminOnlyTabs.includes(rawTab) ? "profile" : rawTab;

  if (sessionLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{tNav("settings")}</h1>

      <Tabs defaultValue={defaultTab}>
        <TabsList className="w-full justify-start overflow-x-auto overflow-y-hidden">
          <TabsTrigger value="profile">
            <User className="mr-1.5 h-4 w-4" />
            {t("tabProfile")}
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="family">
              <Settings className="mr-1.5 h-4 w-4" />
              {t("tabFamily")}
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="security">
              <ShieldCheck className="mr-1.5 h-4 w-4" />
              {t("tabSecurity")}
            </TabsTrigger>
          )}
          <TabsTrigger value="calendars">
            <Calendar className="mr-1.5 h-4 w-4" />
            {t("tabCalendars")}
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="mr-1.5 h-4 w-4" />
            {t("tabNotifications")}
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="display">
              <Monitor className="mr-1.5 h-4 w-4" />
              {t("tabDisplay")}
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="profile" className="mt-4">
          <ProfileSettings />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="family" className="mt-4">
            <FamilySettings />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="security" className="mt-4">
            <SecuritySettings />
          </TabsContent>
        )}

        <TabsContent value="calendars" className="mt-4">
          <CalendarSyncSettings />
        </TabsContent>

        <TabsContent value="notifications" className="mt-4 space-y-4">
          <PushSubscriptionSettings />
          <NotificationPreferences />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="display" className="mt-4">
            <HubSettingsPanel />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsContent />
    </Suspense>
  );
}
