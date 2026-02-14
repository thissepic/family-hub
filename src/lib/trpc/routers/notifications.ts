import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../init";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import {
  listNotificationsInput,
  markReadInput,
  deleteNotificationInput,
  updatePreferenceInput,
} from "./notifications.schemas";

export const notificationsRouter = router({
  // ─── List notifications ──────────────────────────────────────
  list: protectedProcedure
    .input(listNotificationsInput)
    .query(async ({ ctx, input }) => {
      const where: Prisma.NotificationWhereInput = {
        memberId: ctx.session.memberId,
      };

      if (input.unreadOnly) {
        where.read = false;
      }

      return db.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 50,
      });
    }),

  // ─── Unread count ────────────────────────────────────────────
  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    const count = await db.notification.count({
      where: {
        memberId: ctx.session.memberId,
        read: false,
      },
    });
    return count;
  }),

  // ─── Mark single notification as read ─────────────────────────
  markRead: protectedProcedure
    .input(markReadInput)
    .mutation(async ({ ctx, input }) => {
      const notification = await db.notification.findUnique({
        where: { id: input.id },
      });

      if (!notification || notification.memberId !== ctx.session.memberId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return db.notification.update({
        where: { id: input.id },
        data: { read: true, readAt: new Date() },
      });
    }),

  // ─── Mark all as read ────────────────────────────────────────
  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    const result = await db.notification.updateMany({
      where: {
        memberId: ctx.session.memberId,
        read: false,
      },
      data: { read: true, readAt: new Date() },
    });

    return { count: result.count };
  }),

  // ─── Delete notification ─────────────────────────────────────
  delete: protectedProcedure
    .input(deleteNotificationInput)
    .mutation(async ({ ctx, input }) => {
      const notification = await db.notification.findUnique({
        where: { id: input.id },
      });

      if (!notification || notification.memberId !== ctx.session.memberId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      await db.notification.delete({ where: { id: input.id } });

      return { success: true };
    }),

  // ─── Notification Preferences ─────────────────────────────────
  listPreferences: protectedProcedure.query(async ({ ctx }) => {
    return db.notificationPreference.findMany({
      where: { memberId: ctx.session.memberId },
    });
  }),

  updatePreference: protectedProcedure
    .input(updatePreferenceInput)
    .mutation(async ({ ctx, input }) => {
      return db.notificationPreference.upsert({
        where: {
          memberId_type: {
            memberId: ctx.session.memberId,
            type: input.type,
          },
        },
        create: {
          memberId: ctx.session.memberId,
          type: input.type,
          muted: input.muted,
        },
        update: {
          muted: input.muted,
        },
      });
    }),
});
