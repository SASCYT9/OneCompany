import { OpsJobStage, OpsJobStatus, type Prisma, type PrismaClient } from "@prisma/client";

import { nextOpsNotifyTime } from "@/lib/operations/reminders";
import { findPausedOpsTelegramRecipients } from "@/lib/operations/telegramRecipients";

type OpsNotificationClient = Prisma.TransactionClient | PrismaClient;

function asJson(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function enqueueOpsTaskAssignmentNotification(input: {
  client: OpsNotificationClient;
  task: {
    id: string;
    externalId: string;
    title: string;
    assigneeId?: string | null;
    assigneeIds?: string[];
    dueAt: Date | null;
    version: number;
  };
  assignedBy: {
    id: string;
    name: string | null;
    email: string;
  };
}) {
  const assigneeIds = Array.from(
    new Set(
      [
        ...(input.task.assigneeIds ?? []),
        ...(input.task.assigneeId ? [input.task.assigneeId] : []),
      ].filter((id) => id && id !== input.assignedBy.id)
    )
  );
  if (!assigneeIds.length) return false;

  const profiles = await input.client.opsMemberProfile.findMany({
    where: {
      adminUserId: { in: assigneeIds },
      telegramEnabled: true,
      telegramUserId: { not: null },
      adminUser: { isActive: true },
    },
    select: {
      adminUserId: true,
      telegramUserId: true,
      timezone: true,
      updatedAt: true,
    },
  });
  const paused = await findPausedOpsTelegramRecipients(input.client, profiles);
  const reachable = profiles.filter((profile) => !paused.has(profile.adminUserId));
  if (!reachable.length) return false;

  const result = await input.client.opsJob.createMany({
    data: reachable.flatMap((profile) =>
      profile.telegramUserId
        ? [
            {
              idempotencyKey: [
                "notification",
                "assignment",
                input.task.id,
                profile.adminUserId,
                input.task.version,
              ].join(":"),
              taskId: input.task.id,
              type: "telegram_task_assigned",
              status: OpsJobStatus.QUEUED,
              stage: OpsJobStage.NOTIFY,
              // Quiet hours: an assignment at 23:00 arrives at 09:00.
              availableAt: nextOpsNotifyTime(new Date(), profile.timezone ?? "Europe/Kyiv"),
              payload: asJson({
                taskId: input.task.id,
                recipientAdminUserId: profile.adminUserId,
                telegramUserId: profile.telegramUserId.toString(),
                externalId: input.task.externalId,
                title: input.task.title,
                dueAt: input.task.dueAt?.toISOString() ?? null,
                assignedById: input.assignedBy.id,
                assignedByName: input.assignedBy.name ?? input.assignedBy.email,
              }),
            },
          ]
        : []
    ),
    skipDuplicates: true,
  });
  return result.count > 0;
}
