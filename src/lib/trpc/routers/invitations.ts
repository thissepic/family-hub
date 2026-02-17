import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, userProcedure, adminProcedure } from "../init";
import { db } from "@/lib/db";
import { enqueueInvitationEmail } from "@/lib/email/queue";
import crypto from "crypto";

export const invitationsRouter = router({
  /** Create an invitation to join the family (optionally for a specific unlinked profile). */
  create: adminProcedure
    .input(z.object({
      email: z.string().email().optional(),
      role: z.enum(["ADMIN", "MEMBER"]).default("MEMBER"),
      expiresInDays: z.number().min(1).max(30).default(7),
      forMemberId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      let resolvedRole = input.role;

      // If this invitation is for a specific existing profile, validate it
      if (input.forMemberId) {
        const targetMember = await db.familyMember.findUnique({
          where: { id: input.forMemberId },
          select: { familyId: true, userId: true, role: true },
        });

        if (!targetMember || targetMember.familyId !== ctx.session.familyId) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Member profile not found",
          });
        }

        if (targetMember.userId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "This profile is already linked to a user account",
          });
        }

        // Check for existing pending invitation for this profile
        const existingProfileInvitation = await db.familyInvitation.findFirst({
          where: {
            forMemberId: input.forMemberId,
            status: "PENDING",
            expiresAt: { gt: new Date() },
          },
        });
        if (existingProfileInvitation) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "A pending invitation already exists for this profile",
          });
        }

        // Use the profile's existing role
        resolvedRole = targetMember.role;
      }

      // If email is provided, check for existing member with that email
      if (input.email) {
        const email = input.email.toLowerCase();
        const existingUser = await db.user.findUnique({
          where: { email },
          select: { id: true },
        });

        if (existingUser) {
          const existingMember = await db.familyMember.findUnique({
            where: { familyId_userId: { familyId: ctx.session.familyId, userId: existingUser.id } },
          });
          if (existingMember) {
            throw new TRPCError({
              code: "CONFLICT",
              message: "This user is already a member of this family",
            });
          }
        }

        // Check for existing pending invitation to same email (only if not profile-bound)
        if (!input.forMemberId) {
          const existingInvitation = await db.familyInvitation.findFirst({
            where: {
              familyId: ctx.session.familyId,
              email,
              status: "PENDING",
              expiresAt: { gt: new Date() },
            },
          });
          if (existingInvitation) {
            throw new TRPCError({
              code: "CONFLICT",
              message: "A pending invitation already exists for this email",
            });
          }
        }
      }

      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000);

      const invitation = await db.familyInvitation.create({
        data: {
          familyId: ctx.session.familyId,
          email: input.email?.toLowerCase(),
          role: resolvedRole,
          token,
          status: "PENDING",
          invitedById: ctx.session.memberId,
          forMemberId: input.forMemberId,
          expiresAt,
        },
        include: {
          family: { select: { name: true, defaultLocale: true } },
          invitedBy: { select: { name: true } },
        },
      });

      // Send invitation email if an email address was provided
      if (input.email) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        const inviteUrl = `${appUrl}/invite/${token}`;
        const locale = (invitation.family.defaultLocale === "de" ? "de" : "en") as "en" | "de";

        await enqueueInvitationEmail(
          input.email.toLowerCase(),
          locale,
          invitation.family.name,
          invitation.invitedBy.name,
          inviteUrl,
          expiresAt.toLocaleDateString(locale === "de" ? "de-DE" : "en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          }),
        ).catch((err) => {
          // Don't fail the invitation creation if email fails to queue
          console.error("[Invitations] Failed to queue invitation email:", err);
        });
      }

      return {
        id: invitation.id,
        token: invitation.token,
        expiresAt: invitation.expiresAt,
      };
    }),

  /** List pending/recent invitations for the current family. */
  list: adminProcedure.query(async ({ ctx }) => {
    return db.familyInvitation.findMany({
      where: { familyId: ctx.session.familyId },
      include: {
        invitedBy: {
          select: { id: true, name: true },
        },
        forMember: {
          select: { id: true, name: true, avatar: true, color: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }),

  /** Revoke a pending invitation. */
  revoke: adminProcedure
    .input(z.object({ invitationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const invitation = await db.familyInvitation.findUnique({
        where: { id: input.invitationId },
      });

      if (!invitation || invitation.familyId !== ctx.session.familyId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invitation not found" });
      }

      if (invitation.status !== "PENDING") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only pending invitations can be revoked",
        });
      }

      return db.familyInvitation.update({
        where: { id: input.invitationId },
        data: { status: "EXPIRED" },
      });
    }),

  /** Get invitation details by token (public - for the accept/decline page). */
  getByToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const invitation = await db.familyInvitation.findUnique({
        where: { token: input.token },
        include: {
          family: {
            select: { id: true, name: true },
          },
          invitedBy: {
            select: { name: true },
          },
          forMember: {
            select: { id: true, name: true, avatar: true, color: true },
          },
        },
      });

      if (!invitation) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invitation not found" });
      }

      const isExpired = invitation.expiresAt < new Date() || invitation.status !== "PENDING";

      return {
        id: invitation.id,
        familyName: invitation.family.name,
        familyId: invitation.family.id,
        role: invitation.role,
        invitedByName: invitation.invitedBy.name,
        email: invitation.email,
        isExpired,
        status: invitation.status,
        forMember: invitation.forMember
          ? {
              id: invitation.forMember.id,
              name: invitation.forMember.name,
              avatar: invitation.forMember.avatar,
              color: invitation.forMember.color,
            }
          : null,
      };
    }),

  /** Accept an invitation. Creates a FamilyMember or links to an existing profile. */
  accept: userProcedure
    .input(z.object({
      token: z.string(),
      memberName: z.string().min(1).max(50).optional(),
      memberColor: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const invitation = await db.familyInvitation.findUnique({
        where: { token: input.token },
        include: {
          forMember: { select: { id: true, userId: true } },
        },
      });

      if (!invitation) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invitation not found" });
      }

      if (invitation.status !== "PENDING") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This invitation is no longer valid",
        });
      }

      if (invitation.expiresAt < new Date()) {
        // Mark as expired
        await db.familyInvitation.update({
          where: { id: invitation.id },
          data: { status: "EXPIRED" },
        });
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This invitation has expired",
        });
      }

      // If invitation has an email constraint, verify it matches the user
      if (invitation.email) {
        const user = await db.user.findUnique({
          where: { id: ctx.session.userId },
          select: { email: true },
        });
        if (user?.email !== invitation.email) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "This invitation was sent to a different email address",
          });
        }
      }

      // Check if user is already a member
      const existingMember = await db.familyMember.findUnique({
        where: { familyId_userId: { familyId: invitation.familyId, userId: ctx.session.userId } },
      });
      if (existingMember) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "You are already a member of this family",
        });
      }

      // Profile-bound invitation: link existing profile to user
      if (invitation.forMemberId && invitation.forMember) {
        // Race condition check: profile might have been linked in the meantime
        if (invitation.forMember.userId) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "This profile has already been linked to another account",
          });
        }

        const result = await db.$transaction(async (tx) => {
          const member = await tx.familyMember.update({
            where: { id: invitation.forMemberId! },
            data: { userId: ctx.session.userId },
          });

          await tx.familyInvitation.update({
            where: { id: invitation.id },
            data: {
              status: "ACCEPTED",
              acceptedAt: new Date(),
            },
          });

          return member;
        });

        return {
          success: true as const,
          familyId: invitation.familyId,
          memberId: result.id,
        };
      }

      // Regular invitation: create a new member
      if (!input.memberName) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Member name is required for new profiles",
        });
      }

      const result = await db.$transaction(async (tx) => {
        const member = await tx.familyMember.create({
          data: {
            familyId: invitation.familyId,
            userId: ctx.session.userId,
            name: input.memberName!,
            color: input.memberColor ?? "#3b82f6",
            role: invitation.role,
          },
        });

        await tx.memberXpProfile.create({
          data: { memberId: member.id },
        });

        await tx.familyInvitation.update({
          where: { id: invitation.id },
          data: {
            status: "ACCEPTED",
            acceptedAt: new Date(),
          },
        });

        return member;
      });

      return {
        success: true as const,
        familyId: invitation.familyId,
        memberId: result.id,
      };
    }),

  /** Decline an invitation. */
  decline: userProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ input }) => {
      const invitation = await db.familyInvitation.findUnique({
        where: { token: input.token },
      });

      if (!invitation) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invitation not found" });
      }

      if (invitation.status !== "PENDING") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This invitation is no longer valid",
        });
      }

      return db.familyInvitation.update({
        where: { id: invitation.id },
        data: { status: "DECLINED" },
      });
    }),

  /** List pending invitations for the current user (across all families). */
  myPendingInvitations: userProcedure.query(async ({ ctx }) => {
    const user = await db.user.findUnique({
      where: { id: ctx.session.userId },
      select: { email: true },
    });

    if (!user?.email) return [];

    return db.familyInvitation.findMany({
      where: {
        email: user.email,
        status: "PENDING",
        expiresAt: { gt: new Date() },
      },
      include: {
        family: {
          select: { id: true, name: true },
        },
        invitedBy: {
          select: { name: true },
        },
        forMember: {
          select: { id: true, name: true, avatar: true, color: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }),
});
