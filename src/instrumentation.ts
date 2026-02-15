export async function register() {
  // Only start background workers in the Node.js runtime (not Edge)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startSyncWorker } = await import(
      "@/lib/calendar-sync/bootstrap"
    );
    const { startMaintenanceWorker } = await import(
      "@/lib/maintenance/bootstrap"
    );
    const { startEmailWorker } = await import("@/lib/email/bootstrap");
    const { initSocketServer } = await import("@/lib/socket/server");

    await startSyncWorker();
    await startMaintenanceWorker();
    await startEmailWorker();
    initSocketServer();
  }
}
