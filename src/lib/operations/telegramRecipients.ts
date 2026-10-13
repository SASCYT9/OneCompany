import { OpsJobStatus, type Prisma, type PrismaClient } from "@prisma/client";

import { OPS_INTERNAL_NOTIFICATION_TYPES } from "@/lib/operations/notificationAccess";
import { OPS_TELEGRAM_RECIPIENT_UNAVAILABLE } from "@/lib/operations/notifications";

type OpsRecipientClient = Prisma.TransactionClient | PrismaClient;

export type OpsTelegramRecipientCandidate = {
  adminUserId: string;
  telegramUserId: bigint | null;
  /** A later save of the member's Telegram settings resumes notifications. */
  updatedAt: Date;
};

export type OpsPausedTelegramRecipient = {
  adminUserId: string;
  pausedAt: Date;
};

// Before TELEGRAM_RECIPIENT_UNAVAILABLE existed, a blocked bot ended as a
// dead-lettered TELEGRAM_SEND_FAILED with HTTP 403 in the message.
const LEGACY_BLOCKED_ERROR = "returned 403";

/**
 * Members whose last internal notification could not be delivered because the
 * bot is blocked or the chat is gone. They stay paused until they write to the
 * bot again or an admin re-saves their Telegram settings, so nobody gets a
 * daily stream of failed sends.
 */
export async function findPausedOpsTelegramRecipients(
  client: OpsRecipientClient,
  candidates: OpsTelegramRecipientCandidate[]
): Promise<Map<string, OpsPausedTelegramRecipient>> {
  const paused = new Map<string, OpsPausedTelegramRecipient>();
  const linked = candidates.filter((candidate) => candidate.telegramUserId !== null);
  if (!linked.length) return paused;

  const failures = await client.opsJob.findMany({
    where: {
      type: { in: [...OPS_INTERNAL_NOTIFICATION_TYPES] },
      finishedAt: { not: null },
      OR: [
        {
          status: OpsJobStatus.SUCCEEDED,
          result: { path: ["notification"], equals: "recipient_unavailable" },
        },
        {
          // Closed from the System page counts too: closing hides, not fixes.
          status: { in: [OpsJobStatus.DEAD_LETTER, OpsJobStatus.CANCELLED] },
          errorType: { in: ["TELEGRAM_SEND_FAILED", OPS_TELEGRAM_RECIPIENT_UNAVAILABLE] },
          errorMessage: { contains: LEGACY_BLOCKED_ERROR },
        },
      ],
    },
    orderBy: { finishedAt: "desc" },
    take: 200,
    select: { payload: true, finishedAt: true },
  });

  // Newest first, so the first entry per member is the latest failure.
  const failuresByMember = new Map<string, Date[]>();
  for (const failure of failures) {
    const payload = (failure.payload ?? {}) as Record<string, unknown>;
    const adminUserId = String(payload.recipientAdminUserId ?? "");
    if (!adminUserId || !failure.finishedAt) continue;
    failuresByMember.set(adminUserId, [
      ...(failuresByMember.get(adminUserId) ?? []),
      failure.finishedAt,
    ]);
  }

  for (const candidate of linked) {
    const memberFailures = failuresByMember.get(candidate.adminUserId);
    const lastFailure = memberFailures?.[0];
    if (!memberFailures || !lastFailure || candidate.updatedAt > lastFailure) continue;
    const lastDelivered = await client.opsJob.findFirst({
      where: {
        type: { in: [...OPS_INTERNAL_NOTIFICATION_TYPES] },
        status: OpsJobStatus.SUCCEEDED,
        payload: { path: ["recipientAdminUserId"], equals: candidate.adminUserId },
        result: { path: ["notification"], equals: "sent" },
      },
      orderBy: { finishedAt: "desc" },
      select: { finishedAt: true },
    });
    const deliveredAt = lastDelivered?.finishedAt ?? null;
    if (deliveredAt && deliveredAt > lastFailure) continue;
    const wroteSince = await client.opsTelegramUpdate.count({
      where: { telegramUserId: candidate.telegramUserId, receivedAt: { gt: lastFailure } },
    });
    if (wroteSince > 0) continue;
    // The pause began with the first failure after the last delivered message.
    const streak = memberFailures.filter((failedAt) => !deliveredAt || failedAt > deliveredAt);
    paused.set(candidate.adminUserId, {
      adminUserId: candidate.adminUserId,
      pausedAt: streak[streak.length - 1] ?? lastFailure,
    });
  }
  return paused;
}
