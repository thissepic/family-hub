"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then((registration) => {
        // Check for updates every 60 seconds
        setInterval(() => registration.update(), 60 * 1000);

        // When a new SW is waiting, activate it and reload
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (
              newWorker.state === "activated" &&
              navigator.serviceWorker.controller
            ) {
              // New SW activated while we had an old one — reload to get fresh assets
              window.location.reload();
            }
          });
        });
      });

    // Also handle the case where a new SW takes over via skipWaiting + clients.claim
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  }, []);

  return null;
}
