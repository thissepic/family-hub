import { router, protectedProcedure } from "../init";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { listActivityInput } from "./activity.schemas";

const activityInclude = {
  member: { select: { id: true, name: true, color: true } },
} as const;

export const activityRouter = router({
  // ─── List activity events ────────────────────────────────────
  list: protectedProcedure
    .input(listActivityInput)
    .query(async ({ ctx, input }) => {
      const where: Prisma.ActivityEventWhereInput = {
        familyId: ctx.session.familyId,
      };

      if (input.memberId) {
        where.memberId = input.memberId;
      }

      if (input.type) {
        where.type = input.type as Prisma.ActivityEventWhereInput["type"];
      }

      if (input.cursor) {
        where.id = { lt: input.cursor };
      }

      const items = await db.activityEvent.findMany({
        where,
        include: activityInclude,
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor && {
          cursor: { id: input.cursor },
          skip: 1,
        }),
      });

      let nextCursor: string | undefined;
      if (items.length > input.limit) {
        const extra = items.pop()!;
        nextCursor = extra.id;
      }

      return { items, nextCursor };
    }),
});
