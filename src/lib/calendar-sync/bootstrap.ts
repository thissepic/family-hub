import type { Worker } from "bullmq";

let worker: Worker | null = null;

/**
 * Start the BullMQ sync worker and set up periodic sync.
 * Called from instrumentation.ts on server startup.
 */
export async function startSyncWorker(): Promise<void> {
  if (worker) return; // Already started

  try {
    const { createSyncWorker } = await import("./worker");
    const { enqueuePeriodicSync } = await import("./queue");

    worker = createSyncWorker();
    await enqueuePeriodicSync();

    console.log("[Calendar Sync] Worker started, periodic sync scheduled");
  } catch (err) {
    console.warn("[Calendar Sync] Failed to start worker:", err);
    // Don't throw — the app should still work without the sync worker
  }
}

/**
 * Gracefully stop the sync worker.
 */
export async function stopSyncWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
    console.log("[Calendar Sync] Worker stopped");
  }
}
