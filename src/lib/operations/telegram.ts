import crypto from "node:crypto";
import {
  OpsInboxExtractionStatus,
  OpsInboxReviewStatus,
  OpsJobStage,
  OpsJobStatus,
  Prisma,
  type PrismaClient,
} from "@prisma/client";
import { ADMIN_PERMISSIONS, matchesAdminPermission } from "@/lib/admin/adminPermissions";

export const OPS_TELEGRAM_UPDATE_MAX_BYTES = 512 * 1024;
export const OPS_TELEGRAM_RATE_LIMIT_PER_MINUTE = 120;

export type OpsTelegramMediaKind = "voice" | "audio" | "video_note" | "photo" | "document";

export type OpsTelegramMediaDescriptor = {
  kind: OpsTelegramMediaKind;
  fileId: string;
  fileUniqueId: string | null;
  fileSize: number | null;
  durationSeconds: number | null;
  mimeType: string | null;
  fileName: string | null;
};

type TelegramUser = {
  id?: number;
  is_bot?: boolean;
  username?: string;
  first_name?: string;
  last_name?: string;
};

type TelegramMessage = {
  message_id?: number;
  message_thread_id?: number;
  from?: TelegramUser;
  chat?: {
    id?: number;
    type?: string;
  };
  text?: string;
  caption?: string;
  reply_to_message?: TelegramMessage;
  voice?: {
    file_id?: string;
    file_unique_id?: string;
    duration?: number;
    mime_type?: string;
    file_size?: number;
  };
  audio?: {
    file_id?: string;
    file_unique_id?: string;
    duration?: number;
    mime_type?: string;
    file_size?: number;
    file_name?: string;
  };
  video_note?: {
    file_id?: string;
    file_unique_id?: string;
    duration?: number;
    file_size?: number;
  };
  photo?: Array<{
    file_id?: string;
    file_unique_id?: string;
    file_size?: number;
  }>;
  document?: {
    file_id?: string;
    file_unique_id?: string;
    mime_type?: string;
    file_size?: number;
    file_name?: string;
  };
  forward_origin?: unknown;
  forward_from?: unknown;
  forward_from_chat?: unknown;
  forward_sender_name?: string;
  is_automatic_forward?: boolean;
};

export type TelegramManagerUpdate = {
  update_id?: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  channel_post?: TelegramMessage;
  callback_query?: {
    id?: string;
    from?: TelegramUser;
    data?: string;
    message?: TelegramMessage;
  };
};

export type NormalizedOpsTelegramUpdate = {
  telegramUpdateId: bigint;
  updateType: "message" | "edited_message" | "channel_post" | "callback_query";
  chatId: bigint;
  telegramUserId: bigint;
  messageId: number | null;
  messageThreadId: number | null;
  replyToMessageId: number | null;
  replyToTelegramUserId: bigint | null;
  mediaSource: "message" | "reply" | null;
  chatType: string;
  text: string | null;
  callbackData: string | null;
  callbackQueryId: string | null;
  media: OpsTelegramMediaDescriptor | null;
  forwardedFrom: {
    telegramUserId: string | null;
    displayName: string | null;
  } | null;
  isUntrustedForward: boolean;
  mentionedBot: boolean;
  repliedToBot: boolean;
  rawUpdate: TelegramManagerUpdate;
};

export type OpsTelegramMember = {
  adminUserId: string;
  email: string;
  name: string | null;
};

export type OpsTelegramPersistResult = {
  accepted: boolean;
  duplicate: boolean;
  inboxItemId: string | null;
  jobId: string | null;
};

export type OpsTelegramIntakeRepository = {
  resolveMember(telegramUserId: bigint): Promise<OpsTelegramMember | null>;
  consumeRateLimit(input: { telegramUserId: bigint; chatId: bigint; now: Date }): Promise<boolean>;
  persist(
    update: NormalizedOpsTelegramUpdate,
    member: OpsTelegramMember
  ): Promise<OpsTelegramPersistResult>;
};

export async function resolvePrismaOpsTelegramMember(
  client: PrismaClient,
  telegramUserId: bigint
): Promise<OpsTelegramMember | null> {
  const profile = await client.opsMemberProfile.findFirst({
    where: {
      telegramUserId,
      telegramEnabled: true,
      adminUser: { isActive: true },
    },
    select: {
      adminUser: {
        select: {
          id: true,
          email: true,
          name: true,
          roles: {
            select: {
              role: { select: { permissions: true } },
            },
          },
        },
      },
    },
  });
  if (!profile) return null;
  const permissions = profile.adminUser.roles.flatMap(({ role }) => role.permissions);
  if (
    !matchesAdminPermission(permissions, ADMIN_PERMISSIONS.OPS_TASKS_WRITE) &&
    !matchesAdminPermission(permissions, ADMIN_PERMISSIONS.OPS_INBOX_REVIEW)
  ) {
    return null;
  }
  return {
    adminUserId: profile.adminUser.id,
    email: profile.adminUser.email,
    name: profile.adminUser.name,
  };
}

export type OpsTelegramIntakeResult =
  | {
      outcome: "accepted" | "duplicate";
      update: NormalizedOpsTelegramUpdate;
      member: OpsTelegramMember;
      inboxItemId: string | null;
      jobId: string | null;
    }
  | {
      outcome: "ignored";
      reason:
        | "unsupported_update"
        | "unlinked_user"
        | "group_requires_mention_or_reply"
        | "rate_limited";
      update: NormalizedOpsTelegramUpdate | null;
    };

function asInteger(value: unknown) {
  const result = Number(value);
  return Number.isSafeInteger(result) ? result : null;
}

function asBigInt(value: unknown) {
  const result = asInteger(value);
  return result === null ? null : BigInt(result);
}

function normalizedUsername(value: string | undefined | null) {
  return String(value ?? "")
    .trim()
    .replace(/^@/, "")
    .toLocaleLowerCase("en-US");
}

function hasBotMention(text: string | null, botUsername: string) {
  if (!text || !botUsername) return false;
  const escaped = botUsername.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|\\s|[^\\p{Letter}\\p{Number}_])@${escaped}\\b`, "iu").test(text);
}

function isReplyToBot(message: TelegramMessage, botUsername: string, botId: bigint | null) {
  const repliedUser = message.reply_to_message?.from;
  if (!repliedUser?.is_bot) return false;
  const repliedId = asBigInt(repliedUser.id);
  if (botId !== null && repliedId === botId) return true;
  return Boolean(
    botUsername && normalizedUsername(repliedUser.username) === normalizedUsername(botUsername)
  );
}

function mediaDescriptor(message: TelegramMessage): OpsTelegramMediaDescriptor | null {
  if (message.voice?.file_id) {
    return {
      kind: "voice",
      fileId: message.voice.file_id,
      fileUniqueId: message.voice.file_unique_id ?? null,
      fileSize: asInteger(message.voice.file_size),
      durationSeconds: asInteger(message.voice.duration),
      mimeType: message.voice.mime_type ?? "audio/ogg",
      fileName: null,
    };
  }
  if (message.audio?.file_id) {
    return {
      kind: "audio",
      fileId: message.audio.file_id,
      fileUniqueId: message.audio.file_unique_id ?? null,
      fileSize: asInteger(message.audio.file_size),
      durationSeconds: asInteger(message.audio.duration),
      mimeType: message.audio.mime_type ?? null,
      fileName: message.audio.file_name ?? null,
    };
  }
  if (message.video_note?.file_id) {
    return {
      kind: "video_note",
      fileId: message.video_note.file_id,
      fileUniqueId: message.video_note.file_unique_id ?? null,
      fileSize: asInteger(message.video_note.file_size),
      durationSeconds: asInteger(message.video_note.duration),
      mimeType: "video/mp4",
      fileName: null,
    };
  }
  const photo = [...(message.photo ?? [])]
    .filter((item) => item.file_id)
    .sort((left, right) => (right.file_size ?? 0) - (left.file_size ?? 0))[0];
  if (photo?.file_id) {
    return {
      kind: "photo",
      fileId: photo.file_id,
      fileUniqueId: photo.file_unique_id ?? null,
      fileSize: asInteger(photo.file_size),
      durationSeconds: null,
      mimeType: "image/jpeg",
      fileName: null,
    };
  }
  if (message.document?.file_id) {
    return {
      kind: "document",
      fileId: message.document.file_id,
      fileUniqueId: message.document.file_unique_id ?? null,
      fileSize: asInteger(message.document.file_size),
      durationSeconds: null,
      mimeType: message.document.mime_type ?? null,
      fileName: message.document.file_name ?? null,
    };
  }
  return null;
}

function isForwardedMessage(message: TelegramMessage | undefined) {
  return Boolean(
    message &&
      (message.forward_origin ||
        message.forward_from ||
        message.forward_from_chat ||
        message.forward_sender_name ||
        message.is_automatic_forward)
  );
}

function telegramUserDisplayName(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const user = value as Record<string, unknown>;
  const fullName = [user.first_name, user.last_name]
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join(" ");
  if (fullName) return fullName.slice(0, 200);
  const username = String(user.username ?? "").trim();
  return username ? `@${username.replace(/^@/, "").slice(0, 100)}` : null;
}

function forwardedFrom(message: TelegramMessage) {
  const origin =
    message.forward_origin && typeof message.forward_origin === "object"
      ? (message.forward_origin as Record<string, unknown>)
      : null;
  const sender =
    origin?.sender_user && typeof origin.sender_user === "object"
      ? origin.sender_user
      : message.forward_from && typeof message.forward_from === "object"
        ? message.forward_from
        : null;
  const telegramUserId =
    sender && typeof sender === "object" ? asBigInt((sender as Record<string, unknown>).id) : null;
  const hiddenName = String(origin?.sender_user_name ?? message.forward_sender_name ?? "").trim();
  const displayName = telegramUserDisplayName(sender) || hiddenName.slice(0, 200) || null;
  return telegramUserId || displayName
    ? {
        telegramUserId: telegramUserId?.toString() ?? null,
        displayName,
      }
    : null;
}

export function verifyOpsTelegramWebhookSecret(
  provided: string | null,
  expected = process.env.OPS_TELEGRAM_WEBHOOK_SECRET
) {
  const left = Buffer.from(String(provided ?? ""), "utf8");
  const right = Buffer.from(String(expected ?? ""), "utf8");
  return (
    left.length > 0 &&
    right.length > 0 &&
    left.length === right.length &&
    crypto.timingSafeEqual(left, right)
  );
}

export function normalizeOpsTelegramUpdate(
  rawUpdate: TelegramManagerUpdate,
  options: {
    botUsername?: string | null;
    botId?: string | number | bigint | null;
  } = {}
): NormalizedOpsTelegramUpdate | null {
  const updateId = asBigInt(rawUpdate.update_id);
  if (updateId === null) return null;

  let updateType: NormalizedOpsTelegramUpdate["updateType"];
  let message: TelegramMessage | undefined;
  let callbackData: string | null = null;
  let callbackQueryId: string | null = null;
  let telegramUserId: bigint | null = null;

  if (rawUpdate.message) {
    updateType = "message";
    message = rawUpdate.message;
  } else if (rawUpdate.edited_message) {
    updateType = "edited_message";
    message = rawUpdate.edited_message;
  } else if (rawUpdate.channel_post) {
    updateType = "channel_post";
    message = rawUpdate.channel_post;
  } else if (rawUpdate.callback_query?.message) {
    updateType = "callback_query";
    message = rawUpdate.callback_query.message;
    callbackData =
      String(rawUpdate.callback_query.data ?? "")
        .trim()
        .slice(0, 256) || null;
    callbackQueryId =
      String(rawUpdate.callback_query.id ?? "")
        .trim()
        .slice(0, 128) || null;
    telegramUserId = asBigInt(rawUpdate.callback_query.from?.id);
  } else {
    return null;
  }

  const chatId = asBigInt(message.chat?.id);
  telegramUserId ??= asBigInt(message.from?.id);
  if (chatId === null || telegramUserId === null) return null;

  const botUsername = normalizedUsername(options.botUsername);
  const parsedBotId = asBigInt(options.botId);
  const text =
    String(message.text ?? message.caption ?? "")
      .trim()
      .slice(0, 20_000) || null;
  const repliedUser = message.reply_to_message?.from;
  const replyToTelegramUserId =
    repliedUser && !repliedUser.is_bot ? asBigInt(repliedUser.id) : null;
  const directMedia = mediaDescriptor(message);
  const repliedMedia = directMedia ? null : mediaDescriptor(message.reply_to_message ?? {});
  const media = directMedia ?? repliedMedia;

  return {
    telegramUpdateId: updateId,
    updateType,
    chatId,
    telegramUserId,
    messageId: asInteger(message.message_id),
    messageThreadId: asInteger(message.message_thread_id),
    replyToMessageId: asInteger(message.reply_to_message?.message_id),
    replyToTelegramUserId,
    mediaSource: directMedia ? "message" : repliedMedia ? "reply" : null,
    chatType: String(message.chat?.type ?? "unknown"),
    text,
    callbackData,
    callbackQueryId,
    media,
    forwardedFrom:
      forwardedFrom(message) ??
      (repliedMedia ? forwardedFrom(message.reply_to_message ?? {}) : null),
    isUntrustedForward:
      isForwardedMessage(message) ||
      (Boolean(repliedMedia) && isForwardedMessage(message.reply_to_message)),
    mentionedBot: hasBotMention(text, botUsername),
    repliedToBot: isReplyToBot(message, botUsername, parsedBotId),
    rawUpdate,
  };
}

export function isOpsTelegramGroupAllowed(update: NormalizedOpsTelegramUpdate) {
  return (
    update.chatType === "private" ||
    update.mentionedBot ||
    update.repliedToBot ||
    update.updateType === "callback_query"
  );
}

function startOfMinute(now: Date) {
  const value = new Date(now);
  value.setUTCSeconds(0, 0);
  return value;
}

function endOfMinute(now: Date) {
  return new Date(startOfMinute(now).getTime() + 60_000);
}

function toInputJson(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export function createPrismaOpsTelegramIntakeRepository(
  client: PrismaClient
): OpsTelegramIntakeRepository {
  return {
    async resolveMember(telegramUserId) {
      return resolvePrismaOpsTelegramMember(client, telegramUserId);
    },

    async consumeRateLimit({ telegramUserId, chatId, now }) {
      const bucket = startOfMinute(now);
      const key = `ops:telegram:${telegramUserId}:${chatId}:${bucket.toISOString()}`;
      const row = await client.requestRateLimit.upsert({
        where: { key },
        create: {
          key,
          count: 1,
          bucketStart: bucket,
          expiresAt: endOfMinute(now),
        },
        update: {
          count: { increment: 1 },
          expiresAt: endOfMinute(now),
        },
        select: { count: true },
      });
      return row.count <= OPS_TELEGRAM_RATE_LIMIT_PER_MINUTE;
    },

    async persist(update, member) {
      try {
        return await client.$transaction(async (tx) => {
          const existing = await tx.opsTelegramUpdate.findUnique({
            where: { telegramUpdateId: update.telegramUpdateId },
            select: {
              inboxItem: {
                select: {
                  id: true,
                  jobs: {
                    orderBy: { createdAt: "asc" },
                    take: 1,
                    select: { id: true },
                  },
                },
              },
            },
          });
          if (existing) {
            return {
              accepted: false,
              duplicate: true,
              inboxItemId: existing.inboxItem?.id ?? null,
              jobId: existing.inboxItem?.jobs[0]?.id ?? null,
            };
          }

          const telegramUpdate = await tx.opsTelegramUpdate.create({
            data: {
              telegramUpdateId: update.telegramUpdateId,
              chatId: update.chatId,
              telegramUserId: update.telegramUserId,
              messageId: update.messageId,
              messageThreadId: update.messageThreadId,
              updateType: update.updateType,
              rawUpdate: toInputJson(update.rawUpdate),
              isUntrustedForward: update.isUntrustedForward,
            },
            select: { id: true },
          });
          const inboxItem = await tx.opsInboxItem.create({
            data: {
              telegramUpdateId: telegramUpdate.id,
              originalMessage: update.text,
              extractionStatus: OpsInboxExtractionStatus.QUEUED,
              reviewStatus: OpsInboxReviewStatus.PENDING,
            },
            select: { id: true },
          });
          const job = await tx.opsJob.create({
            data: {
              idempotencyKey: `telegram:update:${update.telegramUpdateId}`,
              inboxItemId: inboxItem.id,
              type: "telegram_intake",
              status: OpsJobStatus.QUEUED,
              stage: OpsJobStage.INGEST,
              payload: toInputJson({
                schemaVersion: 1,
                actorAdminUserId: member.adminUserId,
                telegramUpdateId: update.telegramUpdateId.toString(),
                chatId: update.chatId.toString(),
                telegramUserId: update.telegramUserId.toString(),
                messageId: update.messageId,
                messageThreadId: update.messageThreadId,
                replyToMessageId: update.replyToMessageId,
                replyToTelegramUserId: update.replyToTelegramUserId?.toString() ?? null,
                mediaSource: update.mediaSource,
                text: update.text,
                callbackData: update.callbackData,
                callbackQueryId: update.callbackQueryId,
                media: update.media,
                forwardedFrom: update.forwardedFrom,
                isUntrustedForward: update.isUntrustedForward,
                previewOnly: Boolean(
                  update.media &&
                    (update.media.kind === "voice" ||
                      update.media.kind === "audio" ||
                      update.media.kind === "video_note")
                ),
              }),
            },
            select: { id: true },
          });
          await tx.adminAuditLog.create({
            data: {
              actorId: member.adminUserId,
              actorEmail: member.email,
              actorName: member.name,
              scope: "operations",
              action: "telegram.update.accepted",
              entityType: "ops.inbox",
              entityId: inboxItem.id,
              metadata: toInputJson({
                telegramUpdateId: update.telegramUpdateId.toString(),
                updateType: update.updateType,
                hasMedia: Boolean(update.media),
                isUntrustedForward: update.isUntrustedForward,
              }),
            },
          });
          return {
            accepted: true,
            duplicate: false,
            inboxItemId: inboxItem.id,
            jobId: job.id,
          };
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          const existing = await client.opsTelegramUpdate.findUnique({
            where: { telegramUpdateId: update.telegramUpdateId },
            select: {
              inboxItem: {
                select: {
                  id: true,
                  jobs: {
                    orderBy: { createdAt: "asc" },
                    take: 1,
                    select: { id: true },
                  },
                },
              },
            },
          });
          if (existing) {
            return {
              accepted: false,
              duplicate: true,
              inboxItemId: existing.inboxItem?.id ?? null,
              jobId: existing.inboxItem?.jobs[0]?.id ?? null,
            };
          }
        }
        throw error;
      }
    },
  };
}

export async function intakeOpsTelegramUpdate(input: {
  rawUpdate: TelegramManagerUpdate;
  repository: OpsTelegramIntakeRepository;
  botUsername?: string | null;
  botId?: string | number | bigint | null;
  now?: Date;
}): Promise<OpsTelegramIntakeResult> {
  const update = normalizeOpsTelegramUpdate(input.rawUpdate, {
    botUsername: input.botUsername,
    botId: input.botId,
  });
  if (!update) {
    return { outcome: "ignored", reason: "unsupported_update", update: null };
  }

  if (!isOpsTelegramGroupAllowed(update)) {
    return { outcome: "ignored", reason: "group_requires_mention_or_reply", update };
  }

  const member = await input.repository.resolveMember(update.telegramUserId);
  if (!member) {
    return { outcome: "ignored", reason: "unlinked_user", update };
  }
  const withinLimit = await input.repository.consumeRateLimit({
    telegramUserId: update.telegramUserId,
    chatId: update.chatId,
    now: input.now ?? new Date(),
  });
  if (!withinLimit) {
    return { outcome: "ignored", reason: "rate_limited", update };
  }

  const result = await input.repository.persist(update, member);
  return {
    outcome: result.duplicate ? "duplicate" : "accepted",
    update,
    member,
    inboxItemId: result.inboxItemId,
    jobId: result.jobId,
  };
}

export function createOpsTelegramWebhookReply(
  result: Extract<OpsTelegramIntakeResult, { outcome: "accepted" | "duplicate" }>
) {
  if (result.update.updateType === "callback_query" && result.update.callbackQueryId) {
    return {
      method: "answerCallbackQuery",
      callback_query_id: result.update.callbackQueryId,
      text: result.outcome === "duplicate" ? "Действие уже принято" : "Действие принято",
    };
  }
  const text =
    result.outcome === "duplicate"
      ? "✅ Уже принято. Повторную задачу не создаю."
      : result.update.media && result.update.replyToMessageId
        ? "✅ Принял голосовое или файл как обновление. Расшифрую, проверю связанную задачу и пришлю результат."
        : result.update.media
          ? "✅ Принял файл. Обработаю его в фоне и пришлю результат."
          : "✅ Принял. Разбираю сообщение и подготовлю задачи.";
  return {
    method: "sendMessage",
    chat_id: result.update.chatId.toString(),
    text,
    ...(result.update.messageId
      ? {
          reply_parameters: {
            message_id: result.update.messageId,
            allow_sending_without_reply: true,
          },
        }
      : {}),
  };
}
