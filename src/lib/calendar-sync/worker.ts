import { Worker, type Job } from "bullmq";
import { db } from "@/lib/db";
import { getConnection } from "./queue";
import type { CalendarProviderAdapter } from "./types";
import { GoogleCalendarAdapter } from "./google";
import { OutlookCalendarAdapter } from "./outlook";
import { CaldavAdapter } from "./caldav";
import { EwsAdapter } from "./ews";

/**
 * Provider adapter registry.
 * All four providers supported: Google, Outlook, Apple (via CalDAV), generic CalDAV.
 */
const adapters: Record<string, CalendarProviderAdapter> = {
  GOOGLE: new GoogleCalendarAdapter(),
  OUTLOOK: new OutlookCalendarAdapter(),
  APPLE: new CaldavAdapter(),
  CALDAV: new CaldavAdapter(),
  EXCHANGE_EWS: new EwsAdapter(),
};

interface SyncJobData {
  connectionId?: string;
  force?: boolean;
}

/**
 * Sync a single external calendar connection using the appropriate provider adapter.
 */
async function syncConnection(
  connectionId: string,
  force: boolean
): Promise<number> {
  const connection = await db.externalCalendarConnection.findUnique({
    where: { id: connectionId },
    include: {
      calendars: { where: { syncEnabled: true } },
    },
  });

  if (!connection) {
    console.warn(`Connection ${connectionId} not found, skipping`);
    return 0;
  }

  if (connection.status !== "ACTIVE") {
    console.warn(
      `Connection ${connectionId} is ${connection.status}, skipping`
    );
    return 0;
  }

  if (!connection.syncEnabled) {
    return 0;
  }

  // Check if sync interval has passed (unless forced)
  if (!force && connection.lastSyncAt) {
    const nextSyncAt = new Date(
      connection.lastSyncAt.getTime() +
        connection.syncIntervalMinutes * 60 * 1000
    );
    if (nextSyncAt > new Date()) {
      return 0;
    }
  }

  // Look up the adapter for this provider
  const adapter = adapters[connection.provider];
  if (!adapter) {
    console.warn(
      `No adapter registered for provider "${connection.provider}", skipping connection ${connectionId}`
    );
    return 0;
  }

  // Resolve familyId once (used for all new events)
  const member = await db.familyMember.findUniqueOrThrow({
    where: { id: connection.memberId },
    select: { familyId: true },
  });
  const familyId = member.familyId;

  let totalSynced = 0;

  try {
    // Refresh auth tokens if needed
    await adapter.refreshAuth(connection);

    for (const calendar of connection.calendars) {
      try {
        const { events, nextSyncToken } = await adapter.fetchEvents(
          connection,
          calendar
        );

        let syncedCount = 0;

        for (const mapped of events) {
          if (mapped.isCancelled) {
            // Delete cancelled events
            await db.calendarEvent.deleteMany({
              where: {
                externalId: mapped.externalId,
                externalCalendarId: calendar.id,
              },
            });
            syncedCount++;
            continue;
          }

          // Check if event already exists locally
          const existing = await db.calendarEvent.findFirst({
            where: {
              externalId: mapped.externalId,
              externalCalendarId: calendar.id,
            },
          });

          if (existing) {
            // Update existing event
            await db.calendarEvent.update({
              where: { id: existing.id },
              data: {
                title: mapped.title,
                description: mapped.description,
                location: mapped.location,
                startAt: mapped.startAt,
                endAt: mapped.endAt,
                allDay: mapped.allDay,
              },
            });
          } else {
            // Create new event
            const event = await db.calendarEvent.create({
              data: {
                familyId,
                title: mapped.title,
                description: mapped.description,
                location: mapped.location,
                startAt: mapped.startAt,
                endAt: mapped.endAt,
                allDay: mapped.allDay,
                category: "OTHER",
                source: connection.provider,
                externalId: mapped.externalId,
                externalCalendarId: calendar.id,
                isReadOnly: true,
                createdById: connection.memberId,
              },
            });

            // Add the connection's member as an assignee
            await db.eventAssignee.create({
              data: {
                eventId: event.id,
                memberId: connection.memberId,
              },
            });
          }
          syncedCount++;
        }

        // Update sync token
        if (nextSyncToken) {
          await db.externalCalendar.update({
            where: { id: calendar.id },
            data: { lastSyncToken: nextSyncToken },
          });
        }

        totalSynced += syncedCount;
      } catch (calErr) {
        console.error(
          `Error syncing calendar ${calendar.name} (${calendar.id}):`,
          calErr
        );
      }
    }

    // Update last sync time
    await db.externalCalendarConnection.update({
      where: { id: connectionId },
      data: { lastSyncAt: new Date() },
    });
  } catch (err: unknown) {
    const error = err as { code?: number; status?: number; message?: string };
    // Handle auth errors
    if (
      error.code === 401 ||
      error.code === 403 ||
      error.status === 401 ||
      error.status === 403
    ) {
      await db.externalCalendarConnection.update({
        where: { id: connectionId },
        data: { status: "EXPIRED" },
      });
      console.error(
        `Connection ${connectionId} marked as EXPIRED due to auth error`
      );
    } else {
      throw err; // Let BullMQ retry
    }
  }

  return totalSynced;
}

/**
 * Handle periodic sync: iterate all active connections.
 */
async function handlePeriodicSync(): Promise<void> {
  const connections = await db.externalCalendarConnection.findMany({
    where: { status: "ACTIVE", syncEnabled: true },
    select: { id: true },
  });

  for (const conn of connections) {
    try {
      await syncConnection(conn.id, false);
    } catch (err) {
      console.error(`Periodic sync error for ${conn.id}:`, err);
    }
  }
}

/**
 * Process a sync job.
 */
async function processJob(job: Job<SyncJobData>): Promise<void> {
  if (job.name === "periodic-sync") {
    await handlePeriodicSync();
  } else if (job.name === "sync-connection" && job.data.connectionId) {
    await syncConnection(job.data.connectionId, job.data.force ?? false);
  }
}

/**
 * Create and return the BullMQ worker.
 */
export function createSyncWorker(): Worker {
  const worker = new Worker("calendar-sync", processJob, {
    connection: getConnection() as never,
    concurrency: 3,
  });

  worker.on("failed", (job, err) => {
    console.error(`Sync job ${job?.id} failed:`, err.message);
  });

  worker.on("completed", (job) => {
    if (job.name !== "periodic-sync") {
      console.log(`Sync job ${job.id} completed`);
    }
  });

  return worker;
}
