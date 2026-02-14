import type { Worker } from "bullmq";

let worker: Worker | null = null;

/**
 * Start the BullMQ maintenance worker and set up repeatable jobs.
 * Called from instrumentation.ts on server startup.
 */
export async function startMaintenanceWorker(): Promise<void> {
  if (worker) return; // Already started

  try {
    const { createMaintenanceWorker } = await import("./worker");
    const { enqueueMaintenanceJobs } = await import("./queue");

    worker = createMaintenanceWorker();
    await enqueueMaintenanceJobs();

    console.log("[Maintenance] Worker started, jobs scheduled");
  } catch (err) {
    console.warn("[Maintenance] Failed to start worker:", err);
    // Don't throw — the app should still work without the maintenance worker
  }
}

/**
 * Gracefully stop the maintenance worker.
 */
export async function stopMaintenanceWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
    console.log("[Maintenance] Worker stopped");
  }
}
