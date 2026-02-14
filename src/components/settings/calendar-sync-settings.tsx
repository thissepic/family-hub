"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "sonner";
import { Cloud, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConnectionCard } from "./connection-card";
import { CaldavConnectDialog } from "./caldav-connect-dialog";
import { EwsConnectDialog } from "./ews-connect-dialog";

export function CalendarSyncSettings() {
  const t = useTranslations("settings");
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

  const [caldavDialogOpen, setCaldavDialogOpen] = useState(false);
  const [caldavPreset, setCaldavPreset] = useState<"APPLE" | "CALDAV">("APPLE");
  const [ewsDialogOpen, setEwsDialogOpen] = useState(false);

  // Show toast on OAuth redirect
  useEffect(() => {
    const connected = searchParams.get("connected");
    const error = searchParams.get("error");

    if (connected === "google" || connected === "outlook") {
      toast.success(t("connectedSuccessfully"));
      queryClient.invalidateQueries({ queryKey: [["calendarSync"]] });
    }
    if (
      error === "google_auth_failed" ||
      error === "outlook_auth_failed" ||
      error === "outlook_not_configured"
    ) {
      toast.error(t("connectionFailed"));
    }
  }, [searchParams, t, queryClient]);

  const { data: connections, isLoading } = useQuery(
    trpc.calendarSync.listConnections.queryOptions()
  );

  const handleConnectGoogle = async () => {
    try {
      const data = await queryClient.fetchQuery(
        trpc.calendarSync.getGoogleAuthUrl.queryOptions()
      );
      window.location.href = data.url;
    } catch {
      toast.error(t("connectionFailed"));
    }
  };

  const handleConnectOutlook = () => {
    window.location.href = "/api/calendar-sync/outlook";
  };

  const handleConnectApple = () => {
    setCaldavPreset("APPLE");
    setCaldavDialogOpen(true);
  };

  const handleConnectCaldav = () => {
    setCaldavPreset("CALDAV");
    setCaldavDialogOpen(true);
  };

  const handleConnectExchange = () => {
    setEwsDialogOpen(true);
  };

  const hasConnections = connections && connections.length > 0;

  const connectButtons = (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={handleConnectGoogle}>
        <Plus className="mr-1.5 h-4 w-4" />
        {t("connectGoogle")}
      </Button>
      <Button variant="outline" onClick={handleConnectOutlook}>
        <Plus className="mr-1.5 h-4 w-4" />
        {t("connectOutlook")}
      </Button>
      <Button variant="outline" onClick={handleConnectApple}>
        <Plus className="mr-1.5 h-4 w-4" />
        {t("connectApple")}
      </Button>
      <Button variant="outline" onClick={handleConnectCaldav}>
        <Plus className="mr-1.5 h-4 w-4" />
        {t("connectCaldav")}
      </Button>
      <Button variant="outline" onClick={handleConnectExchange}>
        <Plus className="mr-1.5 h-4 w-4" />
        {t("connectExchange")}
      </Button>
    </div>
  );

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium">{t("externalCalendars")}</h3>
            <p className="text-sm text-muted-foreground">
              {t("externalCalendarsDescription")}
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-muted-foreground">{t("loading")}</p>
          </div>
        ) : hasConnections ? (
          <div className="space-y-4">
            {connections.map((conn) => (
              <ConnectionCard
                key={conn.id}
                connection={{
                  ...conn,
                  status: conn.status as "ACTIVE" | "EXPIRED" | "REVOKED",
                  calendars: conn.calendars.map((cal) => ({
                    ...cal,
                    privacyMode: cal.privacyMode as
                      | "FULL_DETAILS"
                      | "BUSY_FREE_ONLY",
                  })),
                }}
              />
            ))}
            {connectButtons}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8">
            <Cloud className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm font-medium">{t("noConnections")}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("noConnectionsDescription")}
            </p>
            <div className="mt-4">
              {connectButtons}
            </div>
          </div>
        )}
      </div>

      <CaldavConnectDialog
        open={caldavDialogOpen}
        onOpenChange={setCaldavDialogOpen}
        defaultProvider={caldavPreset}
      />

      <EwsConnectDialog
        open={ewsDialogOpen}
        onOpenChange={setEwsDialogOpen}
      />
    </>
  );
}
