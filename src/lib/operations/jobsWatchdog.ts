import {
  OpsAttachmentState,
  OpsJobStage,
  OpsJobStatus,
  OpsTaskStatus,
  type Prisma,
  type PrismaClient,
} from "@prisma/client";
import { cancelRequestedOpsJobs, reclaimExpiredOpsJobLeases } from "@/lib/operations/jobs";
import {
  createConfiguredOpsMediaStore,
  releaseOpsRetainedStorageBytes,
  type OpsPrivateMediaStore,
} from "@/lib/operations/media";
import { opsRolesAllowNotification } from "@/lib/operations/notificationAccess";

const ACTIVE_TASK_STATUSES = [
  OpsTaskStatus.PLANNED,
  OpsTaskStatus.IN_PROGRESS,
  OpsTaskStatus.AGENT_RUNNING,
  OpsTaskStatus.WAITING_HUMAN,
  OpsTaskStatus.WAITING_EXTERNAL,
  OpsTaskStatus.NEEDS_APPROVAL,
  OpsTaskStatus.REVIEW,
  OpsTaskStatus.BLOCKED,
] as const;

function localClock(now: Date, timeZone = "Europe/Kyiv") {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    date: `${value.year}-${value.month}-${value.day}`,
    hour: Number(value.hour),
  };
}

function timeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const representedAsUtc = Date.UTC(
    Number(value.year),
    Number(value.month) - 1,
    Number(value.day),
    Number(value.hour),
    Number(value.minute),
    Number(value.second)
  );
  return representedAsUtc - date.getTime();
}

function localDayBounds(date: string, timeZone: string) {
  const [year, month, day] = date.split("-").map(Number);
  const localMidnightAsUtc = Date.UTC(year, month - 1, day);
  const startGuess = new Date(localMidnightAsUtc);
  const start = new Date(localMidnightAsUtc - timeZoneOffsetMs(startGuess, timeZone));
  const nextLocalMidnightAsUtc = localMidnightAsUtc + 24 * 60 * 60 * 1000;
  const endGuess = new Date(nextLocalMidnightAsUtc);
  const end = new Date(nextLocalMidnightAsUtc - timeZoneOffsetMs(endGuess, timeZone));
  return { start, end };
}

function asJson(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function enqueueOpsInternalNotifications(input: { client: PrismaClient; now: Date }) {
  const candidateProfiles = await input.client.opsMemberProfile.findMany({
    where: {
      telegramEnabled: true,
      telegramUserId: { not: null },
      adminUser: { isActive: true },
    },
    select: {
      adminUserId: true,
      telegramUserId: true,
      timezone: true,
      adminUser: {
        select: {
          roles: {
            select: {
              role: { select: { key: true, permissions: true } },
            },
          },
        },
      },
    },
  });
  let reminders = 0;
  let reports = 0;
  const reminderProfiles = candidateProfiles.filter((profile) =>
    opsRolesAllowNotification(profile.adminUser.roles, "telegram_task_reminder")
  );
  for (const profile of reminderProfiles) {
    if (!profile.telegramUserId) continue;
    const dueTasks = await input.client.opsTask.findMany({
      where: {
        archivedAt: null,
        assigneeId: profile.adminUserId,
        status: { in: [...ACTIVE_TASK_STATUSES] },
        dueAt: { lte: input.now },
      },
      orderBy: { dueAt: "asc" },
      select: {
        id: true,
        externalId: true,
        title: true,
        dueAt: true,
      },
    });
    if (!dueTasks.length) continue;
    const result = await input.client.opsJob.createMany({
      data: dueTasks.map((task) => ({
        idempotencyKey: `reminder:due-once:${task.id}:${profile.adminUserId}`,
        taskId: task.id,
        type: "telegram_task_reminder",
        status: OpsJobStatus.QUEUED,
        stage: OpsJobStage.NOTIFY,
        payload: asJson({
          taskId: task.id,
          recipientAdminUserId: profile.adminUserId,
          telegramUserId: profile.telegramUserId!.toString(),
          externalId: task.externalId,
          title: task.title,
          dueAt: task.dueAt?.toISOString() ?? null,
        }),
      })),
      skipDuplicates: true,
    });
    reminders += result.count;
  }
  const reportProfiles = candidateProfiles.filter((profile) =>
    opsRolesAllowNotification(profile.adminUser.roles, "telegram_internal_report")
  );
  for (const profile of reportProfiles) {
    if (!profile.telegramUserId) continue;
    const clock = localClock(input.now, profile.timezone);
    if (clock.hour !== 9) continue;
    const day = localDayBounds(clock.date, profile.timezone);
    const counts = await input.client.opsTask.groupBy({
      by: ["status"],
      where: {
        archivedAt: null,
        assigneeId: profile.adminUserId,
        status: { in: [...ACTIVE_TASK_STATUSES] },
      },
      _count: { _all: true },
    });
    const overdueCount = await input.client.opsTask.count({
      where: {
        archivedAt: null,
        assigneeId: profile.adminUserId,
        status: { in: [...ACTIVE_TASK_STATUSES] },
        dueAt: { lt: input.now },
      },
    });
    const activeCount = counts.reduce((sum, row) => sum + row._count._all, 0);
    if (activeCount === 0) continue;
    const [todayCount, withoutDueCount] = await Promise.all([
      input.client.opsTask.count({
        where: {
          archivedAt: null,
          assigneeId: profile.adminUserId,
          status: { in: [...ACTIVE_TASK_STATUSES] },
          dueAt: { gte: day.start, lt: day.end },
        },
      }),
      input.client.opsTask.count({
        where: {
          archivedAt: null,
          assigneeId: profile.adminUserId,
          status: { in: [...ACTIVE_TASK_STATUSES] },
          dueAt: null,
        },
      }),
    ]);
    const result = await input.client.opsJob.createMany({
      data: [
        {
          idempotencyKey: `report:morning:${profile.adminUserId}:${clock.date}`,
          type: "telegram_internal_report",
          status: OpsJobStatus.QUEUED,
          stage: OpsJobStage.NOTIFY,
          payload: asJson({
            reportPeriod: "morning",
            reportDate: clock.date,
            recipientAdminUserId: profile.adminUserId,
            telegramUserId: profile.telegramUserId.toString(),
            overdueCount,
            todayCount,
            withoutDueCount,
            counts: Object.fromEntries(counts.map((row) => [row.status, row._count._all])),
          }),
        },
      ],
      skipDuplicates: true,
    });
    reports += result.count;
  }
  return { reminders, reports };
}

async function cleanupExpiredAttachments(input: {
  client: PrismaClient;
  mediaStore?: OpsPrivateMediaStore;
  now: Date;
}) {
  const attachments = await input.client.opsAttachment.findMany({
    where: {
      pinned: false,
      state: OpsAttachmentState.READY,
      retentionAt: { lte: input.now },
    },
    orderBy: { retentionAt: "asc" },
    take: 20,
    select: { id: true, storageKey: true, sizeBytes: true },
  });
  if (!attachments.length) return { deleted: 0, failed: 0 };
  let store: OpsPrivateMediaStore;
  try {
    store = input.mediaStore ?? createConfiguredOpsMediaStore();
  } catch {
    return { deleted: 0, failed: attachments.length };
  }
  let deleted = 0;
  let failed = 0;
  for (const attachment of attachments) {
    try {
      await store.remove(attachment.storageKey);
      await input.client.opsAttachment.update({
        where: { id: attachment.id },
        data: { state: OpsAttachmentState.DELETED },
      });
      await releaseOpsRetainedStorageBytes({
        client: input.client,
        bytes: attachment.sizeBytes,
      });
      deleted += 1;
    } catch {
      failed += 1;
    }
  }
  return { deleted, failed };
}

export async function runOpsJobsWatchdog(input: {
  client: PrismaClient;
  mediaStore?: OpsPrivateMediaStore;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const expiredCallbackStates = await input.client.opsIdempotencyRecord.findMany({
    where: {
      scope: "telegram.callback",
      expiresAt: { lt: now },
    },
    orderBy: { expiresAt: "asc" },
    take: 100,
    select: { id: true },
  });
  const expiredIdempotencyRecords = await input.client.opsIdempotencyRecord.findMany({
    where: {
      scope: { not: "telegram.callback" },
      expiresAt: { lt: now },
    },
    orderBy: { expiresAt: "asc" },
    take: 250,
    select: { id: true },
  });
  const expiredRateLimits = await input.client.requestRateLimit.findMany({
    where: {
      key: { startsWith: "ops:telegram:" },
      expiresAt: { lt: now },
    },
    orderBy: { expiresAt: "asc" },
    take: 250,
    select: { key: true },
  });
  const [
    leases,
    cancelled,
    notifications,
    retention,
    callbackCleanup,
    idempotencyCleanup,
    rateLimitCleanup,
  ] = await Promise.all([
    reclaimExpiredOpsJobLeases({ client: input.client, now }),
    cancelRequestedOpsJobs({ client: input.client, now }),
    enqueueOpsInternalNotifications({ client: input.client, now }),
    cleanupExpiredAttachments({
      client: input.client,
      mediaStore: input.mediaStore,
      now,
    }),
    expiredCallbackStates.length
      ? input.client.opsIdempotencyRecord.deleteMany({
          where: { id: { in: expiredCallbackStates.map((row) => row.id) } },
        })
      : Promise.resolve({ count: 0 }),
    expiredIdempotencyRecords.length
      ? input.client.opsIdempotencyRecord.deleteMany({
          where: { id: { in: expiredIdempotencyRecords.map((row) => row.id) } },
        })
      : Promise.resolve({ count: 0 }),
    expiredRateLimits.length
      ? input.client.requestRateLimit.deleteMany({
          where: { key: { in: expiredRateLimits.map((row) => row.key) } },
        })
      : Promise.resolve({ count: 0 }),
  ]);
  return {
    leases,
    cancelled,
    notifications,
    retention,
    idempotencyRecordsDeleted: callbackCleanup.count + idempotencyCleanup.count,
    callbackStatesDeleted: callbackCleanup.count,
    rateLimitsDeleted: rateLimitCleanup.count,
    deterministic: true,
    aiUsed: false,
  };
}
