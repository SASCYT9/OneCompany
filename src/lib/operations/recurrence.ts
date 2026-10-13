import {
  OpsTaskEventType,
  OpsTaskSourceType,
  OpsTaskStatus,
  Prisma,
  type PrismaClient,
} from "@prisma/client";

import { createOpsExternalId } from "@/lib/operations/ids";
import { addOpsLocalDays, opsLocalClock, opsLocalTime } from "@/lib/operations/reminders";

import {
  OPS_REPEAT_TAGS,
  opsRepeatRuleFromTags,
  type OpsRepeatRule,
} from "@/lib/operations/repeatRules";

export {
  isOpsRepeatTag,
  OPS_REPEAT_RULES,
  OPS_REPEAT_TAG_PREFIX,
  OPS_REPEAT_TAGS,
  opsRepeatLabel,
  opsRepeatRuleFromTags,
  parseOpsRepeatRule,
  withOpsRepeatRule,
  type OpsRepeatRule,
} from "@/lib/operations/repeatRules";

/**
 * When a repeating task is marked done, the watchdog creates the next
 * occurrence; cancelling it ends the series.
 */
const SPAWN_LOOKBACK_MS = 45 * 24 * 60 * 60 * 1000;

function isoWeekday(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return weekday === 0 ? 7 : weekday;
}

function addLocalMonths(date: string, months: number, anchorDay: number) {
  const [year, month] = date.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)
  ).getUTCDate();
  target.setUTCDate(Math.min(anchorDay, lastDay));
  return target.toISOString().slice(0, 10);
}

/**
 * The next deadline after `now`, keeping the original local time of day.
 * Missed occurrences are skipped instead of piling up.
 */
export function nextOpsRepeatDueAt(
  rule: OpsRepeatRule,
  anchor: Date,
  now: Date,
  timeZone = "Europe/Kyiv"
) {
  const clock = opsLocalClock(anchor, timeZone);
  const anchorDay = Number(clock.date.slice(8, 10));
  let date = clock.date;
  let months = 0;
  const at = (day: string) =>
    new Date(opsLocalTime(day, clock.hour, timeZone).getTime() + clock.minute * 60_000);
  for (let step = 0; step < 800; step += 1) {
    if (rule === "monthly") {
      months += 1;
      date = addLocalMonths(clock.date, months, anchorDay);
    } else {
      date = addOpsLocalDays(date, rule === "weekly" ? 7 : 1);
      if (rule === "weekdays" && isoWeekday(date) > 5) continue;
    }
    const candidate = at(date);
    if (candidate > now) return candidate;
  }
  return at(addOpsLocalDays(opsLocalClock(now, timeZone).date, 1));
}

/** Creates the next occurrence of every repeating task finished recently. */
export async function spawnOpsRecurringTasks(input: { client: PrismaClient; now: Date }) {
  const finished = await input.client.opsTask.findMany({
    where: {
      status: OpsTaskStatus.DONE,
      archivedAt: null,
      tags: { hasSome: OPS_REPEAT_TAGS },
      completedAt: { gte: new Date(input.now.getTime() - SPAWN_LOOKBACK_MS) },
    },
    orderBy: { completedAt: "asc" },
    take: 50,
    select: {
      id: true,
      title: true,
      description: true,
      tags: true,
      priority: true,
      projectId: true,
      shopOrderId: true,
      nextAction: true,
      definitionOfDone: true,
      isShared: true,
      assigneeId: true,
      createdById: true,
      requestedById: true,
      dueAt: true,
      completedAt: true,
      assignees: { select: { adminUserId: true, assignedById: true } },
    },
  });
  if (!finished.length) return { created: 0 };
  const existing = await input.client.opsTask.findMany({
    where: { sourceKey: { in: finished.map((task) => `repeat:${task.id}`) } },
    select: { sourceKey: true },
  });
  const done = new Set(existing.map((task) => task.sourceKey));
  let created = 0;
  for (const task of finished) {
    const sourceKey = `repeat:${task.id}`;
    const rule = opsRepeatRuleFromTags(task.tags);
    if (!rule || done.has(sourceKey)) continue;
    const dueAt = nextOpsRepeatDueAt(rule, task.dueAt ?? task.completedAt ?? input.now, input.now);
    try {
      await input.client.$transaction(async (tx) => {
        const next = await tx.opsTask.create({
          data: {
            externalId: createOpsExternalId("ONE"),
            title: task.title,
            description: task.description,
            tags: task.tags,
            priority: task.priority,
            projectId: task.projectId,
            shopOrderId: task.shopOrderId,
            nextAction: task.nextAction,
            definitionOfDone: task.definitionOfDone,
            isShared: task.isShared,
            assigneeId: task.assigneeId,
            status: OpsTaskStatus.PLANNED,
            dueAt,
            sourceType: OpsTaskSourceType.AUTOMATION,
            sourceId: task.id,
            sourceKey,
            createdById: task.createdById,
            requestedById: task.requestedById,
            assignees: task.assignees.length
              ? {
                  create: task.assignees.map((assignment) => ({
                    adminUserId: assignment.adminUserId,
                    assignedById: assignment.assignedById,
                  })),
                }
              : undefined,
          },
          select: { id: true },
        });
        await tx.opsTaskEvent.create({
          data: {
            taskId: next.id,
            type: OpsTaskEventType.CREATED,
            actorId: task.createdById,
            sourceType: OpsTaskSourceType.AUTOMATION,
            sourceId: task.id,
            idempotencyKey: sourceKey,
            payload: { repeatOf: task.id, rule, dueAt: dueAt.toISOString() },
          },
        });
      });
      created += 1;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") continue;
      throw error;
    }
  }
  return { created };
}
