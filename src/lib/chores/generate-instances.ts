import type { PrismaClient } from "@prisma/client";
import type { RotationPattern } from "@prisma/client";
import { getCurrentPeriodFromRule, getNextPeriodFromRule } from "./periods";
import { pickNextAssignee } from "./rotation";

type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

/**
 * Ensure instances exist for a single chore in the current (and optionally next) period.
 * Returns the IDs of any newly created instances.
 */
export async function ensureInstancesForChore(
  tx: Tx,
  choreId: string,
  options?: { includeNext?: boolean }
): Promise<string[]> {
  const chore = await tx.chore.findUnique({
    where: { id: choreId },
    select: {
      id: true,
      recurrenceRule: true,
      recurrenceStart: true,
      rotationPattern: true,
      assignees: {
        orderBy: { sortOrder: "asc" },
        select: { memberId: true, sortOrder: true },
      },
      instances: {
        orderBy: { periodStart: "desc" },
        take: 10,
        select: { assignedMemberId: true, periodStart: true },
      },
    },
  });

  if (!chore || chore.assignees.length === 0) {
    return [];
  }

  const currentPeriod = getCurrentPeriodFromRule(
    chore.recurrenceRule,
    chore.recurrenceStart,
  );

  // No current period (rule hasn't started or is exhausted)
  if (!currentPeriod) {
    return [];
  }

  const createdIds: string[] = [];

  // Generate for current period
  const existingCurrent = await tx.choreInstance.findFirst({
    where: { choreId, periodStart: currentPeriod.start },
    select: { id: true },
  });

  if (!existingCurrent) {
    const isGroupTask = chore.rotationPattern === "ALL_TOGETHER";

    if (isGroupTask) {
      // Group task: assign ALL members from the pool
      const instance = await tx.choreInstance.create({
        data: {
          choreId,
          assignedMemberId: null,
          periodStart: currentPeriod.start,
          periodEnd: currentPeriod.end,
        },
      });
      for (const assignee of chore.assignees) {
        await tx.choreInstanceAssignee.create({
          data: {
            choreInstanceId: instance.id,
            memberId: assignee.memberId,
          },
        });
      }
      createdIds.push(instance.id);
    } else {
      // Rotation: pick one member
      const memberId = pickNextAssignee(
        chore.rotationPattern as RotationPattern,
        chore.assignees,
        chore.instances,
        currentPeriod.start
      );
      const instance = await tx.choreInstance.create({
        data: {
          choreId,
          assignedMemberId: memberId,
          periodStart: currentPeriod.start,
          periodEnd: currentPeriod.end,
        },
      });
      // Also create a single instance assignee for consistency
      await tx.choreInstanceAssignee.create({
        data: {
          choreInstanceId: instance.id,
          memberId,
        },
      });
      createdIds.push(instance.id);
    }
  }

  // Optionally generate for next period
  if (options?.includeNext) {
    const nextPeriod = getNextPeriodFromRule(
      chore.recurrenceRule,
      chore.recurrenceStart,
      currentPeriod,
    );

    if (nextPeriod) {
      const existingNext = await tx.choreInstance.findFirst({
        where: { choreId, periodStart: nextPeriod.start },
        select: { id: true },
      });

      if (!existingNext) {
        const isGroupTask = chore.rotationPattern === "ALL_TOGETHER";

        if (isGroupTask) {
          const instance = await tx.choreInstance.create({
            data: {
              choreId,
              assignedMemberId: null,
              periodStart: nextPeriod.start,
              periodEnd: nextPeriod.end,
            },
          });
          for (const assignee of chore.assignees) {
            await tx.choreInstanceAssignee.create({
              data: {
                choreInstanceId: instance.id,
                memberId: assignee.memberId,
              },
            });
          }
          createdIds.push(instance.id);
        } else {
          // Re-fetch instances including any we just created
          const updatedInstances = await tx.choreInstance.findMany({
            where: { choreId },
            orderBy: { periodStart: "desc" },
            take: 10,
            select: { assignedMemberId: true, periodStart: true },
          });

          const memberId = pickNextAssignee(
            chore.rotationPattern as RotationPattern,
            chore.assignees,
            updatedInstances,
            nextPeriod.start
          );
          const instance = await tx.choreInstance.create({
            data: {
              choreId,
              assignedMemberId: memberId,
              periodStart: nextPeriod.start,
              periodEnd: nextPeriod.end,
            },
          });
          await tx.choreInstanceAssignee.create({
            data: {
              choreInstanceId: instance.id,
              memberId,
            },
          });
          createdIds.push(instance.id);
        }
      }
    }
  }

  return createdIds;
}

/**
 * Ensure instances exist for all chores of a family for the current period.
 * Returns the total number of instances created.
 */
export async function ensureInstancesForFamily(
  tx: Tx,
  familyId: string
): Promise<number> {
  const chores = await tx.chore.findMany({
    where: { familyId },
    select: { id: true },
  });

  let count = 0;
  for (const chore of chores) {
    const ids = await ensureInstancesForChore(tx, chore.id, {
      includeNext: true,
    });
    count += ids.length;
  }
  return count;
}
