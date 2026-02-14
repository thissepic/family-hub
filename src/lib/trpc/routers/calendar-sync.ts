import { TRPCError } from "@trpc/server";
import type { ExternalCalendarConnection } from "@prisma/client";
import { router, protectedProcedure } from "../init";
import { db } from "@/lib/db";
import { sealData } from "iron-session";
import {
  getConnectionInput,
  deleteConnectionInput,
  updateCalendarInput,
  triggerSyncInput,
  refreshCalendarListInput,
  connectCaldavInput,
  connectEwsInput,
  reconnectInput,
} from "./calendar-sync.schemas";
import { enqueueSyncJob } from "@/lib/calendar-sync/queue";
import {
  getAuthenticatedClient,
  fetchCalendarList,
} from "@/lib/calendar-sync/google";
import { encryptToken } from "@/lib/calendar-sync/encryption";
import { discoverCalendars } from "@/lib/calendar-sync/caldav";
import { discoverEwsCalendars } from "@/lib/calendar-sync/ews";

export const calendarSyncRouter = router({
  /**
   * Get the Google OAuth authorization URL.
   */
  getGoogleAuthUrl: protectedProcedure.query(async ({ ctx }) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Google OAuth not configured",
      });
    }

    const { google } = await import("googleapis");
    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    const state = await sealData(
      {
        memberId: ctx.session.memberId,
        familyId: ctx.session.familyId,
      },
      { password: process.env.SESSION_SECRET!, ttl: 600 }
    );

    const url = oauth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: [
        "https://www.googleapis.com/auth/calendar.readonly",
        "https://www.googleapis.com/auth/calendar.events.readonly",
        "https://www.googleapis.com/auth/userinfo.email",
      ],
      state,
    });

    return { url };
  }),

  /**
   * List all external calendar connections for the current member.
   */
  listConnections: protectedProcedure.query(async ({ ctx }) => {
    const connections = await db.externalCalendarConnection.findMany({
      where: { memberId: ctx.session.memberId },
      include: {
        calendars: {
          include: {
            _count: { select: { events: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return connections;
  }),

  /**
   * Get a single connection with full details.
   */
  getConnection: protectedProcedure
    .input(getConnectionInput)
    .query(async ({ ctx, input }) => {
      const connection = await db.externalCalendarConnection.findFirst({
        where: {
          id: input.id,
          memberId: ctx.session.memberId,
        },
        include: {
          calendars: {
            include: {
              _count: { select: { events: true } },
            },
            orderBy: { name: "asc" },
          },
        },
      });

      if (!connection) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Connection not found",
        });
      }

      return connection;
    }),

  /**
   * Delete a connection and all associated synced events.
   */
  deleteConnection: protectedProcedure
    .input(deleteConnectionInput)
    .mutation(async ({ ctx, input }) => {
      const connection = await db.externalCalendarConnection.findFirst({
        where: {
          id: input.id,
          memberId: ctx.session.memberId,
        },
        include: { calendars: { select: { id: true } } },
      });

      if (!connection) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Connection not found",
        });
      }

      await db.$transaction(async (tx) => {
        // Delete all synced events for each calendar
        const calendarIds = connection.calendars.map((c) => c.id);
        if (calendarIds.length > 0) {
          // First delete assignees for events in these calendars
          await tx.eventAssignee.deleteMany({
            where: {
              event: { externalCalendarId: { in: calendarIds } },
            },
          });
          // Then delete the events
          await tx.calendarEvent.deleteMany({
            where: { externalCalendarId: { in: calendarIds } },
          });
        }

        // Delete calendars
        await tx.externalCalendar.deleteMany({
          where: { connectionId: connection.id },
        });

        // Delete the connection
        await tx.externalCalendarConnection.delete({
          where: { id: connection.id },
        });
      });

      return { deleted: true };
    }),

  /**
   * Update an external calendar's settings (sync toggle, privacy mode, etc).
   */
  updateCalendar: protectedProcedure
    .input(updateCalendarInput)
    .mutation(async ({ ctx, input }) => {
      // Verify the calendar belongs to the current member
      const calendar = await db.externalCalendar.findFirst({
        where: {
          id: input.id,
          connection: { memberId: ctx.session.memberId },
        },
        include: { connection: true },
      });

      if (!calendar) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Calendar not found",
        });
      }

      const updated = await db.externalCalendar.update({
        where: { id: input.id },
        data: {
          ...(input.syncEnabled !== undefined && {
            syncEnabled: input.syncEnabled,
          }),
          ...(input.privacyMode !== undefined && {
            privacyMode: input.privacyMode,
          }),
          ...(input.syncDirection !== undefined && {
            syncDirection: input.syncDirection,
          }),
        },
      });

      // If sync was just enabled, trigger an immediate sync
      if (input.syncEnabled === true) {
        try {
          await enqueueSyncJob(calendar.connectionId, true);
        } catch {
          // Don't fail if queue unavailable
        }
      }

      // If sync was disabled, remove all synced events for this calendar
      if (input.syncEnabled === false) {
        await db.$transaction(async (tx) => {
          // First delete assignees for events in this calendar
          await tx.eventAssignee.deleteMany({
            where: {
              event: { externalCalendarId: input.id },
            },
          });
          // Then delete the events themselves
          await tx.calendarEvent.deleteMany({
            where: { externalCalendarId: input.id },
          });
        });
        // Clear the sync token so a fresh full sync happens if re-enabled
        await db.externalCalendar.update({
          where: { id: input.id },
          data: { lastSyncToken: null },
        });
      }

      // If privacy mode changed, update existing events
      if (input.privacyMode !== undefined) {
        if (input.privacyMode === "BUSY_FREE_ONLY") {
          // Mask existing event titles/descriptions
          await db.calendarEvent.updateMany({
            where: { externalCalendarId: input.id },
            data: {
              title: "Busy",
              description: null,
              location: null,
            },
          });
        }
        // Note: for FULL_DETAILS, a re-sync is needed to restore original data
        if (input.privacyMode === "FULL_DETAILS") {
          try {
            await enqueueSyncJob(calendar.connectionId, true);
          } catch {
            // Don't fail if queue unavailable
          }
        }
      }

      return updated;
    }),

  /**
   * Manually trigger sync for a connection.
   */
  triggerSync: protectedProcedure
    .input(triggerSyncInput)
    .mutation(async ({ ctx, input }) => {
      const connection = await db.externalCalendarConnection.findFirst({
        where: {
          id: input.connectionId,
          memberId: ctx.session.memberId,
          status: "ACTIVE",
        },
      });

      if (!connection) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Active connection not found",
        });
      }

      await enqueueSyncJob(connection.id, true);

      return { queued: true };
    }),

  /**
   * Attempt to reconnect an expired/revoked connection.
   * Tests the stored credentials and reactivates the connection if successful.
   */
  reconnect: protectedProcedure
    .input(reconnectInput)
    .mutation(async ({ ctx, input }) => {
      const connection = await db.externalCalendarConnection.findFirst({
        where: {
          id: input.connectionId,
          memberId: ctx.session.memberId,
        },
      });

      if (!connection) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Connection not found",
        });
      }

      if (connection.status === "ACTIVE") {
        return { reconnected: true };
      }

      // Import the appropriate adapter to test the connection
      const { GoogleCalendarAdapter } = await import(
        "@/lib/calendar-sync/google"
      );
      const { OutlookCalendarAdapter } = await import(
        "@/lib/calendar-sync/outlook"
      );
      const { CaldavAdapter } = await import("@/lib/calendar-sync/caldav");
      const { EwsAdapter } = await import("@/lib/calendar-sync/ews");
      const adapters: Record<string, { refreshAuth: (conn: ExternalCalendarConnection) => Promise<void> }> = {
        GOOGLE: new GoogleCalendarAdapter(),
        OUTLOOK: new OutlookCalendarAdapter(),
        APPLE: new CaldavAdapter(),
        CALDAV: new CaldavAdapter(),
        EXCHANGE_EWS: new EwsAdapter(),
      };

      const adapter = adapters[connection.provider];
      if (!adapter) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Unknown provider",
        });
      }

      // Reset status to ACTIVE first so refreshAuth doesn't immediately
      // set it back to EXPIRED (it checks current status)
      await db.externalCalendarConnection.update({
        where: { id: connection.id },
        data: { status: "ACTIVE" },
      });

      try {
        // Test the connection — refreshAuth will set status back to
        // EXPIRED if credentials are invalid
        await adapter.refreshAuth({
          ...connection,
          status: "ACTIVE",
        });
      } catch {
        // refreshAuth already set the status to EXPIRED in the DB
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Reconnection failed. Credentials may be invalid.",
        });
      }

      // Trigger a sync now that we're reconnected
      try {
        await enqueueSyncJob(connection.id, true);
      } catch {
        // Don't fail if queue unavailable
      }

      return { reconnected: true };
    }),

  /**
   * Re-fetch the calendar list from Google and update local records.
   */
  refreshCalendarList: protectedProcedure
    .input(refreshCalendarListInput)
    .mutation(async ({ ctx, input }) => {
      const connection = await db.externalCalendarConnection.findFirst({
        where: {
          id: input.connectionId,
          memberId: ctx.session.memberId,
          status: "ACTIVE",
        },
        include: { calendars: true },
      });

      if (!connection) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Active connection not found",
        });
      }

      const client = await getAuthenticatedClient(connection);
      const googleCalendars = await fetchCalendarList(client);

      const existingIds = new Set(
        connection.calendars.map((c) => c.externalCalendarId)
      );

      let added = 0;
      for (const gc of googleCalendars) {
        if (!existingIds.has(gc.id)) {
          await db.externalCalendar.create({
            data: {
              connectionId: connection.id,
              externalCalendarId: gc.id,
              name: gc.summary,
              color: gc.backgroundColor,
              syncEnabled: false, // New calendars default to off
              privacyMode: "FULL_DETAILS",
              syncDirection: "INBOUND_ONLY",
            },
          });
          added++;
        }
      }

      // Update names/colors of existing calendars
      for (const gc of googleCalendars) {
        if (existingIds.has(gc.id)) {
          const existing = connection.calendars.find(
            (c) => c.externalCalendarId === gc.id
          );
          if (existing) {
            await db.externalCalendar.update({
              where: { id: existing.id },
              data: {
                name: gc.summary,
                color: gc.backgroundColor,
              },
            });
          }
        }
      }

      return { added };
    }),

  /**
   * Connect a CalDAV/Apple iCloud calendar.
   * Tests the connection, discovers calendars, and stores credentials.
   */
  connectCaldav: protectedProcedure
    .input(connectCaldavInput)
    .mutation(async ({ ctx, input }) => {
      const caldavUrl =
        input.provider === "APPLE"
          ? "https://caldav.icloud.com"
          : input.caldavUrl;

      if (!caldavUrl) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "CalDAV server URL is required",
        });
      }

      // Test connection by discovering calendars
      const creds = { username: input.username, password: input.password };
      let discoveredCals;

      try {
        discoveredCals = await discoverCalendars(caldavUrl, creds);
      } catch (err: unknown) {
        const error = err as { code?: number; message?: string };
        console.error("CalDAV discovery failed:", error.message ?? err);
        if (error.code === 401) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Authentication failed. Check your credentials.",
          });
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to connect to CalDAV server.",
        });
      }

      // Encrypt credentials (stored as "username:password")
      const accessTokenEncrypted = encryptToken(
        `${input.username}:${input.password}`
      );

      // Create connection + calendars
      const connection = await db.$transaction(async (tx) => {
        const conn = await tx.externalCalendarConnection.create({
          data: {
            memberId: ctx.session.memberId,
            provider: input.provider,
            accountLabel: input.accountLabel,
            accessTokenEncrypted,
            caldavUrl,
            syncEnabled: true,
            status: "ACTIVE",
          },
        });

        for (let i = 0; i < discoveredCals.length; i++) {
          const cal = discoveredCals[i];
          await tx.externalCalendar.create({
            data: {
              connectionId: conn.id,
              externalCalendarId: cal.href, // For CalDAV, store the full calendar URL
              name: cal.displayName,
              color: cal.color,
              syncEnabled: i === 0, // First calendar enabled by default
              privacyMode: "FULL_DETAILS",
              syncDirection: "INBOUND_ONLY",
            },
          });
        }

        return conn;
      });

      // Enqueue initial sync
      try {
        await enqueueSyncJob(connection.id, true);
      } catch {
        console.warn("Failed to enqueue initial CalDAV sync");
      }

      return {
        id: connection.id,
        calendars: discoveredCals.map((c) => ({
          href: c.href,
          name: c.displayName,
          color: c.color,
        })),
      };
    }),

  /**
   * Connect an Exchange (EWS) calendar.
   * Tests the connection, discovers calendars, and stores credentials.
   */
  connectEws: protectedProcedure
    .input(connectEwsInput)
    .mutation(async ({ ctx, input }) => {
      const ewsCreds = {
        domain: input.domain,
        username: input.username,
        password: input.password,
        email: input.email,
      };

      // Test connection by discovering calendars
      let discoveredCals;
      try {
        discoveredCals = await discoverEwsCalendars(input.ewsUrl, ewsCreds);
      } catch (err: unknown) {
        const error = err as { code?: number };
        if (error.code === 401) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Authentication failed. Check your credentials.",
          });
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to connect to Exchange server.",
        });
      }

      if (discoveredCals.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No calendars found on the Exchange server.",
        });
      }

      // Encrypt credentials as JSON
      const accessTokenEncrypted = encryptToken(
        JSON.stringify(ewsCreds)
      );

      // Create connection + calendars in transaction
      const connection = await db.$transaction(async (tx) => {
        const conn = await tx.externalCalendarConnection.create({
          data: {
            memberId: ctx.session.memberId,
            provider: "EXCHANGE_EWS",
            accountLabel: input.accountLabel,
            accessTokenEncrypted,
            caldavUrl: input.ewsUrl, // Reuse caldavUrl for EWS endpoint
            syncEnabled: true,
            status: "ACTIVE",
          },
        });

        for (let i = 0; i < discoveredCals.length; i++) {
          const cal = discoveredCals[i];
          await tx.externalCalendar.create({
            data: {
              connectionId: conn.id,
              externalCalendarId: cal.folderId,
              name: cal.displayName,
              color: null,
              syncEnabled: i === 0, // First calendar enabled by default
              privacyMode: "FULL_DETAILS",
              syncDirection: "INBOUND_ONLY",
            },
          });
        }

        return conn;
      });

      // Enqueue initial sync
      try {
        await enqueueSyncJob(connection.id, true);
      } catch {
        console.warn("Failed to enqueue initial EWS sync");
      }

      return {
        id: connection.id,
        calendars: discoveredCals.map((c) => ({
          folderId: c.folderId,
          name: c.displayName,
        })),
      };
    }),
});
