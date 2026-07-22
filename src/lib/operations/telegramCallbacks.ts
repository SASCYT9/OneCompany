import crypto from "node:crypto";
import {
  OpsInboxExtractionStatus,
  OpsInboxReviewStatus,
  OpsTaskEventType,
  OpsTaskSourceType,
  OpsTaskStatus,
  type Prisma,
  type PrismaClient,
} from "@prisma/client";
import {
  ADMIN_PERMISSIONS,
  matchesAdminPermission,
  OWNER_ROLE_KEY,
  SUPERADMIN_ROLE_KEY,
} from "@/lib/admin/adminPermissions";
import { opsAttachmentRetentionAt } from "@/lib/operations/media";
import { assertTaskTransition } from "@/lib/operations/tasks";

export const OPS_TELEGRAM_CALLBACK_ACTIONS = [
  "open",
  "start",
  "not_mine",
  "edit",
  "assign",
  "change_due",
  "done",
  "cancel_creation",
] as const;

export type OpsTelegramCallbackAction = (typeof OPS_TELEGRAM_CALLBACK_ACTIONS)[number];

type OpsTelegramCallbackState = {
  action: OpsTelegramCallbackAction;
  resourceId: string;
  actorAdminUserId: string;
};

function signature(value: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(value).digest("base64url").slice(0, 10);
}

function callbackStateHash(value: OpsTelegramCallbackState) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function createOpaqueCallbackData(key: string, secret: string) {
  const base = `op2:${key}`;
  const result = `${base}:${signature(base, secret)}`;
  return Buffer.byteLength(result, "utf8") <= 64 ? result : null;
}

function parseOpaqueCallbackData(data: string | null, secret: string) {
  const match = String(data ?? "").match(/^op2:([a-zA-Z0-9_-]{10,30}):([a-zA-Z0-9_-]{10})$/);
  if (!match) return null;
  const [, key, providedSignature] = match;
  const base = `op2:${key}`;
  const expectedSignature = signature(base, secret);
  const left = Buffer.from(providedSignature);
  const right = Buffer.from(expectedSignature);
  return left.length === right.length && crypto.timingSafeEqual(left, right) ? key : null;
}

export async function createOpsTelegramCallbackState(input: {
  client: PrismaClient;
  action: OpsTelegramCallbackAction;
  resourceId: string;
  actorAdminUserId: string;
  ttlMs?: number;
  secret?: string | null;
}) {
  const secret = String(input.secret ?? process.env.OPS_TELEGRAM_CALLBACK_SECRET ?? "").trim();
  if (!secret || !/^[a-zA-Z0-9_-]{8,40}$/.test(input.resourceId)) return null;
  const state: OpsTelegramCallbackState = {
    action: input.action,
    resourceId: input.resourceId,
    actorAdminUserId: input.actorAdminUserId,
  };
  const key = crypto.randomBytes(9).toString("base64url");
  const callbackData = createOpaqueCallbackData(key, secret);
  if (!callbackData) return null;
  await input.client.opsIdempotencyRecord.create({
    data: {
      scope: "telegram.callback",
      key,
      requestHash: callbackStateHash(state),
      responseBody: state,
      statusCode: 202,
      resourceType: input.action === "cancel_creation" ? "ops.inbox" : "ops.task",
      resourceId: input.resourceId,
      expiresAt: new Date(Date.now() + Math.max(60_000, input.ttlMs ?? 24 * 60 * 60 * 1000)),
    },
  });
  return callbackData;
}

function parseCallbackState(value: unknown): OpsTelegramCallbackState | null {
  const input = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const action = String(input.action ?? "") as OpsTelegramCallbackAction;
  const resourceId = String(input.resourceId ?? "");
  const actorAdminUserId = String(input.actorAdminUserId ?? "");
  if (
    !OPS_TELEGRAM_CALLBACK_ACTIONS.includes(action) ||
    !/^[a-zA-Z0-9_-]{8,40}$/.test(resourceId) ||
    !/^[a-zA-Z0-9_-]{8,40}$/.test(actorAdminUserId)
  ) {
    return null;
  }
  return { action, resourceId, actorAdminUserId };
}

async function claimCallbackState(input: {
  client: PrismaClient;
  callbackData: string | null;
  actorAdminUserId: string;
}) {
  const secret = String(process.env.OPS_TELEGRAM_CALLBACK_SECRET ?? "").trim();
  const key = secret ? parseOpaqueCallbackData(input.callbackData, secret) : null;
  if (!key) throw new Error("TELEGRAM_CALLBACK_INVALID");
  const record = await input.client.opsIdempotencyRecord.findUnique({
    where: {
      scope_key: {
        scope: "telegram.callback",
        key,
      },
    },
    select: {
      id: true,
      requestHash: true,
      responseBody: true,
      statusCode: true,
      expiresAt: true,
    },
  });
  const state = parseCallbackState(record?.responseBody);
  if (
    !record ||
    !state ||
    record.requestHash !== callbackStateHash(state) ||
    record.expiresAt.getTime() < Date.now()
  ) {
    throw new Error("TELEGRAM_CALLBACK_EXPIRED");
  }
  if (state.actorAdminUserId !== input.actorAdminUserId) {
    throw new Error("TELEGRAM_CALLBACK_AUTHOR_MISMATCH");
  }
  const claimed = await input.client.opsIdempotencyRecord.updateMany({
    where: {
      id: record.id,
      statusCode: 202,
      expiresAt: { gt: new Date() },
    },
    data: { statusCode: 102 },
  });
  if (claimed.count !== 1) throw new Error("TELEGRAM_CALLBACK_ALREADY_USED");
  return { id: record.id, state };
}

async function finishCallbackState(input: {
  client: PrismaClient;
  id: string;
  statusCode: 200 | 409;
  state: OpsTelegramCallbackState;
  result: unknown;
}) {
  await input.client.opsIdempotencyRecord.update({
    where: { id: input.id },
    data: {
      statusCode: input.statusCode,
      responseBody: {
        ...input.state,
        usedAt: new Date().toISOString(),
        result: input.result,
      } as Prisma.InputJsonValue,
    },
  });
}

type TelegramActor = {
  id: string;
  email: string;
  name: string | null;
  permissions: string[];
  roleKeys: string[];
  isOwner: boolean;
};

async function resolveActor(client: PrismaClient, adminUserId: string): Promise<TelegramActor> {
  const user = await client.adminUser.findFirst({
    where: { id: adminUserId, isActive: true },
    select: {
      id: true,
      email: true,
      name: true,
      roles: {
        select: {
          role: { select: { key: true, permissions: true } },
        },
      },
    },
  });
  if (!user) throw new Error("TELEGRAM_ACTOR_INACTIVE");
  const roleKeys = Array.from(new Set(user.roles.map(({ role }) => role.key)));
  const permissions = Array.from(new Set(user.roles.flatMap(({ role }) => role.permissions)));
  const isOwner =
    permissions.includes("*") ||
    roleKeys.includes(OWNER_ROLE_KEY) ||
    roleKeys.includes(SUPERADMIN_ROLE_KEY);
  return { ...user, roleKeys, permissions: isOwner ? ["*"] : permissions, isOwner };
}

function requirePermission(actor: TelegramActor, permission: string) {
  if (!matchesAdminPermission(actor.permissions, permission)) {
    throw new Error("TELEGRAM_ACTION_FORBIDDEN");
  }
}

function canWriteTask(
  actor: TelegramActor,
  task: { assigneeId: string | null; createdById: string; isShared?: boolean }
) {
  requirePermission(actor, ADMIN_PERMISSIONS.OPS_TASKS_WRITE);
  if (
    actor.isOwner ||
    matchesAdminPermission(actor.permissions, ADMIN_PERMISSIONS.OPS_TASKS_ASSIGN) ||
    task.isShared === true ||
    task.assigneeId === actor.id ||
    task.createdById === actor.id
  ) {
    return;
  }
  throw new Error("TELEGRAM_ACTION_FORBIDDEN");
}

function auditData(
  actor: TelegramActor,
  action: string,
  entityType: string,
  entityId: string,
  metadata?: Prisma.InputJsonValue
) {
  return {
    actorId: actor.id,
    actorEmail: actor.email,
    actorName: actor.name,
    scope: "operations",
    action,
    entityType,
    entityId,
    metadata,
  };
}

function adminLink(path: string) {
  const baseUrl = String(process.env.OPS_ADMIN_BASE_URL ?? "")
    .trim()
    .replace(/\/+$/, "");
  return baseUrl ? `${baseUrl}${path}` : null;
}

async function cancelInboxCreation(input: {
  client: PrismaClient;
  actor: TelegramActor;
  inboxItemId: string;
}) {
  return input.client.$transaction(async (tx) => {
    const inbox = await tx.opsInboxItem.findUnique({
      where: { id: input.inboxItemId },
      select: {
        id: true,
        reviewStatus: true,
        appliedTaskIds: true,
        undoExpiresAt: true,
        telegramUpdate: {
          select: { telegramUserId: true },
        },
      },
    });
    if (!inbox) throw new Error("CALLBACK_RESOURCE_NOT_FOUND");
    const origin = inbox.telegramUpdate.telegramUserId
      ? await tx.opsMemberProfile.findUnique({
          where: { telegramUserId: inbox.telegramUpdate.telegramUserId },
          select: { adminUserId: true },
        })
      : null;
    if (origin?.adminUserId === input.actor.id) {
      requirePermission(input.actor, ADMIN_PERMISSIONS.OPS_TASKS_WRITE);
    } else {
      requirePermission(input.actor, ADMIN_PERMISSIONS.OPS_INBOX_REVIEW);
    }

    if (
      inbox.reviewStatus === OpsInboxReviewStatus.UNDONE ||
      inbox.reviewStatus === OpsInboxReviewStatus.IGNORED
    ) {
      return { message: "Создание уже было отменено.", cancelled: 0 };
    }
    if (inbox.reviewStatus === OpsInboxReviewStatus.PENDING) {
      await tx.opsInboxItem.update({
        where: { id: inbox.id },
        data: {
          reviewStatus: OpsInboxReviewStatus.IGNORED,
          reviewedAt: new Date(),
        },
      });
      await tx.adminAuditLog.create({
        data: auditData(input.actor, "telegram.inbox.cancel_preview", "ops.inbox", inbox.id),
      });
      return { message: "Создание отменено. Сообщение осталось в истории.", cancelled: 0 };
    }

    if (
      inbox.reviewStatus !== OpsInboxReviewStatus.APPLIED ||
      !inbox.undoExpiresAt ||
      inbox.undoExpiresAt.getTime() < Date.now()
    ) {
      throw new Error("UNDO_WINDOW_EXPIRED");
    }
    const tasks = await tx.opsTask.findMany({
      where: { id: { in: inbox.appliedTaskIds } },
      select: {
        id: true,
        status: true,
        version: true,
        assigneeId: true,
        createdById: true,
        isShared: true,
      },
    });
    if (tasks.length === 0 || tasks.length !== new Set(inbox.appliedTaskIds).size) {
      throw new Error("UNDO_TASK_CHANGED");
    }
    for (const task of tasks) {
      canWriteTask(input.actor, task);
      if (task.version !== 1 || task.status !== OpsTaskStatus.INBOX) {
        throw new Error("UNDO_TASK_CHANGED");
      }
    }
    let cancelled = 0;
    for (const task of tasks) {
      const changed = await tx.opsTask.updateMany({
        where: {
          id: task.id,
          version: 1,
          status: OpsTaskStatus.INBOX,
        },
        data: {
          status: OpsTaskStatus.CANCELLED,
          completedAt: null,
          blockerType: null,
          blockerDescription: null,
          version: { increment: 1 },
        },
      });
      if (changed.count !== 1) throw new Error("UNDO_TASK_CHANGED");
      await tx.opsTaskEvent.create({
        data: {
          taskId: task.id,
          type: OpsTaskEventType.UNDONE,
          actorId: input.actor.id,
          sourceType: OpsTaskSourceType.TELEGRAM,
          sourceId: inbox.id,
          idempotencyKey: `telegram:undo:${inbox.id}:${task.id}`,
          payload: {
            fromStatus: task.status,
            toStatus: OpsTaskStatus.CANCELLED,
            deleted: false,
          },
        },
      });
      cancelled += 1;
    }
    const linkedAttachments = await tx.opsTaskAttachment.findMany({
      where: { taskId: { in: tasks.map((task) => task.id) } },
      select: { attachmentId: true },
    });
    const attachmentIds = Array.from(new Set(linkedAttachments.map((entry) => entry.attachmentId)));
    if (attachmentIds.length) {
      await tx.opsAttachment.updateMany({
        where: {
          id: { in: attachmentIds },
          tasks: {
            none: {
              task: {
                archivedAt: null,
                status: {
                  notIn: [OpsTaskStatus.DONE, OpsTaskStatus.CANCELLED],
                },
              },
            },
          },
        },
        data: { retentionAt: opsAttachmentRetentionAt() },
      });
    }
    await tx.opsInboxProposal.updateMany({
      where: {
        inboxItemId: inbox.id,
        status: "APPLIED",
      },
      data: { status: "REJECTED" },
    });
    await tx.opsInboxItem.update({
      where: { id: inbox.id },
      data: {
        reviewStatus: OpsInboxReviewStatus.UNDONE,
        reviewedAt: new Date(),
      },
    });
    await tx.adminAuditLog.create({
      data: auditData(input.actor, "telegram.inbox.undo", "ops.inbox", inbox.id, {
        taskIds: tasks.map((task) => task.id),
        cancelled,
        deleted: false,
      }),
    });
    return {
      message: `Создание отменено. Задачи переведены в «Отменено»: ${cancelled}.`,
      cancelled,
    };
  });
}

async function markTaskDone(input: { client: PrismaClient; actor: TelegramActor; taskId: string }) {
  return input.client.$transaction(async (tx) => {
    const task = await tx.opsTask.findUnique({
      where: { id: input.taskId },
      select: {
        id: true,
        externalId: true,
        status: true,
        version: true,
        assigneeId: true,
        createdById: true,
        isShared: true,
      },
    });
    if (!task) throw new Error("CALLBACK_RESOURCE_NOT_FOUND");
    canWriteTask(input.actor, task);
    if (task.status === OpsTaskStatus.DONE) {
      return {
        message: `${task.externalId} уже отмечена выполненной.`,
        link: adminLink(`/admin/operations/tasks/${task.id}`),
      };
    }
    assertTaskTransition(task.status, OpsTaskStatus.DONE, {
      reopen: false,
      comment: null,
    });
    const changed = await tx.opsTask.updateMany({
      where: {
        id: task.id,
        version: task.version,
        status: task.status,
      },
      data: {
        status: OpsTaskStatus.DONE,
        completedAt: new Date(),
        version: { increment: 1 },
      },
    });
    if (changed.count !== 1) throw new Error("TASK_VERSION_CONFLICT");
    const taskAttachments = await tx.opsTaskAttachment.findMany({
      where: { taskId: task.id },
      select: { attachmentId: true },
    });
    const attachmentIds = taskAttachments.map((entry) => entry.attachmentId);
    if (attachmentIds.length) {
      await tx.opsAttachment.updateMany({
        where: {
          id: { in: attachmentIds },
          tasks: {
            none: {
              task: {
                archivedAt: null,
                status: {
                  notIn: [OpsTaskStatus.DONE, OpsTaskStatus.CANCELLED],
                },
              },
            },
          },
        },
        data: { retentionAt: opsAttachmentRetentionAt() },
      });
    }
    await tx.opsTaskEvent.create({
      data: {
        taskId: task.id,
        type: OpsTaskEventType.STATUS_CHANGED,
        actorId: input.actor.id,
        sourceType: OpsTaskSourceType.TELEGRAM,
        sourceId: task.id,
        idempotencyKey: `telegram:done:${task.id}`,
        payload: { fromStatus: task.status, toStatus: OpsTaskStatus.DONE },
      },
    });
    await tx.adminAuditLog.create({
      data: auditData(input.actor, "telegram.task.done", "ops.task", task.id, {
        fromStatus: task.status,
        toStatus: OpsTaskStatus.DONE,
      }),
    });
    return {
      message: `${task.externalId} отмечена выполненной.`,
      link: adminLink(`/admin/operations/tasks/${task.id}`),
    };
  });
}

async function startTask(input: { client: PrismaClient; actor: TelegramActor; taskId: string }) {
  return input.client.$transaction(async (tx) => {
    const task = await tx.opsTask.findUnique({
      where: { id: input.taskId },
      select: {
        id: true,
        externalId: true,
        status: true,
        version: true,
        assigneeId: true,
        createdById: true,
        isShared: true,
      },
    });
    if (!task) throw new Error("CALLBACK_RESOURCE_NOT_FOUND");
    canWriteTask(input.actor, task);
    if (!task.isShared && task.assigneeId !== input.actor.id) {
      throw new Error("TELEGRAM_ACTION_FORBIDDEN");
    }
    if (task.status === OpsTaskStatus.IN_PROGRESS) {
      return {
        message: `${task.externalId} уже в работе.`,
        link: adminLink(`/admin/operations/tasks/${task.id}`),
      };
    }
    assertTaskTransition(task.status, OpsTaskStatus.IN_PROGRESS, {
      reopen: false,
      comment: null,
    });
    const changed = await tx.opsTask.updateMany({
      where: {
        id: task.id,
        version: task.version,
        status: task.status,
        ...(task.isShared ? { isShared: true } : { assigneeId: input.actor.id }),
      },
      data: {
        status: OpsTaskStatus.IN_PROGRESS,
        completedAt: null,
        blockerType: null,
        blockerDescription: null,
        version: { increment: 1 },
      },
    });
    if (changed.count !== 1) throw new Error("TASK_VERSION_CONFLICT");
    await tx.opsTaskEvent.create({
      data: {
        taskId: task.id,
        type: OpsTaskEventType.STATUS_CHANGED,
        actorId: input.actor.id,
        sourceType: OpsTaskSourceType.TELEGRAM,
        sourceId: task.id,
        payload: { fromStatus: task.status, toStatus: OpsTaskStatus.IN_PROGRESS },
      },
    });
    await tx.adminAuditLog.create({
      data: auditData(input.actor, "telegram.task.start", "ops.task", task.id, {
        fromStatus: task.status,
        toStatus: OpsTaskStatus.IN_PROGRESS,
      }),
    });
    return {
      message: `${task.externalId} переведена в работу.`,
      link: adminLink(`/admin/operations/tasks/${task.id}`),
    };
  });
}

async function rejectTaskAssignment(input: {
  client: PrismaClient;
  actor: TelegramActor;
  taskId: string;
}) {
  return input.client.$transaction(async (tx) => {
    const task = await tx.opsTask.findUnique({
      where: { id: input.taskId },
      select: {
        id: true,
        externalId: true,
        version: true,
        assigneeId: true,
        createdById: true,
        isShared: true,
      },
    });
    if (!task) throw new Error("CALLBACK_RESOURCE_NOT_FOUND");
    canWriteTask(input.actor, task);
    if (task.isShared) {
      return {
        message: `${task.externalId} назначена всей команде и остаётся общей.`,
        link: adminLink(`/admin/operations/tasks/${task.id}`),
      };
    }
    if (task.assigneeId !== input.actor.id) {
      return {
        message: `${task.externalId} уже не назначена вам.`,
        link: adminLink(`/admin/operations/tasks/${task.id}`),
      };
    }
    const changed = await tx.opsTask.updateMany({
      where: {
        id: task.id,
        version: task.version,
        assigneeId: input.actor.id,
      },
      data: {
        assigneeId: null,
        version: { increment: 1 },
      },
    });
    if (changed.count !== 1) throw new Error("TASK_VERSION_CONFLICT");
    await tx.opsTaskEvent.create({
      data: {
        taskId: task.id,
        type: OpsTaskEventType.ASSIGNED,
        actorId: input.actor.id,
        sourceType: OpsTaskSourceType.TELEGRAM,
        sourceId: task.id,
        payload: {
          assigneeIdFrom: input.actor.id,
          assigneeIdTo: null,
          reason: "recipient_marked_not_mine",
        },
      },
    });
    await tx.adminAuditLog.create({
      data: auditData(input.actor, "telegram.task.not_mine", "ops.task", task.id, {
        assigneeIdFrom: input.actor.id,
        assigneeIdTo: null,
      }),
    });
    return {
      message: `${task.externalId} снята с вас и возвращена в задачи без исполнителя.`,
      link: adminLink(`/admin/operations/tasks/${task.id}`),
    };
  });
}

export async function executeOpsTelegramCallback(input: {
  client: PrismaClient;
  actorAdminUserId: string;
  callbackData: string | null;
}) {
  const actor = await resolveActor(input.client, input.actorAdminUserId);
  const claimed = await claimCallbackState({
    client: input.client,
    callbackData: input.callbackData,
    actorAdminUserId: actor.id,
  });
  try {
    let result;
    if (claimed.state.action === "cancel_creation") {
      result = await cancelInboxCreation({
        client: input.client,
        actor,
        inboxItemId: claimed.state.resourceId,
      });
    } else if (claimed.state.action === "done") {
      result = await markTaskDone({
        client: input.client,
        actor,
        taskId: claimed.state.resourceId,
      });
    } else if (claimed.state.action === "start") {
      result = await startTask({
        client: input.client,
        actor,
        taskId: claimed.state.resourceId,
      });
    } else if (claimed.state.action === "not_mine") {
      result = await rejectTaskAssignment({
        client: input.client,
        actor,
        taskId: claimed.state.resourceId,
      });
    } else {
      requirePermission(actor, ADMIN_PERMISSIONS.OPS_TASKS_READ);
      const task = await input.client.opsTask.findUnique({
        where: { id: claimed.state.resourceId },
        select: {
          id: true,
          externalId: true,
          assigneeId: true,
          createdById: true,
          isShared: true,
        },
      });
      if (!task) throw new Error("CALLBACK_RESOURCE_NOT_FOUND");
      if (claimed.state.action === "assign") {
        requirePermission(actor, ADMIN_PERMISSIONS.OPS_TASKS_ASSIGN);
      } else if (claimed.state.action === "edit" || claimed.state.action === "change_due") {
        canWriteTask(actor, task);
      }
      const query =
        claimed.state.action === "open"
          ? ""
          : `?action=${encodeURIComponent(claimed.state.action)}`;
      result = {
        message: `${task.externalId}: открыть действие «${claimed.state.action}» в админке.`,
        link: adminLink(`/admin/operations/tasks/${task.id}${query}`),
      };
    }
    await finishCallbackState({
      client: input.client,
      id: claimed.id,
      statusCode: 200,
      state: claimed.state,
      result,
    });
    return result;
  } catch (error) {
    const code = error instanceof Error ? error.message : "TELEGRAM_CALLBACK_FAILED";
    const businessError =
      code === "TELEGRAM_ACTION_FORBIDDEN" ||
      code === "CALLBACK_RESOURCE_NOT_FOUND" ||
      code === "UNDO_WINDOW_EXPIRED" ||
      code === "UNDO_TASK_CHANGED" ||
      code === "TASK_VERSION_CONFLICT" ||
      (error instanceof Error && error.name === "OpsError");
    if (businessError) {
      await finishCallbackState({
        client: input.client,
        id: claimed.id,
        statusCode: 409,
        state: claimed.state,
        result: { error: code },
      });
    } else {
      await input.client.opsIdempotencyRecord.updateMany({
        where: { id: claimed.id, statusCode: 102 },
        data: { statusCode: 202 },
      });
    }
    throw error;
  }
}

export async function finalizeTelegramCallbackInbox(input: {
  client: PrismaClient;
  inboxItemId: string;
  message: string;
}) {
  await input.client.opsInboxItem.update({
    where: { id: input.inboxItemId },
    data: {
      extractionStatus: OpsInboxExtractionStatus.READY,
      reviewStatus: OpsInboxReviewStatus.IGNORED,
      summary: input.message,
      confidence: "1.00",
      processedAt: new Date(),
      reviewedAt: new Date(),
    },
  });
}
