"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { Cloud, RefreshCw, Trash2, Eye, EyeOff, PlugZap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DisconnectDialog } from "./disconnect-dialog";

interface Calendar {
  id: string;
  name: string;
  color: string | null;
  syncEnabled: boolean;
  privacyMode: "FULL_DETAILS" | "BUSY_FREE_ONLY";
  _count: { events: number };
}

interface Connection {
  id: string;
  provider: string;
  accountLabel: string;
  status: "ACTIVE" | "EXPIRED" | "REVOKED";
  lastSyncAt: Date | null;
  syncEnabled: boolean;
  calendars: Calendar[];
}

interface ConnectionCardProps {
  connection: Connection;
}

export function ConnectionCard({ connection }: ConnectionCardProps) {
  const t = useTranslations("settings");
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [showDisconnect, setShowDisconnect] = useState(false);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [["calendarSync"]] });
    queryClient.invalidateQueries({ queryKey: [["calendar"]] });
  };

  const syncMutation = useMutation(
    trpc.calendarSync.triggerSync.mutationOptions({
      onSuccess: () => {
        toast.success(t("syncQueued"));
        invalidate();
      },
      onError: () => toast.error(t("syncFailed")),
    })
  );

  const refreshMutation = useMutation(
    trpc.calendarSync.refreshCalendarList.mutationOptions({
      onSuccess: (data) => {
        toast.success(t("calendarsRefreshed", { count: String(data.added) }));
        invalidate();
      },
      onError: () => toast.error(t("refreshFailed")),
    })
  );

  const deleteMutation = useMutation(
    trpc.calendarSync.deleteConnection.mutationOptions({
      onSuccess: () => {
        toast.success(t("disconnected"));
        invalidate();
        setShowDisconnect(false);
      },
      onError: () => toast.error(t("disconnectFailed")),
    })
  );

  const updateCalMutation = useMutation(
    trpc.calendarSync.updateCalendar.mutationOptions({
      onSuccess: () => invalidate(),
    })
  );

  const reconnectMutation = useMutation(
    trpc.calendarSync.reconnect.mutationOptions({
      onSuccess: () => {
        toast.success(t("reconnectedSuccessfully"));
        invalidate();
      },
      onError: (err) => toast.error(err.message || t("reconnectFailed")),
    })
  );

  const statusColor = {
    ACTIVE: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    EXPIRED: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    REVOKED: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cloud className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">
                {connection.accountLabel}
              </CardTitle>
            </div>
            <Badge
              variant="secondary"
              className={statusColor[connection.status]}
            >
              {t(`status${connection.status}`)}
            </Badge>
          </div>
          {connection.lastSyncAt && (
            <p className="text-xs text-muted-foreground">
              {t("lastSynced")}: {format(connection.lastSyncAt, "PPp")}
            </p>
          )}
        </CardHeader>

        <CardContent className="space-y-3">
          {/* Calendar list */}
          <div className="space-y-2">
            {connection.calendars.map((cal) => (
              <div
                key={cal.id}
                className="flex items-center justify-between gap-3 rounded-md border p-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {cal.color && (
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: cal.color }}
                    />
                  )}
                  <span className="truncate text-sm">{cal.name}</span>
                  <span className="text-xs text-muted-foreground">
                    ({cal._count.events})
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Select
                    value={cal.privacyMode}
                    onValueChange={(v) =>
                      updateCalMutation.mutate({
                        id: cal.id,
                        privacyMode: v as "FULL_DETAILS" | "BUSY_FREE_ONLY",
                      })
                    }
                  >
                    <SelectTrigger className="h-7 w-auto gap-1 text-xs">
                      <SelectValue>
                        {cal.privacyMode === "FULL_DETAILS" ? (
                          <Eye className="h-3 w-3" />
                        ) : (
                          <EyeOff className="h-3 w-3" />
                        )}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FULL_DETAILS">
                        {t("fullDetails")}
                      </SelectItem>
                      <SelectItem value="BUSY_FREE_ONLY">
                        {t("busyFreeOnly")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <Switch
                    checked={cal.syncEnabled}
                    onCheckedChange={(checked) =>
                      updateCalMutation.mutate({
                        id: cal.id,
                        syncEnabled: checked,
                      })
                    }
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-2">
            {connection.status !== "ACTIVE" && (
              <Button
                variant="default"
                size="sm"
                onClick={() =>
                  reconnectMutation.mutate({ connectionId: connection.id })
                }
                disabled={reconnectMutation.isPending}
              >
                <PlugZap
                  className={`mr-1.5 h-3.5 w-3.5 ${
                    reconnectMutation.isPending ? "animate-spin" : ""
                  }`}
                />
                {reconnectMutation.isPending
                  ? t("reconnecting")
                  : t("reconnect")}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                syncMutation.mutate({ connectionId: connection.id })
              }
              disabled={
                syncMutation.isPending || connection.status !== "ACTIVE"
              }
            >
              <RefreshCw
                className={`mr-1.5 h-3.5 w-3.5 ${
                  syncMutation.isPending ? "animate-spin" : ""
                }`}
              />
              {t("syncNow")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                refreshMutation.mutate({ connectionId: connection.id })
              }
              disabled={
                refreshMutation.isPending || connection.status !== "ACTIVE"
              }
            >
              {t("refreshCalendars")}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDisconnect(true)}
              className="ml-auto"
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              {t("disconnect")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <DisconnectDialog
        open={showDisconnect}
        onOpenChange={setShowDisconnect}
        accountLabel={connection.accountLabel}
        onConfirm={() =>
          deleteMutation.mutate({ id: connection.id })
        }
        isPending={deleteMutation.isPending}
      />
    </>
  );
}
