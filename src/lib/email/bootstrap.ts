import type { Worker } from "bullmq";

let worker: Worker | null = null;

/**
 * Start the BullMQ email worker.
 * Called from instrumentation.ts on server startup.
 */
export async function startEmailWorker(): Promise<void> {
  if (worker) return; // Already started

  try {
    const { createEmailWorker } = await import("./worker");
    worker = createEmailWorker();

    // Catch unhandled worker errors to prevent crashing the process
    worker.on("error", (err) => {
      console.error("[Email] Worker error (caught):", err.message);
    });

    console.log("[Email] Worker started");
  } catch (err) {
    console.warn("[Email] Failed to start worker:", err);
    // Don't throw — the app should still work without the email worker
  }
}

/**
 * Gracefully stop the email worker.
 */
export async function stopEmailWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
    console.log("[Email] Worker stopped");
  }
}
