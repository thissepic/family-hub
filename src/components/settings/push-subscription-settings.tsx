"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, BellOff } from "lucide-react";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function PushSubscriptionSettings() {
  const t = useTranslations("settings");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [loading, setLoading] = useState(false);

  const checkSubscription = useCallback(async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      return;
    }
    setIsSupported(true);

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    setIsSubscribed(!!subscription);
  }, []);

  useEffect(() => {
    checkSubscription();
  }, [checkSubscription]);

  const subscribe = async () => {
    setLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error(t("pushPermissionDenied"));
        return;
      }

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        toast.error(t("pushNotConfigured"));
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
      });

      const json = subscription.toJSON();
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          p256dh: json.keys?.p256dh,
          auth: json.keys?.auth,
        }),
      });

      if (!res.ok) throw new Error("Subscribe failed");

      setIsSubscribed(true);
      toast.success(t("pushEnabled"));
    } catch {
      toast.error(t("pushSubscribeFailed"));
    } finally {
      setLoading(false);
    }
  };

  const unsubscribe = async () => {
    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }

      setIsSubscribed(false);
      toast.success(t("pushDisabled"));
    } catch {
      toast.error(t("pushUnsubscribeFailed"));
    } finally {
      setLoading(false);
    }
  };

  if (!isSupported) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("pushNotifications")}</CardTitle>
        <CardDescription>{t("pushNotificationsDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        {isSubscribed ? (
          <Button variant="outline" onClick={unsubscribe} disabled={loading}>
            <BellOff className="mr-2 h-4 w-4" />
            {t("disablePush")}
          </Button>
        ) : (
          <Button onClick={subscribe} disabled={loading}>
            <Bell className="mr-2 h-4 w-4" />
            {t("enablePush")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
