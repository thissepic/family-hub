"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "sonner";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { Separator } from "@/components/ui/separator";
import { NotificationItem } from "@/components/notifications/notification-item";

export default function NotificationsPage() {
  const t = useTranslations("notifications");
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [unreadOnly, setUnreadOnly] = useState(false);

  const { data: notifications } = useQuery(
    trpc.notifications.list.queryOptions({
      unreadOnly: unreadOnly || undefined,
    })
  );

  const { data: unreadCount } = useQuery(
    trpc.notifications.unreadCount.queryOptions()
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [["notifications"]] });
  };

  const markReadMutation = useMutation(
    trpc.notifications.markRead.mutationOptions({
      onSuccess: invalidate,
    })
  );

  const markAllReadMutation = useMutation(
    trpc.notifications.markAllRead.mutationOptions({
      onSuccess: () => {
        toast.success(t("allRead"));
        invalidate();
      },
    })
  );

  const deleteMutation = useMutation(
    trpc.notifications.delete.mutationOptions({
      onSuccess: invalidate,
    })
  );

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={() => markAllReadMutation.mutate()}
          disabled={!unreadCount || markAllReadMutation.isPending}
        >
          <CheckCheck className="mr-1.5 h-4 w-4" />
          {t("markAllRead")}
        </Button>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <Toggle
          pressed={unreadOnly}
          onPressedChange={setUnreadOnly}
          size="sm"
        >
          {t("unreadOnly")}
        </Toggle>
      </div>

      {/* Notification list */}
      {notifications && notifications.length > 0 ? (
        <div className="space-y-2">
          {notifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onMarkRead={(id) => markReadMutation.mutate({ id })}
              onDelete={(id) => deleteMutation.mutate({ id })}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12">
          <Bell className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm font-medium">{t("noNotifications")}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("noNotificationsDescription")}
          </p>
        </div>
      )}
    </div>
  );
}
