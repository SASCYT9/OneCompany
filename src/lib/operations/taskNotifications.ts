import { OpsJobStage, OpsJobStatus, type Prisma, type PrismaClient } from "@prisma/client";

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
    assigneeId: string | null;
    dueAt: Date | null;
    version: number;
  };
  assignedBy: {
    id: string;
    name: string | null;
    email: string;
  };
}) {
  const assigneeId = input.task.assigneeId;
  if (!assigneeId || assigneeId === input.assignedBy.id) return false;

  const profile = await input.client.opsMemberProfile.findFirst({
    where: {
      adminUserId: assigneeId,
      telegramEnabled: true,
      telegramUserId: { not: null },
      adminUser: { isActive: true },
    },
    select: {
      adminUserId: true,
      telegramUserId: true,
    },
  });
  if (!profile?.telegramUserId) return false;

  const result = await input.client.opsJob.createMany({
    data: [
      {
        idempotencyKey: [
          "notification",
          "assignment",
          input.task.id,
          assigneeId,
          input.task.version,
        ].join(":"),
        taskId: input.task.id,
        type: "telegram_task_assigned",
        status: OpsJobStatus.QUEUED,
        stage: OpsJobStage.NOTIFY,
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
    ],
    skipDuplicates: true,
  });
  return result.count === 1;
}
