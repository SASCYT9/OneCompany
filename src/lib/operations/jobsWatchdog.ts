import { OpsAttachmentState, type PrismaClient } from "@prisma/client";
import { cancelRequestedOpsJobs, reclaimExpiredOpsJobLeases } from "@/lib/operations/jobs";
import {
  createConfiguredOpsMediaStore,
  releaseOpsRetainedStorageBytes,
  type OpsPrivateMediaStore,
} from "@/lib/operations/media";
import { opsRolesAllowNotification } from "@/lib/operations/notificationAccess";
import { enqueueOpsMemberReminders } from "@/lib/operations/reminders";
import { findPausedOpsTelegramRecipients } from "@/lib/operations/telegramRecipients";

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
      updatedAt: true,
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
  const paused = await findPausedOpsTelegramRecipients(input.client, candidateProfiles);
  const totals = { reminders: 0, reports: 0, reviews: 0, pausedRecipients: paused.size };
  for (const profile of candidateProfiles) {
    if (!profile.telegramUserId || paused.has(profile.adminUserId)) continue;
    if (!opsRolesAllowNotification(profile.adminUser.roles, "telegram_internal_report")) continue;
    const queued = await enqueueOpsMemberReminders({
      client: input.client,
      now: input.now,
      member: {
        adminUserId: profile.adminUserId,
        telegramUserId: profile.telegramUserId,
        timezone: profile.timezone,
        roles: profile.adminUser.roles,
      },
    });
    totals.reminders += queued.nudges;
    totals.reports += queued.digests;
    totals.reviews += queued.reviews;
  }
  return totals;
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
