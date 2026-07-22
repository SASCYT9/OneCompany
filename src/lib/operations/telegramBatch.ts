import crypto from "node:crypto";
import {
  OpsInboxExtractionStatus,
  OpsInboxReviewStatus,
  OpsJobStage,
  OpsJobStatus,
  OpsTelegramBatchMode,
  OpsTelegramBatchStatus,
  Prisma,
  type PrismaClient,
} from "@prisma/client";
import {
  editOpsTelegramNotification,
  sendOpsTelegramNotification,
} from "@/lib/operations/notifications";
import {
  normalizeOpsTelegramUpdate,
  type NormalizedOpsTelegramUpdate,
  type OpsTelegramMember,
  type TelegramManagerUpdate,
} from "@/lib/operations/telegram";

export const OPS_TELEGRAM_BATCH_TTL_MS = 10 * 60 * 1000;
export const OPS_TELEGRAM_BATCH_BURST_MS = 15 * 1000;
export const OPS_TELEGRAM_BATCH_DEDUPE_MS = 15 * 60 * 1000;
const STATUS_MESSAGE_CLAIMED = -1;
const STATUS_MESSAGE_CLAIM_STALE_MS = 30 * 1000;

type BatchAction = "one" | "split" | "clear";

function callbackSecret() {
  return String(process.env.OPS_TELEGRAM_CALLBACK_SECRET ?? "").trim();
}

function callbackSignature(value: string) {
  return crypto
    .createHmac("sha256", callbackSecret())
    .update(value)
    .digest("base64url")
    .slice(0, 10);
}

export function createOpsTelegramBatchCallbackData(action: BatchAction, batchId: string) {
  if (!callbackSecret() || !/^[a-zA-Z0-9_-]{8,40}$/.test(batchId)) return null;
  const base = `opb:${action}:${batchId}`;
  const value = `${base}:${callbackSignature(base)}`;
  return Buffer.byteLength(value, "utf8") <= 64 ? value : null;
}

export function parseOpsTelegramBatchCallbackData(value: string | null) {
  const match = String(value ?? "").match(
    /^opb:(one|split|clear):([a-zA-Z0-9_-]{8,40}):([a-zA-Z0-9_-]{10})$/
  );
  if (!match || !callbackSecret()) return null;
  const [, action, batchId, provided] = match;
  const base = `opb:${action}:${batchId}`;
  const expected = callbackSignature(base);
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) return null;
  return { action: action as BatchAction, batchId };
}

function json(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function scopeKey(update: NormalizedOpsTelegramUpdate) {
  return `private:${update.chatId}:${update.telegramUserId}`;
}

function closedScope(id: string) {
  return `closed:${id}:${crypto.randomBytes(4).toString("hex")}`;
}

function batchContentHash(items: NormalizedOpsTelegramUpdate[]) {
  const content = items.map((item) => ({
    text: item.text?.replace(/\s+/g, " ").trim() || null,
    media: item.media
      ? {
          kind: item.media.kind,
          fileUniqueId: item.media.fileUniqueId || null,
          fileId: item.media.fileUniqueId ? null : item.media.fileId,
          mimeType: item.media.mimeType,
          sizeBytes: item.media.fileSize,
          durationSeconds: item.media.durationSeconds,
        }
      : null,
  }));
  return crypto.createHash("sha256").update(JSON.stringify(content)).digest("hex");
}

export function isOpsTelegramBatchForward(update: NormalizedOpsTelegramUpdate) {
  return (
    update.updateType === "message" &&
    update.chatType === "private" &&
    update.isUntrustedForward &&
    Boolean(update.text || update.media)
  );
}

export async function shouldAppendToOpenOpsTelegramBatch(input: {
  client: PrismaClient;
  update: NormalizedOpsTelegramUpdate;
  now?: Date;
}) {
  const { update } = input;
  if (
    update.updateType !== "message" ||
    update.chatType !== "private" ||
    update.callbackData ||
    !Boolean(update.text || update.media) ||
    update.text?.trim().startsWith("/")
  ) {
    return false;
  }
  const batch = await input.client.opsTelegramBatch.findUnique({
    where: { scopeKey: scopeKey(update) },
    select: {
      status: true,
      expiresAt: true,
      items: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      },
    },
  });
  const now = input.now ?? new Date();
  const lastItemAt = batch?.items[0]?.createdAt;
  return Boolean(
    batch?.status === OpsTelegramBatchStatus.OPEN &&
      batch.expiresAt.getTime() > now.getTime() &&
      lastItemAt &&
      now.getTime() - lastItemAt.getTime() <= OPS_TELEGRAM_BATCH_BURST_MS
  );
}

export async function collectOpsTelegramBatchForward(input: {
  client: PrismaClient;
  update: NormalizedOpsTelegramUpdate;
  member: OpsTelegramMember;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const expiresAt = new Date(now.getTime() + OPS_TELEGRAM_BATCH_TTL_MS);
  const maxAttempts = 4;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await input.client.$transaction(
        async (tx) => {
          const duplicate = await tx.opsTelegramUpdate.findUnique({
            where: { telegramUpdateId: input.update.telegramUpdateId },
            select: {
              batchItem: {
                select: {
                  batch: {
                    select: {
                      id: true,
                      itemCount: true,
                      statusMessageId: true,
                      chatId: true,
                      status: true,
                    },
                  },
                },
              },
            },
          });
          if (duplicate?.batchItem) {
            return { ...duplicate.batchItem.batch, duplicate: true };
          }

          const key = scopeKey(input.update);
          let batch = await tx.opsTelegramBatch.findUnique({
            where: { scopeKey: key },
          });
          if (
            batch &&
            (batch.status !== OpsTelegramBatchStatus.OPEN ||
              batch.expiresAt.getTime() <= now.getTime())
          ) {
            await tx.opsTelegramBatch.update({
              where: { id: batch.id },
              data: {
                scopeKey: closedScope(batch.id),
                status:
                  batch.status === OpsTelegramBatchStatus.OPEN
                    ? OpsTelegramBatchStatus.EXPIRED
                    : batch.status,
              },
            });
            batch = null;
          }
          if (!batch) {
            batch = await tx.opsTelegramBatch.create({
              data: {
                scopeKey: key,
                actorAdminUserId: input.member.adminUserId,
                chatId: input.update.chatId,
                telegramUserId: input.update.telegramUserId,
                expiresAt,
              },
            });
          }
          const telegramUpdate = await tx.opsTelegramUpdate.create({
            data: {
              telegramUpdateId: input.update.telegramUpdateId,
              chatId: input.update.chatId,
              telegramUserId: input.update.telegramUserId,
              messageId: input.update.messageId,
              messageThreadId: input.update.messageThreadId,
              updateType: input.update.updateType,
              rawUpdate: json(input.update.rawUpdate),
              isUntrustedForward: input.update.isUntrustedForward,
            },
            select: { id: true },
          });
          const ordinal = batch.itemCount + 1;
          await tx.opsTelegramBatchItem.create({
            data: {
              batchId: batch.id,
              telegramUpdateId: telegramUpdate.id,
              ordinal,
            },
          });
          const updated = await tx.opsTelegramBatch.update({
            where: { id: batch.id },
            data: {
              itemCount: { increment: 1 },
              expiresAt,
            },
            select: {
              id: true,
              itemCount: true,
              statusMessageId: true,
              chatId: true,
              status: true,
            },
          });
          await tx.adminAuditLog.create({
            data: {
              actorId: input.member.adminUserId,
              actorEmail: input.member.email,
              actorName: input.member.name,
              scope: "operations",
              action: "telegram.batch.item_collected",
              entityType: "ops.telegram_batch",
              entityId: batch.id,
              metadata: {
                telegramUpdateId: input.update.telegramUpdateId.toString(),
                ordinal,
                hasMedia: Boolean(input.update.media),
              },
            },
          });
          return { ...updated, duplicate: false };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
    } catch (error) {
      const retryable = (error as { code?: string }).code === "P2034";
      if (!retryable || attempt === maxAttempts) throw error;

      // Forwarded messages commonly arrive as a burst. A short bounded jitter
      // lets the transaction holding this user's open batch commit first while
      // keeping the webhook comfortably inside Telegram's acknowledgement SLA.
      await new Promise((resolve) => setTimeout(resolve, 20 * attempt + crypto.randomInt(0, 21)));
    }
  }

  throw new Error("OPS_TELEGRAM_BATCH_RETRY_EXHAUSTED");
}

function batchKeyboard(batchId: string) {
  const one = createOpsTelegramBatchCallbackData("one", batchId);
  const split = createOpsTelegramBatchCallbackData("split", batchId);
  const clear = createOpsTelegramBatchCallbackData("clear", batchId);
  if (!one || !split || !clear) return undefined;
  return {
    inline_keyboard: [
      [
        { text: "✅ Одна задача", callback_data: one, style: "success" as const },
        { text: "✨ Разобрать", callback_data: split, style: "primary" as const },
      ],
      [{ text: "🗑 Очистить", callback_data: clear, style: "danger" as const }],
    ],
  };
}

function batchStatusText(count: number) {
  return [
    "📚 Подборка сообщений",
    `Собрано: ${count}`,
    "Можно переслать ещё сообщения или выбрать способ обработки.",
  ].join("\n");
}

export async function syncOpsTelegramBatchStatus(input: {
  client: PrismaClient;
  batchId: string;
  fetchImpl?: typeof fetch;
}) {
  const batch = await input.client.opsTelegramBatch.findUnique({
    where: { id: input.batchId },
    select: {
      id: true,
      chatId: true,
      itemCount: true,
      status: true,
      statusMessageId: true,
    },
  });
  if (!batch || batch.status !== OpsTelegramBatchStatus.OPEN) return;
  const text = batchStatusText(batch.itemCount);
  const replyMarkup = batchKeyboard(batch.id);
  if (batch.statusMessageId && batch.statusMessageId > 0) {
    await editOpsTelegramNotification({
      chatId: batch.chatId,
      messageId: batch.statusMessageId,
      text,
      replyMarkup,
      fetchImpl: input.fetchImpl,
    });
    return;
  }
  const staleBefore = new Date(Date.now() - STATUS_MESSAGE_CLAIM_STALE_MS);
  const claim = await input.client.opsTelegramBatch.updateMany({
    where: {
      id: batch.id,
      status: OpsTelegramBatchStatus.OPEN,
      OR: [
        { statusMessageId: null },
        { statusMessageId: STATUS_MESSAGE_CLAIMED, updatedAt: { lt: staleBefore } },
      ],
    },
    data: { statusMessageId: STATUS_MESSAGE_CLAIMED },
  });
  if (claim.count !== 1) return;
  try {
    const sent = await sendOpsTelegramNotification({
      chatId: batch.chatId,
      text,
      replyMarkup,
      fetchImpl: input.fetchImpl,
    });
    await input.client.opsTelegramBatch.updateMany({
      where: {
        id: batch.id,
        statusMessageId: STATUS_MESSAGE_CLAIMED,
        status: OpsTelegramBatchStatus.OPEN,
      },
      data: { statusMessageId: sent.messageId },
    });
    const latest = await input.client.opsTelegramBatch.findUnique({
      where: { id: batch.id },
      select: {
        chatId: true,
        itemCount: true,
        status: true,
        statusMessageId: true,
      },
    });
    if (
      latest?.status === OpsTelegramBatchStatus.OPEN &&
      latest.statusMessageId === sent.messageId
    ) {
      await editOpsTelegramNotification({
        chatId: latest.chatId,
        messageId: sent.messageId,
        text: batchStatusText(latest.itemCount),
        replyMarkup,
        fetchImpl: input.fetchImpl,
      });
    }
  } catch (error) {
    await input.client.opsTelegramBatch.updateMany({
      where: { id: batch.id, statusMessageId: STATUS_MESSAGE_CLAIMED },
      data: { statusMessageId: null },
    });
    throw error;
  }
}

export async function syncOpsTelegramBatchFinalStatus(input: {
  client: PrismaClient;
  batchId: string;
  text: string;
  fetchImpl?: typeof fetch;
}) {
  const batch = await input.client.opsTelegramBatch.findUnique({
    where: { id: input.batchId },
    select: { chatId: true, statusMessageId: true },
  });
  if (!batch?.statusMessageId || batch.statusMessageId <= 0) return;
  await editOpsTelegramNotification({
    chatId: batch.chatId,
    messageId: batch.statusMessageId,
    text: input.text,
    fetchImpl: input.fetchImpl,
  });
}

type BatchJobItem = {
  telegramUpdateId: string;
  messageId: number | null;
  text: string | null;
  media: NormalizedOpsTelegramUpdate["media"];
  forwardedFrom: NormalizedOpsTelegramUpdate["forwardedFrom"];
  isUntrustedForward: boolean;
};

export async function executeOpsTelegramBatchCallback(input: {
  client: PrismaClient;
  update: NormalizedOpsTelegramUpdate;
  member: OpsTelegramMember;
}) {
  const parsed = parseOpsTelegramBatchCallbackData(input.update.callbackData);
  if (!parsed) return null;
  const result = await input.client.$transaction(
    async (tx) => {
      const batch = await tx.opsTelegramBatch.findUnique({
        where: { id: parsed.batchId },
        include: {
          items: {
            orderBy: { ordinal: "asc" },
            include: { telegramUpdate: true },
          },
        },
      });
      if (
        !batch ||
        batch.actorAdminUserId !== input.member.adminUserId ||
        batch.telegramUserId !== input.update.telegramUserId
      ) {
        return { response: "Подборка недоступна.", jobId: null, batchId: parsed.batchId };
      }
      if (parsed.action === "clear") {
        if (batch.status === OpsTelegramBatchStatus.OPEN) {
          await tx.opsTelegramBatch.update({
            where: { id: batch.id },
            data: {
              status: OpsTelegramBatchStatus.CANCELLED,
              scopeKey: closedScope(batch.id),
              finalizedAt: new Date(),
            },
          });
        }
        return {
          response: "Подборка очищена. Задачи не создавались.",
          jobId: null,
          batchId: batch.id,
        };
      }
      if (batch.status !== OpsTelegramBatchStatus.OPEN || batch.items.length === 0) {
        return { response: "Подборка уже обработана или пуста.", jobId: null, batchId: batch.id };
      }
      const first = batch.items[0].telegramUpdate;
      const normalizedItems = batch.items
        .map((item) =>
          normalizeOpsTelegramUpdate(item.telegramUpdate.rawUpdate as TelegramManagerUpdate, {
            botUsername: process.env.OPS_TELEGRAM_BOT_USERNAME,
            botId: process.env.OPS_TELEGRAM_BOT_ID,
          })
        )
        .filter((item): item is NormalizedOpsTelegramUpdate => Boolean(item));
      const contentHash = batchContentHash(normalizedItems);
      const recentBatches = await tx.opsTelegramBatch.findMany({
        where: {
          id: { not: batch.id },
          actorAdminUserId: batch.actorAdminUserId,
          chatId: batch.chatId,
          status: {
            in: [OpsTelegramBatchStatus.PROCESSING, OpsTelegramBatchStatus.READY],
          },
          createdAt: {
            gte: new Date(Date.now() - OPS_TELEGRAM_BATCH_DEDUPE_MS),
          },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          items: {
            orderBy: { ordinal: "asc" },
            include: { telegramUpdate: true },
          },
        },
      });
      const duplicate = recentBatches.find((candidate) => {
        if (candidate.items.length !== batch.items.length) return false;
        const candidateItems = candidate.items
          .map((item) =>
            normalizeOpsTelegramUpdate(item.telegramUpdate.rawUpdate as TelegramManagerUpdate, {
              botUsername: process.env.OPS_TELEGRAM_BOT_USERNAME,
              botId: process.env.OPS_TELEGRAM_BOT_ID,
            })
          )
          .filter((item): item is NormalizedOpsTelegramUpdate => Boolean(item));
        return batchContentHash(candidateItems) === contentHash;
      });
      if (duplicate) {
        await tx.opsTelegramBatch.update({
          where: { id: batch.id },
          data: {
            status: OpsTelegramBatchStatus.CANCELLED,
            scopeKey: closedScope(batch.id),
            finalizedAt: new Date(),
          },
        });
        await tx.adminAuditLog.create({
          data: {
            actorId: input.member.adminUserId,
            actorEmail: input.member.email,
            actorName: input.member.name,
            scope: "operations",
            action: "telegram.batch.duplicate_suppressed",
            entityType: "ops.telegram_batch",
            entityId: batch.id,
            metadata: {
              duplicateOfBatchId: duplicate.id,
              itemCount: batch.items.length,
              contentHash,
            },
          },
        });
        return {
          response: "Эта подборка уже была принята. Повторные задачи не созданы.",
          jobId: null,
          batchId: batch.id,
        };
      }
      const batchItems: BatchJobItem[] = normalizedItems.map((item) => ({
        telegramUpdateId: item.telegramUpdateId.toString(),
        messageId: item.messageId,
        text: item.text,
        media: item.media,
        forwardedFrom: item.forwardedFrom,
        isUntrustedForward: item.isUntrustedForward,
      }));
      const inbox = await tx.opsInboxItem.create({
        data: {
          telegramUpdateId: first.id,
          originalMessage: batchItems
            .map((item, index) => `${index + 1}. ${item.text ?? "[вложение]"}`)
            .join("\n")
            .slice(0, 20_000),
          extractionStatus: OpsInboxExtractionStatus.QUEUED,
          reviewStatus: OpsInboxReviewStatus.PENDING,
        },
        select: { id: true },
      });
      const mode =
        parsed.action === "one" ? OpsTelegramBatchMode.ONE_TASK : OpsTelegramBatchMode.SPLIT_TASKS;
      const job = await tx.opsJob.create({
        data: {
          idempotencyKey: `telegram:batch:${batch.id}:${mode}`,
          inboxItemId: inbox.id,
          type: "telegram_batch",
          status: OpsJobStatus.QUEUED,
          stage: OpsJobStage.INGEST,
          payload: json({
            schemaVersion: 2,
            actorAdminUserId: input.member.adminUserId,
            telegramUpdateId: first.telegramUpdateId.toString(),
            chatId: batch.chatId.toString(),
            telegramUserId: batch.telegramUserId.toString(),
            messageId: input.update.messageId,
            messageThreadId: null,
            replyToMessageId: null,
            replyToTelegramUserId: null,
            mediaSource: null,
            text: null,
            callbackData: null,
            media: null,
            isUntrustedForward: true,
            previewOnly: true,
            batchId: batch.id,
            batchMode: mode,
            batchItems,
          }),
        },
        select: { id: true },
      });
      await tx.opsTelegramBatch.update({
        where: { id: batch.id },
        data: {
          status: OpsTelegramBatchStatus.PROCESSING,
          mode,
          inboxItemId: inbox.id,
          scopeKey: closedScope(batch.id),
          finalizedAt: new Date(),
        },
      });
      await tx.adminAuditLog.create({
        data: {
          actorId: input.member.adminUserId,
          actorEmail: input.member.email,
          actorName: input.member.name,
          scope: "operations",
          action: "telegram.batch.finalized",
          entityType: "ops.telegram_batch",
          entityId: batch.id,
          metadata: { mode, itemCount: batch.items.length, inboxItemId: inbox.id },
        },
      });
      return {
        response:
          mode === OpsTelegramBatchMode.ONE_TASK
            ? "Формирую одну задачу из всей подборки."
            : "Разбираю подборку на логические задачи.",
        jobId: job.id,
        batchId: batch.id,
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
  return result;
}
