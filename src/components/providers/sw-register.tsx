"use client";

import { useEffect } from "react";

const SW_RELOAD_KEY = "sw-reloaded";
const SW_RELOAD_COOLDOWN_MS = 5000;
const SW_ACTIVATION_DELAY_MS = 2000;

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const mountedAt = Date.now();

    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then((registration) => {
        // Check for updates every 60 seconds
        setInterval(() => registration.update(), 60 * 1000);

        // When a new SW is installed and waiting, tell it to activate —
        // but only after a short delay so the page has finished loading.
        const activateWaiting = (worker: ServiceWorker) => {
          setTimeout(() => {
            worker.postMessage({ type: "SKIP_WAITING" });
          }, SW_ACTIVATION_DELAY_MS);
        };

        // Handle the case where a waiting worker already exists on registration
        if (registration.waiting) {
          activateWaiting(registration.waiting);
        }

        // Handle new workers that become installed in the future
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && registration.waiting) {
              activateWaiting(newWorker);
            }
          });
        });
      });

    // Handle SW takeover via skipWaiting + clients.claim — single reload trigger.
    // Uses requestIdleCallback to avoid interrupting React mid-render.
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      // If the controller changed within a few seconds of mount, this is
      // caused by the current page load installing the SW. Don't reload.
      if (Date.now() - mountedAt < SW_RELOAD_COOLDOWN_MS) {
        return;
      }

      // Persistent guard: prevent reload loops across page loads
      const lastReload = sessionStorage.getItem(SW_RELOAD_KEY);
      if (lastReload && Date.now() - Number(lastReload) < SW_RELOAD_COOLDOWN_MS) {
        return;
      }

      sessionStorage.setItem(SW_RELOAD_KEY, String(Date.now()));

      // Wait for React to finish rendering before reloading
      if ("requestIdleCallback" in window) {
        requestIdleCallback(() => window.location.reload(), { timeout: 2000 });
      } else {
        setTimeout(() => window.location.reload(), 100);
      }
    });
  }, []);

  return null;
}
