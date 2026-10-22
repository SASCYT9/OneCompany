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
import { opsAdminLink } from "@/lib/operations/adminLinks";
import { applyLeadTimeMarks, undoLeadTimeMarks } from "@/lib/operations/leadTimeMarks";
import { orderClientText } from "@/lib/operations/orderCard";
import {
  buildProductCard,
  canChangePrices,
  cancelPriceChange,
  clientTextForProduct,
  confirmPriceChange,
  deliveryPromptForProduct,
  proposeFormulaForProduct,
  proposeFormulaForSource,
  undoPriceChange,
  type PriceButtonFactory,
  type PriceReply,
} from "@/lib/operations/priceChanges";
import {
  acknowledgePriceList,
  createPriceListTask,
  createPriceWatchDigestTask,
  currentLeadTimePlan,
  snoozePriceList,
} from "@/lib/operations/priceWatch";
import {
  opsRepeatLabel,
  opsRepeatRuleFromTags,
  withOpsRepeatRule,
  type OpsRepeatRule,
} from "@/lib/operations/recurrence";
import { opsSnoozeDueAt, type OpsSnoozeKind } from "@/lib/operations/reminders";
import { enqueueOpsTaskAssignmentNotification } from "@/lib/operations/taskNotifications";
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
  "undo_task_update",
  "snooze_tomorrow",
  "snooze_week",
  "cancel_task",
  "take",
  "assign_to",
  "merge_into",
  "price_digest_task",
  "price_ack",
  "price_snooze",
  "price_list_task",
  "price_formula",
  "price_apply",
  "price_apply_big",
  "price_cancel",
  "price_undo",
  "price_card_formula",
  "price_card_client_text",
  "price_lead_mark",
  "price_lead_clear",
  "price_lead_undo",
  "price_card_open",
  "order_client_text",
  "price_card_delivery",
] as const;

/** Site lead times from the digest: the resource is the digest job; undo — the change. */
const PRICE_LEAD_ACTIONS: readonly OpsTelegramCallbackAction[] = [
  "price_lead_mark",
  "price_lead_clear",
  "price_lead_undo",
];

/** Product card buttons: the resource is the product, the value its variant; the order's text. */
const PRICE_CARD_ACTIONS: readonly OpsTelegramCallbackAction[] = [
  "price_card_formula",
  "price_card_client_text",
  "price_card_delivery",
  "price_card_open",
  "order_client_text",
];

/** Price watch buttons: the resource is a price source, or the digest job for a task. */
const PRICE_SOURCE_ACTIONS: readonly OpsTelegramCallbackAction[] = [
  "price_ack",
  "price_snooze",
  "price_list_task",
  "price_formula",
];
/** Price change buttons: the resource is the change shown in the preview. */
const PRICE_CHANGE_ACTIONS: readonly OpsTelegramCallbackAction[] = [
  "price_apply",
  "price_apply_big",
  "price_cancel",
  "price_undo",
];

export type OpsTelegramCallbackAction = (typeof OPS_TELEGRAM_CALLBACK_ACTIONS)[number];

type OpsTelegramCallbackState = {
  action: OpsTelegramCallbackAction;
  resourceId: string;
  actorAdminUserId: string;
  /** Extra argument, e.g. the member chosen by «👤 Кому?». */
  value?: string;
};

const CALLBACK_ID_PATTERN = /^[a-zA-Z0-9_-]{8,40}$/;

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
  client: PrismaClient | Prisma.TransactionClient;
  action: OpsTelegramCallbackAction;
  resourceId: string;
  actorAdminUserId: string;
  value?: string;
  ttlMs?: number;
  secret?: string | null;
}) {
  const secret = String(input.secret ?? process.env.OPS_TELEGRAM_CALLBACK_SECRET ?? "").trim();
  if (!secret || !CALLBACK_ID_PATTERN.test(input.resourceId)) return null;
  if (input.value !== undefined && !CALLBACK_ID_PATTERN.test(input.value)) return null;
  const state: OpsTelegramCallbackState = {
    action: input.action,
    resourceId: input.resourceId,
    actorAdminUserId: input.actorAdminUserId,
    ...(input.value !== undefined ? { value: input.value } : {}),
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
      resourceType:
        input.action === "cancel_creation"
          ? "ops.inbox"
          : input.action === "undo_task_update"
            ? "ops.task_event"
            : input.action === "price_digest_task" ||
                input.action === "price_lead_mark" ||
                input.action === "price_lead_clear"
              ? "ops.job"
              : PRICE_SOURCE_ACTIONS.includes(input.action)
                ? "ops.price_source"
                : PRICE_CHANGE_ACTIONS.includes(input.action) || input.action === "price_lead_undo"
                  ? "ops.price_change"
                  : input.action === "order_client_text"
                    ? "shop.order"
                    : PRICE_CARD_ACTIONS.includes(input.action)
                      ? "shop.product"
                      : "ops.task",
      resourceId: input.resourceId,
      expiresAt: new Date(Date.now() + Math.max(60_000, input.ttlMs ?? 24 * 60 * 60 * 1000)),
    },
  });
  return callbackData;
}

function parseCallbackState(stored: unknown): OpsTelegramCallbackState | null {
  const input = (stored && typeof stored === "object" ? stored : {}) as Record<string, unknown>;
  const action = String(input.action ?? "") as OpsTelegramCallbackAction;
  const resourceId = String(input.resourceId ?? "");
  const actorAdminUserId = String(input.actorAdminUserId ?? "");
  const value = input.value === undefined ? undefined : String(input.value);
  if (
    !OPS_TELEGRAM_CALLBACK_ACTIONS.includes(action) ||
    !CALLBACK_ID_PATTERN.test(resourceId) ||
    !CALLBACK_ID_PATTERN.test(actorAdminUserId) ||
    (value !== undefined && !CALLBACK_ID_PATTERN.test(value))
  ) {
    return null;
  }
  return { action, resourceId, actorAdminUserId, ...(value !== undefined ? { value } : {}) };
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
  task: {
    assigneeId: string | null;
    createdById: string;
    isShared?: boolean;
    assignees?: Array<{ adminUserId: string }>;
  }
) {
  requirePermission(actor, ADMIN_PERMISSIONS.OPS_TASKS_WRITE);
  if (
    actor.isOwner ||
    matchesAdminPermission(actor.permissions, ADMIN_PERMISSIONS.OPS_TASKS_ASSIGN) ||
    task.isShared === true ||
    task.assignees?.some((assignment) => assignment.adminUserId === actor.id) ||
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
  return opsAdminLink(path);
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
        assignees: { select: { adminUserId: true } },
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

async function undoTaskProgressUpdate(input: {
  client: PrismaClient;
  actor: TelegramActor;
  eventId: string;
}) {
  return input.client.$transaction(async (tx) => {
    const event = await tx.opsTaskEvent.findUnique({
      where: { id: input.eventId },
      select: {
        id: true,
        type: true,
        payload: true,
        task: {
          select: {
            id: true,
            number: true,
            title: true,
            version: true,
            assigneeId: true,
            assignees: { select: { adminUserId: true } },
            createdById: true,
            isShared: true,
          },
        },
      },
    });
    if (!event || event.type !== OpsTaskEventType.UPDATED) {
      throw new Error("CALLBACK_RESOURCE_NOT_FOUND");
    }
    canWriteTask(input.actor, event.task);
    const payload =
      event.payload && typeof event.payload === "object" && !Array.isArray(event.payload)
        ? (event.payload as Record<string, unknown>)
        : {};
    if (payload.kind !== "progress_update") throw new Error("UNDO_TASK_CHANGED");
    const appliedVersion = Number(payload.version);
    if (!Number.isSafeInteger(appliedVersion) || event.task.version !== appliedVersion) {
      throw new Error("UNDO_TASK_CHANGED");
    }
    const descriptionBefore =
      typeof payload.descriptionBefore === "string" ? payload.descriptionBefore : null;
    const nextActionBefore =
      typeof payload.nextActionBefore === "string" ? payload.nextActionBefore : null;
    const titleBefore =
      typeof payload.titleBefore === "string" ? payload.titleBefore : event.task.title;
    const definitionOfDoneBefore =
      typeof payload.definitionOfDoneBefore === "string" ? payload.definitionOfDoneBefore : null;
    const tagsBefore = Array.isArray(payload.tagsBefore)
      ? payload.tagsBefore
          .map((tag) => String(tag).trim())
          .filter(Boolean)
          .slice(0, 50)
      : [];
    const fields = Array.isArray(payload.fields)
      ? payload.fields.map((field) => String(field))
      : ["description", "nextAction"];
    const changed = await tx.opsTask.updateMany({
      where: { id: event.task.id, version: appliedVersion },
      data: {
        ...(fields.includes("title") ? { title: titleBefore } : {}),
        ...(fields.includes("description") ? { description: descriptionBefore } : {}),
        ...(fields.includes("nextAction") ? { nextAction: nextActionBefore } : {}),
        ...(fields.includes("definitionOfDone")
          ? { definitionOfDone: definitionOfDoneBefore }
          : {}),
        ...(fields.includes("tags") ? { tags: tagsBefore } : {}),
        version: { increment: 1 },
      },
    });
    if (changed.count !== 1) throw new Error("UNDO_TASK_CHANGED");
    await tx.opsTaskEvent.create({
      data: {
        taskId: event.task.id,
        type: OpsTaskEventType.UNDONE,
        actorId: input.actor.id,
        sourceType: OpsTaskSourceType.TELEGRAM,
        sourceId: event.id,
        idempotencyKey: `telegram:undo-task-update:${event.id}`,
        payload: {
          kind: "progress_update_undo",
          revertedEventId: event.id,
          taskNumber: event.task.number,
          previousVersion: appliedVersion,
          version: appliedVersion + 1,
        },
      },
    });
    await tx.adminAuditLog.create({
      data: auditData(
        input.actor,
        "telegram.task.progress_update_undo",
        "ops.task",
        event.task.id,
        { eventId: event.id, taskNumber: event.task.number }
      ),
    });
    return {
      message: `Обновление задачи #${event.task.number} отменено.`,
      link: adminLink(`/admin/operations/tasks/${event.task.id}`),
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
        assignees: { select: { adminUserId: true } },
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
        assignees: { select: { adminUserId: true } },
        createdById: true,
        isShared: true,
      },
    });
    if (!task) throw new Error("CALLBACK_RESOURCE_NOT_FOUND");
    canWriteTask(input.actor, task);
    if (
      !task.isShared &&
      task.assigneeId !== input.actor.id &&
      !task.assignees.some((assignment) => assignment.adminUserId === input.actor.id)
    ) {
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
        ...(task.isShared
          ? { isShared: true }
          : {
              OR: [
                { assignees: { some: { adminUserId: input.actor.id } } },
                { assigneeId: input.actor.id },
              ],
            }),
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
        assignees: {
          orderBy: { createdAt: "asc" },
          select: { adminUserId: true },
        },
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
    const actorIsAssigned =
      task.assigneeId === input.actor.id ||
      task.assignees.some((assignment) => assignment.adminUserId === input.actor.id);
    if (!actorIsAssigned) {
      return {
        message: `${task.externalId} уже не назначена вам.`,
        link: adminLink(`/admin/operations/tasks/${task.id}`),
      };
    }
    const remainingAssigneeIds = task.assignees
      .map((assignment) => assignment.adminUserId)
      .filter((adminUserId) => adminUserId !== input.actor.id);
    const nextPrimaryAssigneeId = remainingAssigneeIds[0] ?? null;
    const changed = await tx.opsTask.updateMany({
      where: {
        id: task.id,
        version: task.version,
        OR: [
          { assignees: { some: { adminUserId: input.actor.id } } },
          { assigneeId: input.actor.id },
        ],
      },
      data: {
        assigneeId: nextPrimaryAssigneeId,
        version: { increment: 1 },
      },
    });
    if (changed.count !== 1) throw new Error("TASK_VERSION_CONFLICT");
    const actorAssignment = await tx.opsTaskAssignee.findUnique({
      where: {
        taskId_adminUserId: {
          taskId: task.id,
          adminUserId: input.actor.id,
        },
      },
      select: { id: true },
    });
    if (actorAssignment) {
      await tx.opsTaskAssignee.delete({ where: { id: actorAssignment.id } });
    }
    await tx.opsTaskEvent.create({
      data: {
        taskId: task.id,
        type: OpsTaskEventType.ASSIGNED,
        actorId: input.actor.id,
        sourceType: OpsTaskSourceType.TELEGRAM,
        sourceId: task.id,
        payload: {
          assigneeIdFrom: input.actor.id,
          assigneeIdTo: nextPrimaryAssigneeId,
          assigneeIdsTo: remainingAssigneeIds,
          reason: "recipient_marked_not_mine",
        },
      },
    });
    await tx.adminAuditLog.create({
      data: auditData(input.actor, "telegram.task.not_mine", "ops.task", task.id, {
        assigneeIdFrom: input.actor.id,
        assigneeIdTo: nextPrimaryAssigneeId,
        assigneeIdsTo: remainingAssigneeIds,
      }),
    });
    return {
      message: `${task.externalId} снята с вас и возвращена в задачи без исполнителя.`,
      link: adminLink(`/admin/operations/tasks/${task.id}`),
    };
  });
}

async function snoozeTask(input: {
  client: PrismaClient;
  actor: TelegramActor;
  taskId: string;
  kind: OpsSnoozeKind | "date";
  /** Required for kind "date": the new deadline parsed from a reply. */
  dueAt?: Date;
}) {
  const profile = await input.client.opsMemberProfile.findUnique({
    where: { adminUserId: input.actor.id },
    select: { timezone: true },
  });
  const dueAt =
    input.kind === "date"
      ? input.dueAt
      : opsSnoozeDueAt(input.kind, new Date(), profile?.timezone ?? "Europe/Kyiv");
  if (!dueAt || Number.isNaN(dueAt.getTime())) throw new Error("TELEGRAM_CALLBACK_INVALID");
  return input.client.$transaction(async (tx) => {
    const task = await tx.opsTask.findUnique({
      where: { id: input.taskId },
      select: {
        id: true,
        number: true,
        status: true,
        version: true,
        dueAt: true,
        assigneeId: true,
        assignees: { select: { adminUserId: true } },
        createdById: true,
        isShared: true,
      },
    });
    if (!task) throw new Error("CALLBACK_RESOURCE_NOT_FOUND");
    canWriteTask(input.actor, task);
    if (task.status === OpsTaskStatus.DONE || task.status === OpsTaskStatus.CANCELLED) {
      return {
        message: `#${task.number} уже закрыта, срок не меняю.`,
        link: adminLink(`/admin/operations/tasks/${task.id}`),
      };
    }
    const changed = await tx.opsTask.updateMany({
      where: { id: task.id, version: task.version },
      data: { dueAt, version: { increment: 1 } },
    });
    if (changed.count !== 1) throw new Error("TASK_VERSION_CONFLICT");
    await tx.opsTaskEvent.create({
      data: {
        taskId: task.id,
        type: OpsTaskEventType.UPDATED,
        actorId: input.actor.id,
        sourceType: OpsTaskSourceType.TELEGRAM,
        sourceId: task.id,
        payload: {
          changes: ["dueAt"],
          dueAtFrom: task.dueAt?.toISOString() ?? null,
          dueAtTo: dueAt.toISOString(),
          reason: `telegram_snooze_${input.kind}`,
        },
      },
    });
    await tx.adminAuditLog.create({
      data: auditData(input.actor, "telegram.task.snooze", "ops.task", task.id, {
        kind: input.kind,
        dueAtFrom: task.dueAt?.toISOString() ?? null,
        dueAtTo: dueAt.toISOString(),
      }),
    });
    const label = new Intl.DateTimeFormat("ru-RU", {
      timeZone: profile?.timezone ?? "Europe/Kyiv",
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(dueAt);
    return {
      message: `#${task.number}: новый срок — ${label}.`,
      link: adminLink(`/admin/operations/tasks/${task.id}`),
    };
  });
}

async function cancelTask(input: { client: PrismaClient; actor: TelegramActor; taskId: string }) {
  return input.client.$transaction(async (tx) => {
    const task = await tx.opsTask.findUnique({
      where: { id: input.taskId },
      select: {
        id: true,
        number: true,
        status: true,
        version: true,
        assigneeId: true,
        assignees: { select: { adminUserId: true } },
        createdById: true,
        isShared: true,
      },
    });
    if (!task) throw new Error("CALLBACK_RESOURCE_NOT_FOUND");
    canWriteTask(input.actor, task);
    if (task.status === OpsTaskStatus.DONE || task.status === OpsTaskStatus.CANCELLED) {
      return {
        message: `#${task.number} уже закрыта.`,
        link: adminLink(`/admin/operations/tasks/${task.id}`),
      };
    }
    assertTaskTransition(task.status, OpsTaskStatus.CANCELLED, { reopen: false, comment: null });
    const changed = await tx.opsTask.updateMany({
      where: { id: task.id, version: task.version, status: task.status },
      data: {
        status: OpsTaskStatus.CANCELLED,
        completedAt: new Date(),
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
        idempotencyKey: `telegram:cancel:${task.id}`,
        payload: {
          fromStatus: task.status,
          toStatus: OpsTaskStatus.CANCELLED,
          reason: "telegram_not_needed",
        },
      },
    });
    await tx.adminAuditLog.create({
      data: auditData(input.actor, "telegram.task.cancel", "ops.task", task.id, {
        fromStatus: task.status,
        toStatus: OpsTaskStatus.CANCELLED,
      }),
    });
    return {
      message: `#${task.number} закрыта как неактуальная. Вернуть можно в админке.`,
      link: adminLink(`/admin/operations/tasks/${task.id}`),
    };
  });
}

async function takeTask(input: { client: PrismaClient; actor: TelegramActor; taskId: string }) {
  requirePermission(input.actor, ADMIN_PERMISSIONS.OPS_TASKS_WRITE);
  return input.client.$transaction(async (tx) => {
    const task = await tx.opsTask.findUnique({
      where: { id: input.taskId },
      select: {
        id: true,
        number: true,
        status: true,
        version: true,
        assigneeId: true,
        assignees: { select: { adminUserId: true } },
        isShared: true,
      },
    });
    if (!task) throw new Error("CALLBACK_RESOURCE_NOT_FOUND");
    const assigned = task.assigneeId !== null || task.assignees.length > 0 || task.isShared;
    if (assigned) {
      const mine =
        task.assigneeId === input.actor.id ||
        task.assignees.some((assignment) => assignment.adminUserId === input.actor.id);
      return {
        message: mine ? `#${task.number} уже ваша.` : `#${task.number} уже взял кто-то другой.`,
        link: adminLink(`/admin/operations/tasks/${task.id}`),
      };
    }
    const changed = await tx.opsTask.updateMany({
      where: {
        id: task.id,
        version: task.version,
        assigneeId: null,
        isShared: false,
        assignees: { none: {} },
      },
      data: { assigneeId: input.actor.id, version: { increment: 1 } },
    });
    if (changed.count !== 1) throw new Error("TASK_VERSION_CONFLICT");
    await tx.opsTaskAssignee.create({
      data: { taskId: task.id, adminUserId: input.actor.id, assignedById: input.actor.id },
    });
    await tx.opsTaskEvent.create({
      data: {
        taskId: task.id,
        type: OpsTaskEventType.ASSIGNED,
        actorId: input.actor.id,
        sourceType: OpsTaskSourceType.TELEGRAM,
        sourceId: task.id,
        payload: {
          assigneeIdFrom: null,
          assigneeIdTo: input.actor.id,
          assigneeIdsTo: [input.actor.id],
          reason: "telegram_take",
        },
      },
    });
    await tx.adminAuditLog.create({
      data: auditData(input.actor, "telegram.task.take", "ops.task", task.id, {
        assigneeIdTo: input.actor.id,
      }),
    });
    return {
      message: `#${task.number} теперь ваша. Напомню в день срока.`,
      link: adminLink(`/admin/operations/tasks/${task.id}`),
    };
  });
}

async function assignTaskTo(input: {
  client: PrismaClient;
  actor: TelegramActor;
  taskId: string;
  assigneeId: string | undefined;
}) {
  requirePermission(input.actor, ADMIN_PERMISSIONS.OPS_TASKS_ASSIGN);
  if (!input.assigneeId) throw new Error("TELEGRAM_CALLBACK_INVALID");
  const assignee = await input.client.adminUser.findFirst({
    where: { id: input.assigneeId, isActive: true },
    select: { id: true, name: true, email: true },
  });
  if (!assignee) throw new Error("CALLBACK_RESOURCE_NOT_FOUND");
  return input.client.$transaction(async (tx) => {
    const task = await tx.opsTask.findUnique({
      where: { id: input.taskId },
      select: {
        id: true,
        number: true,
        externalId: true,
        title: true,
        dueAt: true,
        version: true,
        assigneeId: true,
        assignees: { select: { adminUserId: true } },
        isShared: true,
      },
    });
    if (!task) throw new Error("CALLBACK_RESOURCE_NOT_FOUND");
    if (task.assigneeId !== null || task.assignees.length > 0 || task.isShared) {
      return {
        message: `#${task.number} уже назначена — поменять можно в админке.`,
        link: adminLink(`/admin/operations/tasks/${task.id}`),
      };
    }
    const changed = await tx.opsTask.updateMany({
      where: {
        id: task.id,
        version: task.version,
        assigneeId: null,
        isShared: false,
        assignees: { none: {} },
      },
      data: { assigneeId: assignee.id, version: { increment: 1 } },
    });
    if (changed.count !== 1) throw new Error("TASK_VERSION_CONFLICT");
    await tx.opsTaskAssignee.create({
      data: { taskId: task.id, adminUserId: assignee.id, assignedById: input.actor.id },
    });
    await tx.opsTaskEvent.create({
      data: {
        taskId: task.id,
        type: OpsTaskEventType.ASSIGNED,
        actorId: input.actor.id,
        sourceType: OpsTaskSourceType.TELEGRAM,
        sourceId: task.id,
        payload: {
          assigneeIdFrom: null,
          assigneeIdTo: assignee.id,
          assigneeIdsTo: [assignee.id],
          reason: "telegram_assign",
        },
      },
    });
    await tx.adminAuditLog.create({
      data: auditData(input.actor, "telegram.task.assign", "ops.task", task.id, {
        assigneeIdTo: assignee.id,
      }),
    });
    await enqueueOpsTaskAssignmentNotification({
      client: tx,
      task: {
        id: task.id,
        externalId: task.externalId,
        title: task.title,
        assigneeId: assignee.id,
        assigneeIds: [assignee.id],
        dueAt: task.dueAt,
        version: task.version + 1,
      },
      assignedBy: { id: input.actor.id, name: input.actor.name, email: input.actor.email },
    });
    const name = assignee.name?.trim() || assignee.email;
    return {
      message: `#${task.number} поручена: ${name}. Уведомление уйдёт в Telegram.`,
      link: adminLink(`/admin/operations/tasks/${task.id}`),
    };
  });
}

/**
 * «Передай Игорю» in a reply: the current assignee hands the task over, or a
 * manager reassigns it. Replaces all participants with the new person.
 */
async function handOverTask(input: {
  client: PrismaClient;
  actor: TelegramActor;
  taskId: string;
  assigneeId: string;
}) {
  const assignee = await input.client.adminUser.findFirst({
    where: { id: input.assigneeId, isActive: true },
    select: { id: true, name: true, email: true },
  });
  if (!assignee) throw new Error("CALLBACK_RESOURCE_NOT_FOUND");
  return input.client.$transaction(async (tx) => {
    const task = await tx.opsTask.findUnique({
      where: { id: input.taskId },
      select: {
        id: true,
        number: true,
        externalId: true,
        title: true,
        status: true,
        dueAt: true,
        version: true,
        assigneeId: true,
        assignees: { select: { adminUserId: true } },
        createdById: true,
        isShared: true,
      },
    });
    if (!task) throw new Error("CALLBACK_RESOURCE_NOT_FOUND");
    canWriteTask(input.actor, task);
    const currentIds = Array.from(
      new Set([
        ...task.assignees.map((assignment) => assignment.adminUserId),
        ...(task.assigneeId ? [task.assigneeId] : []),
      ])
    );
    const canAssign = matchesAdminPermission(
      input.actor.permissions,
      ADMIN_PERMISSIONS.OPS_TASKS_ASSIGN
    );
    const handingOverOwnTask = currentIds.includes(input.actor.id) || currentIds.length === 0;
    if (!canAssign && !handingOverOwnTask) throw new Error("TELEGRAM_ACTION_FORBIDDEN");
    const name = assignee.name?.trim() || assignee.email;
    if (task.status === OpsTaskStatus.DONE || task.status === OpsTaskStatus.CANCELLED) {
      return {
        message: `#${task.number} уже закрыта.`,
        link: adminLink(`/admin/operations/tasks/${task.id}`),
      };
    }
    if (currentIds.length === 1 && currentIds[0] === assignee.id && !task.isShared) {
      return {
        message: `#${task.number} уже у ${name}.`,
        link: adminLink(`/admin/operations/tasks/${task.id}`),
      };
    }
    const changed = await tx.opsTask.updateMany({
      where: { id: task.id, version: task.version },
      data: { assigneeId: assignee.id, isShared: false, version: { increment: 1 } },
    });
    if (changed.count !== 1) throw new Error("TASK_VERSION_CONFLICT");
    await tx.opsTaskAssignee.deleteMany({
      where: { taskId: task.id, adminUserId: { not: assignee.id } },
    });
    await tx.opsTaskAssignee.upsert({
      where: { taskId_adminUserId: { taskId: task.id, adminUserId: assignee.id } },
      create: { taskId: task.id, adminUserId: assignee.id, assignedById: input.actor.id },
      update: { assignedById: input.actor.id },
    });
    await tx.opsTaskEvent.create({
      data: {
        taskId: task.id,
        type: OpsTaskEventType.ASSIGNED,
        actorId: input.actor.id,
        sourceType: OpsTaskSourceType.TELEGRAM,
        sourceId: task.id,
        payload: {
          assigneeIdFrom: task.assigneeId,
          assigneeIdsFrom: currentIds,
          assigneeIdTo: assignee.id,
          assigneeIdsTo: [assignee.id],
          reason: "telegram_hand_over",
        },
      },
    });
    await tx.adminAuditLog.create({
      data: auditData(input.actor, "telegram.task.hand_over", "ops.task", task.id, {
        assigneeIdsFrom: currentIds,
        assigneeIdTo: assignee.id,
      }),
    });
    if (assignee.id !== input.actor.id) {
      await enqueueOpsTaskAssignmentNotification({
        client: tx,
        task: {
          id: task.id,
          externalId: task.externalId,
          title: task.title,
          assigneeId: assignee.id,
          assigneeIds: [assignee.id],
          dueAt: task.dueAt,
          version: task.version + 1,
        },
        assignedBy: { id: input.actor.id, name: input.actor.name, email: input.actor.email },
      });
    }
    return {
      message:
        assignee.id === input.actor.id
          ? `#${task.number} теперь ваша.`
          : `#${task.number} передана: ${name}. Уведомление уйдёт в Telegram.`,
      link: adminLink(`/admin/operations/tasks/${task.id}`),
    };
  });
}

async function setTaskRepeat(input: {
  client: PrismaClient;
  actor: TelegramActor;
  taskId: string;
  rule: OpsRepeatRule | null;
}) {
  return input.client.$transaction(async (tx) => {
    const task = await tx.opsTask.findUnique({
      where: { id: input.taskId },
      select: {
        id: true,
        number: true,
        tags: true,
        version: true,
        assigneeId: true,
        assignees: { select: { adminUserId: true } },
        createdById: true,
        isShared: true,
      },
    });
    if (!task) throw new Error("CALLBACK_RESOURCE_NOT_FOUND");
    canWriteTask(input.actor, task);
    const before = opsRepeatRuleFromTags(task.tags);
    const tags = withOpsRepeatRule(task.tags, input.rule);
    if (before !== input.rule) {
      const changed = await tx.opsTask.updateMany({
        where: { id: task.id, version: task.version },
        data: { tags, version: { increment: 1 } },
      });
      if (changed.count !== 1) throw new Error("TASK_VERSION_CONFLICT");
      await tx.opsTaskEvent.create({
        data: {
          taskId: task.id,
          type: OpsTaskEventType.UPDATED,
          actorId: input.actor.id,
          sourceType: OpsTaskSourceType.TELEGRAM,
          sourceId: task.id,
          payload: { changes: ["tags"], repeatFrom: before, repeatTo: input.rule },
        },
      });
      await tx.adminAuditLog.create({
        data: auditData(input.actor, "telegram.task.repeat", "ops.task", task.id, {
          repeatFrom: before,
          repeatTo: input.rule,
        }),
      });
    }
    return {
      message: input.rule
        ? `#${task.number} будет повторяться: ${opsRepeatLabel(input.rule).toLocaleLowerCase("ru-RU")}. Следующая появится, когда отметите эту выполненной.`
        : `#${task.number} больше не повторяется.`,
      link: adminLink(`/admin/operations/tasks/${task.id}`),
    };
  });
}

/**
 * «🔗 Объединить»: the freshly created duplicate is closed and its text is
 * kept as a comment on the older task, so nothing is lost.
 */
async function mergeDuplicateTask(input: {
  client: PrismaClient;
  actor: TelegramActor;
  duplicateId: string;
  targetId: string | undefined;
}) {
  if (!input.targetId || input.targetId === input.duplicateId) {
    throw new Error("TELEGRAM_CALLBACK_INVALID");
  }
  return input.client.$transaction(async (tx) => {
    const select = {
      id: true,
      number: true,
      title: true,
      description: true,
      status: true,
      version: true,
      archivedAt: true,
      assigneeId: true,
      assignees: { select: { adminUserId: true } },
      createdById: true,
      isShared: true,
    } as const;
    const [duplicate, target] = await Promise.all([
      tx.opsTask.findUnique({ where: { id: input.duplicateId }, select }),
      tx.opsTask.findUnique({ where: { id: input.targetId! }, select }),
    ]);
    if (!duplicate || !target || target.archivedAt) {
      throw new Error("CALLBACK_RESOURCE_NOT_FOUND");
    }
    canWriteTask(input.actor, duplicate);
    if (duplicate.status === OpsTaskStatus.CANCELLED) {
      return {
        message: `#${duplicate.number} уже закрыта.`,
        link: adminLink(`/admin/operations/tasks/${target.id}`),
      };
    }
    assertTaskTransition(duplicate.status, OpsTaskStatus.CANCELLED, {
      reopen: false,
      comment: null,
    });
    const changed = await tx.opsTask.updateMany({
      where: { id: duplicate.id, version: duplicate.version, status: duplicate.status },
      data: {
        status: OpsTaskStatus.CANCELLED,
        completedAt: new Date(),
        version: { increment: 1 },
      },
    });
    if (changed.count !== 1) throw new Error("TASK_VERSION_CONFLICT");
    await tx.opsComment.create({
      data: {
        taskId: target.id,
        authorId: input.actor.id,
        text: [
          `Объединено с #${duplicate.number}: ${duplicate.title}`,
          duplicate.description?.trim() || null,
        ]
          .filter(Boolean)
          .join("\n\n")
          .slice(0, 10_000),
      },
    });
    const attachments = await tx.opsTaskAttachment.findMany({
      where: { taskId: duplicate.id },
      select: { attachmentId: true },
    });
    if (attachments.length) {
      await tx.opsTaskAttachment.createMany({
        data: attachments.map((entry) => ({
          taskId: target.id,
          attachmentId: entry.attachmentId,
          attachedById: input.actor.id,
        })),
        skipDuplicates: true,
      });
    }
    await tx.opsTaskEvent.create({
      data: {
        taskId: duplicate.id,
        type: OpsTaskEventType.STATUS_CHANGED,
        actorId: input.actor.id,
        sourceType: OpsTaskSourceType.TELEGRAM,
        sourceId: target.id,
        idempotencyKey: `telegram:merge:${duplicate.id}`,
        payload: {
          fromStatus: duplicate.status,
          toStatus: OpsTaskStatus.CANCELLED,
          reason: "duplicate",
          mergedIntoTaskId: target.id,
          mergedIntoTaskNumber: target.number,
        },
      },
    });
    await tx.adminAuditLog.create({
      data: auditData(input.actor, "telegram.task.merge", "ops.task", duplicate.id, {
        mergedIntoTaskId: target.id,
        attachmentCount: attachments.length,
      }),
    });
    return {
      message: `Объединил: #${duplicate.number} закрыта, текст${attachments.length ? " и вложения" : ""} перенёс в #${target.number}.`,
      link: adminLink(`/admin/operations/tasks/${target.id}`),
    };
  });
}

export type OpsTaskQuickAction =
  | { kind: "done" }
  | { kind: "cancel" }
  | { kind: "take" }
  | { kind: "snooze_tomorrow" }
  | { kind: "snooze_week" }
  | { kind: "snooze_to"; dueAt: Date }
  | { kind: "hand_over"; assigneeId: string }
  | { kind: "repeat"; rule: OpsRepeatRule | null };

/**
 * Task actions shared by reply commands («готово», «перенеси на пятницу»)
 * and the Telegram mini app. Throws the same error codes as callbacks.
 */
export async function runOpsTaskQuickAction(input: {
  client: PrismaClient;
  actorAdminUserId: string;
  taskId: string;
  action: OpsTaskQuickAction;
}): Promise<{ message: string; link: string | null }> {
  const actor = await resolveActor(input.client, input.actorAdminUserId);
  const { action, taskId, client } = input;
  switch (action.kind) {
    case "done":
      return markTaskDone({ client, actor, taskId });
    case "cancel":
      return cancelTask({ client, actor, taskId });
    case "take":
      return takeTask({ client, actor, taskId });
    case "snooze_tomorrow":
      return snoozeTask({ client, actor, taskId, kind: "tomorrow" });
    case "snooze_week":
      return snoozeTask({ client, actor, taskId, kind: "week" });
    case "snooze_to":
      return snoozeTask({ client, actor, taskId, kind: "date", dueAt: action.dueAt });
    case "hand_over":
      return handOverTask({ client, actor, taskId, assigneeId: action.assigneeId });
    case "repeat":
      return setTaskRepeat({ client, actor, taskId, rule: action.rule });
  }
}

/** Friendly text for the error codes thrown by task actions. */
export function opsTaskActionErrorMessage(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  if (code === "TELEGRAM_ACTION_FORBIDDEN") return "Нет прав на это действие.";
  if (code === "CALLBACK_RESOURCE_NOT_FOUND") return "Задача не найдена.";
  if (code === "TASK_VERSION_CONFLICT") return "Задачу только что изменили — попробуйте ещё раз.";
  if (code === "TELEGRAM_ACTOR_INACTIVE") return "Ваш доступ к админке отключён.";
  if (error instanceof Error && error.name === "OpsError") return "Так изменить задачу нельзя.";
  return null;
}

/** Buttons of a price change that create the next buttons (apply → undo). */
async function executePriceChangeCallback(input: {
  client: PrismaClient;
  actor: TelegramActor;
  action: OpsTelegramCallbackAction;
  resourceId: string;
  value?: string;
}): Promise<{ message: string; link: string | null; reply?: PriceReply }> {
  const actor = {
    id: input.actor.id,
    email: input.actor.email,
    name: input.actor.name,
    permissions: input.actor.permissions,
    roleKeys: input.actor.roleKeys,
  };
  const button: PriceButtonFactory = async (action, resourceId, label, style, value) => {
    const callbackData = await createOpsTelegramCallbackState({
      client: input.client,
      action,
      resourceId,
      actorAdminUserId: actor.id,
      ...(value ? { value } : {}),
      ttlMs: 24 * 60 * 60 * 1000,
    });
    return callbackData
      ? { text: label, callback_data: callbackData, ...(style ? { style } : {}) }
      : null;
  };
  switch (input.action) {
    case "price_formula":
      return proposeFormulaForSource({
        client: input.client,
        actor,
        sourceId: input.resourceId,
        telegramChatId: null,
        button,
      });
    case "price_card_formula":
      return proposeFormulaForProduct({
        client: input.client,
        actor,
        productId: input.resourceId,
        telegramChatId: null,
        button,
      });
    case "price_card_client_text":
      return clientTextForProduct({
        client: input.client,
        productId: input.resourceId,
        variantId: input.value ?? null,
      });
    case "price_card_delivery":
      return deliveryPromptForProduct({
        client: input.client,
        productId: input.resourceId,
        variantId: input.value ?? null,
      });
    case "price_card_open": {
      const card = await buildProductCard({
        client: input.client,
        productId: input.resourceId,
        variantId: input.value ?? null,
        actor,
        button,
      });
      if (!card) throw new Error("CALLBACK_RESOURCE_NOT_FOUND");
      return { message: "Карточка — ниже.", link: null, reply: card };
    }
    case "order_client_text":
      return orderClientText({ client: input.client, orderId: input.resourceId, actor });
    case "price_lead_mark":
    case "price_lead_clear":
      if (!canChangePrices(actor)) throw new Error("TELEGRAM_ACTION_FORBIDDEN");
      return applyLeadTimeMarks({
        client: input.client,
        actor,
        mode: input.action === "price_lead_mark" ? "mark" : "clear",
        plan: await currentLeadTimePlan(input.client),
        telegramChatId: null,
        button,
      });
    case "price_lead_undo":
      return undoLeadTimeMarks({ client: input.client, actor, changeId: input.resourceId });
    case "price_apply":
    case "price_apply_big":
      return confirmPriceChange({
        client: input.client,
        actor,
        changeId: input.resourceId,
        confirmedBig: input.action === "price_apply_big",
        button,
      });
    case "price_cancel":
      return cancelPriceChange({ client: input.client, actor, changeId: input.resourceId });
    case "price_undo":
      return undoPriceChange({ client: input.client, actor, changeId: input.resourceId, button });
    default:
      throw new Error("CALLBACK_RESOURCE_NOT_FOUND");
  }
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
    } else if (claimed.state.action === "undo_task_update") {
      result = await undoTaskProgressUpdate({
        client: input.client,
        actor,
        eventId: claimed.state.resourceId,
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
    } else if (
      claimed.state.action === "snooze_tomorrow" ||
      claimed.state.action === "snooze_week"
    ) {
      result = await snoozeTask({
        client: input.client,
        actor,
        taskId: claimed.state.resourceId,
        kind: claimed.state.action === "snooze_tomorrow" ? "tomorrow" : "week",
      });
    } else if (claimed.state.action === "cancel_task") {
      result = await cancelTask({
        client: input.client,
        actor,
        taskId: claimed.state.resourceId,
      });
    } else if (claimed.state.action === "take") {
      result = await takeTask({
        client: input.client,
        actor,
        taskId: claimed.state.resourceId,
      });
    } else if (claimed.state.action === "assign_to") {
      result = await assignTaskTo({
        client: input.client,
        actor,
        taskId: claimed.state.resourceId,
        assigneeId: claimed.state.value,
      });
    } else if (claimed.state.action === "merge_into") {
      result = await mergeDuplicateTask({
        client: input.client,
        actor,
        duplicateId: claimed.state.resourceId,
        targetId: claimed.state.value,
      });
    } else if (claimed.state.action === "price_ack") {
      result = await acknowledgePriceList({
        client: input.client,
        actor,
        sourceId: claimed.state.resourceId,
      });
    } else if (claimed.state.action === "price_snooze") {
      result = await snoozePriceList({
        client: input.client,
        actor,
        sourceId: claimed.state.resourceId,
      });
    } else if (claimed.state.action === "price_list_task") {
      result = await createPriceListTask({
        client: input.client,
        actor,
        sourceId: claimed.state.resourceId,
      });
    } else if (claimed.state.action === "price_digest_task") {
      result = await createPriceWatchDigestTask({
        client: input.client,
        actor,
        jobId: claimed.state.resourceId,
      });
    } else if (
      claimed.state.action === "price_formula" ||
      PRICE_CARD_ACTIONS.includes(claimed.state.action) ||
      PRICE_LEAD_ACTIONS.includes(claimed.state.action) ||
      PRICE_CHANGE_ACTIONS.includes(claimed.state.action)
    ) {
      result = await executePriceChangeCallback({
        client: input.client,
        actor,
        action: claimed.state.action,
        resourceId: claimed.state.resourceId,
        value: claimed.state.value,
      });
    } else {
      requirePermission(actor, ADMIN_PERMISSIONS.OPS_TASKS_READ);
      const task = await input.client.opsTask.findUnique({
        where: { id: claimed.state.resourceId },
        select: {
          id: true,
          externalId: true,
          assigneeId: true,
          assignees: { select: { adminUserId: true } },
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
