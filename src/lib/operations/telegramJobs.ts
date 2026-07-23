import crypto from "node:crypto";
import {
  OpsAttachmentState,
  OpsAutomationStatus,
  OpsBlockerType,
  OpsInboxExtractionStatus,
  OpsInboxReviewStatus,
  OpsJobStage,
  OpsKnowledgeStatus,
  OpsProposalKind,
  OpsProposalStatus,
  OpsTaskEventType,
  OpsTaskSourceType,
  OpsTaskStatus,
  Prisma,
  type OpsJob,
  type PrismaClient,
} from "@prisma/client";
import { ADMIN_PERMISSIONS, matchesAdminPermission } from "@/lib/admin/adminPermissions";
import {
  createPrismaOpsAiBudget,
  extractOpsProposalWithAi,
  transcribeOpsMediaWithAi,
  type OpsExtraction,
} from "@/lib/operations/ai";
import { opsBrandProperNameHintsForClient } from "@/lib/operations/brandGuides";
import { opsAdminLink, resolveOpsAdminBaseUrl } from "@/lib/operations/adminLinks";
import {
  createOpsTelegramCallbackState,
  executeOpsTelegramCallback,
  finalizeTelegramCallbackInbox,
} from "@/lib/operations/telegramCallbacks";
import {
  OPS_AUTOMATION_REGISTRY,
  parseOpsAutomationRequest,
  type OpsAutomationType,
} from "@/lib/operations/automation";
import { isOpsAutomationsEnabled } from "@/lib/operations/featureFlags";
import type { OpsJobStageExecutor } from "@/lib/operations/jobs";
import {
  checksumOpsMedia,
  createConfiguredOpsMediaStore,
  createOpsMediaStorageKey,
  downloadOpsTelegramFile,
  OpsMediaError,
  opsAttachmentRetentionAt,
  assertOpsMediaStorageBudget,
  assertOpsMediaMagicBytes,
  releaseOpsMediaStorageReservation,
  reserveOpsMediaStorageBudget,
  validateOpsTelegramMedia,
  type OpsMediaStorageReservation,
  type OpsPrivateMediaStore,
} from "@/lib/operations/media";
import {
  buildOpsInboxNotification,
  OpsNotificationError,
  sendOpsTelegramNotification,
  type OpsTelegramReplyMarkup,
} from "@/lib/operations/notifications";
import { opsRolesAllowNotification } from "@/lib/operations/notificationAccess";
import type { OpsTelegramMediaDescriptor } from "@/lib/operations/telegram";
import { createOpsExternalId } from "@/lib/operations/ids";
import { appendOpsSourceUrls, linkMatchingBrandGuides } from "@/lib/operations/brandGuides";
import { normalizeTaskCreateInput, resolveOpsTaskDueAt } from "@/lib/operations/tasks";
import { enqueueOpsTaskAssignmentNotification } from "@/lib/operations/taskNotifications";
import { assertValidOpsTaskRelations } from "@/lib/operations/taskRelations";

type ResolvedOpsContext = {
  source: "reply" | "topic" | "explicit" | "single_active" | "none";
  projectId: string | null;
  taskId: string | null;
  shopOrderId: string | null;
  ambiguous?: boolean;
};

export const OPS_TELEGRAM_AUTO_CREATE_MIN_CONFIDENCE = 0.9;

export type OpsTelegramAutoCreateDecision = {
  eligible: boolean;
  reason:
    | "enabled"
    | "disabled"
    | "not_explicit_text_task"
    | "media_preview_only"
    | "untrusted_forward"
    | "requires_approval"
    | "ambiguous"
    | "invalid_task_count"
    | "low_confidence"
    | "unresolved_assignee"
    | "unresolved_context"
    | "actor_forbidden"
    | "assignment_forbidden";
};

export type TelegramJobPayload = {
  schemaVersion: number;
  actorAdminUserId: string;
  telegramUpdateId: string;
  chatId: string;
  telegramUserId: string;
  messageId: number | null;
  messageThreadId: number | null;
  replyToMessageId: number | null;
  replyToTelegramUserId?: string | null;
  mediaSource?: "message" | "reply" | null;
  text: string | null;
  callbackData: string | null;
  callbackQueryId?: string | null;
  media: OpsTelegramMediaDescriptor | null;
  forwardedFrom?: {
    telegramUserId: string | null;
    displayName: string | null;
  } | null;
  isUntrustedForward: boolean;
  previewOnly: boolean;
  attachmentId?: string;
  storageKey?: string;
  attachmentMimeType?: string;
  transcription?: string;
  extractionText?: string;
  extraction?: OpsExtraction;
  context?: ResolvedOpsContext;
  callbackResponse?: string;
  callbackLink?: string | null;
  taskUpdateEventId?: string | null;
  autoApplied?: boolean;
  autoAppliedTaskIds?: string[];
  batchId?: string;
  batchMode?: "ONE_TASK" | "SPLIT_TASKS";
  batchItems?: Array<{
    telegramUpdateId: string;
    messageId: number | null;
    text: string | null;
    media: OpsTelegramMediaDescriptor | null;
    forwardedFrom: {
      telegramUserId: string | null;
      displayName: string | null;
    } | null;
    isUntrustedForward: boolean;
  }>;
  batchStoredItems?: Array<{
    ordinal: number;
    text: string | null;
    media: OpsTelegramMediaDescriptor | null;
    forwardedFrom: {
      telegramUserId: string | null;
      displayName: string | null;
    } | null;
    attachmentId: string | null;
    storageKey: string | null;
    mimeType: string | null;
    transcription: string | null;
  }>;
};

export type OpsTelegramJobDependencies = {
  mediaStore?: OpsPrivateMediaStore;
  fetchImpl?: typeof fetch;
};

const TELEGRAM_CHAT_LINE =
  /^\s*\[\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\s+\d{1,2}:\d{2}(?::\d{2})?\]\s*[^:\n]{1,100}:\s*/u;
const OPS_URL_PATTERN = /https?:\/\/[^\s<>"']+/giu;

function isTelegramAudioMedia(media: OpsTelegramMediaDescriptor | null | undefined) {
  return media?.kind === "voice" || media?.kind === "audio" || media?.kind === "video_note";
}

function cleanTelegramTaskText(rawText: string) {
  const original = rawText
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, 30_000);
  const lines = original
    .split(/\r?\n/)
    .map((line) => line.replace(TELEGRAM_CHAT_LINE, "").trim())
    .filter(Boolean);
  return {
    original,
    content: Array.from(new Set(lines)).join("\n"),
  };
}

function personReferenceFromTaskText(text: string) {
  const patterns = [
    /(?:створи|створити|создай|создать|додай|добавь|поставь)\s+(?:нову\s+|новую\s+)?задач\p{Letter}*\s+(?:для|на)\s+([\p{Letter}'’-]+)/iu,
    /(?:признач|назнач)\p{Letter}*\s+(?:на\s+)?([\p{Letter}'’-]+)/iu,
    /(?:виконавець|исполнитель)\s*[:—-]?\s*([\p{Letter}'’-]+(?:\s+[\p{Letter}'’-]+)?)/iu,
  ];
  for (const pattern of patterns) {
    const reference = text.match(pattern)?.[1]?.trim();
    if (reference) return reference;
  }
  return null;
}

function capitalize(value: string) {
  return value ? `${value.charAt(0).toLocaleUpperCase("uk-UA")}${value.slice(1)}` : value;
}

function taskEntities(text: string) {
  const urls = text.match(OPS_URL_PATTERN) ?? [];
  const withoutUrls = text.replace(OPS_URL_PATTERN, " ");
  const sku =
    withoutUrls
      .match(/\b[A-ZА-ЯІЇЄҐ]{2,}[A-ZА-ЯІЇЄҐ0-9]*-\d[A-ZА-ЯІЇЄҐ0-9-]*\b/iu)?.[0]
      ?.toLocaleUpperCase("en-US") ?? null;
  const productUrl = urls.find((url) => /\/products\//i.test(url)) ?? null;
  const urlProduct = productUrl
    ?.match(/\/products\/([a-z0-9]+)-([a-z][a-z0-9]*(?:-[a-z0-9]+)+)/i)
    ?.slice(1, 3);
  const brandFromText = withoutUrls.match(/\bdo\s*88\b/iu)?.[0];
  const brand = brandFromText ? "Do88" : urlProduct?.[0] ? capitalize(urlProduct[0]) : null;
  const urlSku = urlProduct?.[1]?.toLocaleUpperCase("en-US") ?? null;
  const vehicle = withoutUrls.match(
    /(?:Volvo|Вольво|BMW|БМВ|Mercedes|Мерседес|Audi|Ауді|Ауди|Porsche|Порше|Volkswagen|Фольксваген|VW)/iu
  )?.[0];
  const vehicleNames: Record<string, string> = {
    вольво: "Volvo",
    бмв: "BMW",
    мерседес: "Mercedes",
    ауді: "Audi",
    ауди: "Audi",
    порше: "Porsche",
    фольксваген: "Volkswagen",
  };
  const normalizedVehicle = vehicle
    ? (vehicleNames[vehicle.toLocaleLowerCase("uk-UA")] ??
      capitalize(vehicle.toLocaleLowerCase("en-US")))
    : null;
  return {
    brand,
    sku: sku ?? urlSku,
    vehicle: normalizedVehicle,
  };
}

function stripTaskCommand(text: string) {
  return text
    .replace(/^(?:привіт|вітаю|добрий\s+день|привет|здравствуй)[,!.:\s—-]*/iu, "")
    .replace(
      /^(?:будь\s+ласка[,\s]*)?(?:створи|створити|создай|создать|додай|добавь|поставь)\s+(?:нову\s+|новую\s+)?задач\p{Letter}*\s*/iu,
      ""
    )
    .replace(/^(?:для|на)\s+[\p{Letter}'’-]+\s+(?:щоб|чтобы)\s+(?:він|вона|он|она)\s+/iu, "")
    .replace(/^(?:щоб|чтобы)\s+(?:він|вона|он|она)\s+/iu, "")
    .trim();
}

function buildManualTaskTitle(content: string) {
  const entities = taskEntities(content);
  const plain = content.replace(OPS_URL_PATTERN, " ").replace(/\s+/g, " ").trim();
  const product = [entities.brand, entities.sku].filter(Boolean).join(" ");
  const vehicle = entities.vehicle ? ` для ${entities.vehicle}` : "";
  const mentionsPayment = /(?:оплат|бабк|грош|деньг|кошти)/iu.test(plain);
  const checksArrival = /(?:прийш|приш|надійш|поступ)/iu.test(plain);
  const ordersProduct = /(?:замов|заказ)/iu.test(plain);
  const contact = plain.match(/(?:у|в)\s+([\p{Letter}'’-]{2,30})\s+(?:чи|ли)(?:\s|$)/iu)?.[1];

  if (mentionsPayment && checksArrival && ordersProduct) {
    return [
      "Уточнити",
      contact ? `у ${capitalize(contact)}` : null,
      "надходження оплати та замовити",
      product || "товар",
      vehicle || null,
    ]
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }

  if (ordersProduct && product) {
    return `Замовити ${product}${vehicle}`.trim();
  }

  const command = stripTaskCommand(plain)
    .replace(/\b(?:замовив|замовила|замовили)\b/iu, "замовити")
    .replace(/\b(?:перевірив|перевірила|перевірили)\b/iu, "перевірити")
    .replace(/\b(?:проверил|проверила|проверили)\b/iu, "проверить")
    .trim();
  return capitalize(command || plain).slice(0, 180);
}

export function createManualOpsExtraction(
  rawText: string,
  reason: "AI_BUDGET_EXHAUSTED" | "AI_NOT_CONFIGURED"
): OpsExtraction {
  const { original, content } = cleanTelegramTaskText(rawText);
  const compact = content.replace(/\s+/g, " ").trim();
  const title = buildManualTaskTitle(content) || "Нове повідомлення з Telegram";
  const assigneeReference = personReferenceFromTaskText(content);
  const structured = title !== compact || Boolean(assigneeReference);
  return {
    intent: "task",
    summary: title,
    project_candidates: [],
    order_candidates: [],
    tasks: [
      {
        title,
        description:
          original.includes("\n") || /https?:\/\//iu.test(original) || compact !== title
            ? original
            : null,
        priority: "normal",
        due_at: null,
        assignee_ref: assigneeReference,
        next_action: null,
        definition_of_done: null,
        executor_type: "human",
        project_ref: null,
        order_ref: null,
      },
    ],
    confidence: structured ? "0.70" : "0.35",
    ambiguities: structured
      ? []
      : [
          reason === "AI_NOT_CONFIGURED"
            ? "Перевірте формулювання задачі перед створенням."
            : "Ліміт AI вичерпано: перевірте формулювання задачі.",
        ],
    requires_approval: false,
  };
}

export function asPayload(job: OpsJob): TelegramJobPayload {
  const payload = (job.payload && typeof job.payload === "object" ? job.payload : {}) as Record<
    string,
    unknown
  >;
  const media =
    payload.media && typeof payload.media === "object"
      ? (payload.media as OpsTelegramMediaDescriptor)
      : null;
  return {
    schemaVersion: Number(payload.schemaVersion ?? 1),
    actorAdminUserId: String(payload.actorAdminUserId ?? ""),
    telegramUpdateId: String(payload.telegramUpdateId ?? ""),
    chatId: String(payload.chatId ?? ""),
    telegramUserId: String(payload.telegramUserId ?? ""),
    messageId: Number.isSafeInteger(Number(payload.messageId)) ? Number(payload.messageId) : null,
    messageThreadId: Number.isSafeInteger(Number(payload.messageThreadId))
      ? Number(payload.messageThreadId)
      : null,
    replyToMessageId: Number.isSafeInteger(Number(payload.replyToMessageId))
      ? Number(payload.replyToMessageId)
      : null,
    replyToTelegramUserId: payload.replyToTelegramUserId
      ? String(payload.replyToTelegramUserId)
      : null,
    mediaSource:
      payload.mediaSource === "message" || payload.mediaSource === "reply"
        ? payload.mediaSource
        : null,
    text: payload.text ? String(payload.text) : null,
    callbackData: payload.callbackData ? String(payload.callbackData) : null,
    callbackQueryId: payload.callbackQueryId ? String(payload.callbackQueryId) : null,
    media,
    forwardedFrom:
      payload.forwardedFrom && typeof payload.forwardedFrom === "object"
        ? {
            telegramUserId:
              String((payload.forwardedFrom as Record<string, unknown>).telegramUserId ?? "") ||
              null,
            displayName:
              String((payload.forwardedFrom as Record<string, unknown>).displayName ?? "") || null,
          }
        : null,
    isUntrustedForward: payload.isUntrustedForward === true,
    previewOnly: payload.previewOnly === true,
    attachmentId: payload.attachmentId ? String(payload.attachmentId) : undefined,
    storageKey: payload.storageKey ? String(payload.storageKey) : undefined,
    attachmentMimeType: payload.attachmentMimeType ? String(payload.attachmentMimeType) : undefined,
    transcription: payload.transcription ? String(payload.transcription) : undefined,
    extractionText: payload.extractionText ? String(payload.extractionText) : undefined,
    extraction:
      payload.extraction && typeof payload.extraction === "object"
        ? (payload.extraction as OpsExtraction)
        : undefined,
    context:
      payload.context && typeof payload.context === "object"
        ? (payload.context as ResolvedOpsContext)
        : undefined,
    callbackResponse: payload.callbackResponse ? String(payload.callbackResponse) : undefined,
    callbackLink: payload.callbackLink ? String(payload.callbackLink) : null,
    autoApplied: payload.autoApplied === true,
    autoAppliedTaskIds: Array.isArray(payload.autoAppliedTaskIds)
      ? payload.autoAppliedTaskIds.map(String).filter(Boolean).slice(0, 5)
      : undefined,
    batchId: payload.batchId ? String(payload.batchId) : undefined,
    batchMode:
      payload.batchMode === "ONE_TASK" || payload.batchMode === "SPLIT_TASKS"
        ? payload.batchMode
        : undefined,
    batchItems: Array.isArray(payload.batchItems)
      ? payload.batchItems.map((item) => {
          const value = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
          return {
            telegramUpdateId: String(value.telegramUpdateId ?? ""),
            messageId: Number.isSafeInteger(Number(value.messageId))
              ? Number(value.messageId)
              : null,
            text: value.text ? String(value.text) : null,
            media:
              value.media && typeof value.media === "object"
                ? (value.media as OpsTelegramMediaDescriptor)
                : null,
            forwardedFrom:
              value.forwardedFrom && typeof value.forwardedFrom === "object"
                ? {
                    telegramUserId:
                      String(
                        (value.forwardedFrom as Record<string, unknown>).telegramUserId ?? ""
                      ) || null,
                    displayName:
                      String((value.forwardedFrom as Record<string, unknown>).displayName ?? "") ||
                      null,
                  }
                : null,
            isUntrustedForward: value.isUntrustedForward === true,
          };
        })
      : undefined,
    batchStoredItems: Array.isArray(payload.batchStoredItems)
      ? payload.batchStoredItems.map((item) => {
          const value = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
          return {
            ordinal: Number(value.ordinal),
            text: value.text ? String(value.text) : null,
            media:
              value.media && typeof value.media === "object"
                ? (value.media as OpsTelegramMediaDescriptor)
                : null,
            forwardedFrom:
              value.forwardedFrom && typeof value.forwardedFrom === "object"
                ? {
                    telegramUserId:
                      String(
                        (value.forwardedFrom as Record<string, unknown>).telegramUserId ?? ""
                      ) || null,
                    displayName:
                      String((value.forwardedFrom as Record<string, unknown>).displayName ?? "") ||
                      null,
                  }
                : null,
            attachmentId: value.attachmentId ? String(value.attachmentId) : null,
            storageKey: value.storageKey ? String(value.storageKey) : null,
            mimeType: value.mimeType ? String(value.mimeType) : null,
            transcription: value.transcription ? String(value.transcription) : null,
          };
        })
      : undefined,
  };
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, stableValue(child)])
    );
  }
  return value;
}

function proposalHash(payload: unknown) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(stableValue(payload)))
    .digest("hex");
}

function dateOrNull(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function extractedTaskTags(task: OpsExtraction["tasks"][number]) {
  const prefixes = [
    ["brand", task.brand_tags ?? []],
    ["product", task.product_tags ?? []],
    ["process", task.process_tags ?? []],
  ] as const;
  const seen = new Set<string>();
  return prefixes.flatMap(([prefix, values]) =>
    values.flatMap((value) => {
      const clean = value
        .replace(/\u0000/g, "")
        .trim()
        .slice(0, 90);
      if (!clean) return [];
      const tag = `${prefix}:${clean}`;
      const key = tag.toLocaleLowerCase("en-US");
      if (seen.has(key)) return [];
      seen.add(key);
      return [tag];
    })
  );
}

export async function extractionContext(client: PrismaClient, payload: TelegramJobPayload) {
  const [requester, repliedMessageAuthor, assignmentCandidates] = await Promise.all([
    client.adminUser.findUnique({
      where: { id: payload.actorAdminUserId },
      select: { id: true, name: true },
    }),
    payload.replyToTelegramUserId && /^\d+$/.test(payload.replyToTelegramUserId)
      ? client.opsMemberProfile.findUnique({
          where: { telegramUserId: BigInt(payload.replyToTelegramUserId) },
          select: { adminUser: { select: { id: true, name: true, isActive: true } } },
        })
      : null,
    client.adminUser.findMany({
      where: { isActive: true },
      orderBy: [{ name: "asc" }, { email: "asc" }],
      select: {
        id: true,
        name: true,
        opsProfile: {
          select: { telegramUserId: true, telegramEnabled: true },
        },
        roles: {
          select: {
            role: { select: { permissions: true } },
          },
        },
      },
    }),
  ]);
  const assignmentDirectory = assignmentCandidates
    .filter((candidate) =>
      matchesAdminPermission(
        candidate.roles.flatMap(({ role }) => role.permissions),
        ADMIN_PERMISSIONS.OPS_TASKS_READ
      )
    )
    .map((candidate) => ({
      id: candidate.id,
      name: candidate.name,
      telegramUserId:
        candidate.opsProfile?.telegramEnabled && candidate.opsProfile.telegramUserId
          ? candidate.opsProfile.telegramUserId.toString()
          : null,
    }));
  return {
    source: "telegram",
    commandText: payload.transcription ? payload.text : null,
    batch: payload.batchId
      ? {
          id: payload.batchId,
          mode: payload.batchMode,
          itemCount: payload.batchItems?.length ?? 0,
          oneTaskRequired: payload.batchMode === "ONE_TASK",
        }
      : null,
    replyToMessageId: payload.replyToMessageId,
    mediaSource: payload.mediaSource ?? null,
    messageThreadId: payload.messageThreadId,
    forwardedContentIsUntrusted: payload.isUntrustedForward,
    participants: {
      requester: requester ? { id: requester.id, name: requester.name } : null,
      repliedMessageAuthor:
        repliedMessageAuthor?.adminUser.isActive === true
          ? {
              id: repliedMessageAuthor.adminUser.id,
              name: repliedMessageAuthor.adminUser.name,
            }
          : null,
    },
    forwardedFrom: payload.forwardedFrom,
    assignmentRules: {
      directoryIsAuthoritative: true,
      returnExactDirectoryIdInAssigneeRef: true,
      requesterIsCreatorNotAutomaticAssignee: true,
      commandMeMeansRequester: true,
      commandHimOrHerMeansRepliedMessageAuthor: true,
      absentExplicitAssigneeMeansUnassigned: true,
      ambiguousNameMeansUnassigned: true,
      forwardedAuthorIsSourceNotAutomaticAssignee: true,
      explicitSelfCommitmentByForwardedAuthorCanAssignThatAuthor: true,
    },
    assignmentDirectory,
    context: payload.context ?? null,
    safety: {
      priceArithmetic: "forbidden",
      checkout: "forbidden",
      externalMessaging: "forbidden",
      maximumTasks: 5,
    },
  };
}

async function resolveContext(
  client: PrismaClient,
  payload: TelegramJobPayload
): Promise<ResolvedOpsContext> {
  const chatId = BigInt(payload.chatId);
  const telegramUserId = BigInt(payload.telegramUserId);
  if (payload.replyToMessageId) {
    const delivery = await client.opsTelegramDelivery.findUnique({
      where: {
        chatId_telegramMessageId: {
          chatId,
          telegramMessageId: payload.replyToMessageId,
        },
      },
      select: {
        taskId: true,
        task: { select: { projectId: true, shopOrderId: true } },
      },
    });
    if (delivery?.taskId) {
      return {
        source: "reply",
        taskId: delivery.taskId,
        projectId: delivery.task?.projectId ?? null,
        shopOrderId: delivery.task?.shopOrderId ?? null,
      };
    }
  }

  if (payload.messageThreadId !== null) {
    const topic = await client.opsTelegramContext.findFirst({
      where: {
        chatId,
        messageThreadId: payload.messageThreadId,
        active: true,
        OR: [{ telegramUserId }, { telegramUserId: null }],
        AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }],
      },
      orderBy: { updatedAt: "desc" },
      select: { projectId: true, taskId: true, shopOrderId: true },
    });
    if (topic) return { source: "topic", ...topic };
  }

  const text = payload.text ?? payload.transcription ?? "";
  const projectToken = text.match(/\bPRJ-\d{8}-[A-F0-9]{8}\b/i)?.[0];
  if (projectToken) {
    const project = await client.opsProject.findUnique({
      where: { externalId: projectToken.toUpperCase() },
      select: { id: true },
    });
    if (project) {
      return {
        source: "explicit",
        projectId: project.id,
        taskId: null,
        shopOrderId: null,
      };
    }
  }
  const orderToken = text.match(/\b(?:ORD|OC)-[A-Z0-9-]{3,40}\b/i)?.[0];
  if (orderToken) {
    const order = await client.shopOrder.findUnique({
      where: { orderNumber: orderToken },
      select: { id: true },
    });
    if (order) {
      return {
        source: "explicit",
        projectId: null,
        taskId: null,
        shopOrderId: order.id,
      };
    }
  }

  const active = await client.opsTelegramContext.findMany({
    where: {
      chatId,
      telegramUserId,
      active: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: { updatedAt: "desc" },
    take: 2,
    select: { projectId: true, taskId: true, shopOrderId: true },
  });
  if (active.length === 1) return { source: "single_active", ...active[0] };
  return {
    source: "none",
    projectId: null,
    taskId: null,
    shopOrderId: null,
    ambiguous: active.length > 1,
  };
}

function canonicalPersonToken(value: string) {
  const normalized = value
    .normalize("NFKD")
    .toLocaleLowerCase("uk-UA")
    .replace(/[іїєё]/g, "и")
    .replace(/ґ/g, "г")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "");
  const aliases: Record<string, string> = {
    игор: "игор",
    игорь: "игор",
    игоря: "игор",
    игорю: "игор",
    игорем: "игор",
    саша: "саша",
    саше: "саша",
    сашу: "саша",
    саши: "саша",
    александр: "саша",
    александру: "саша",
    олександр: "саша",
    олександру: "саша",
    иван: "иван",
    ивана: "иван",
    ивану: "иван",
    ваня: "иван",
    ваню: "иван",
    ване: "иван",
    вани: "иван",
    сергей: "сергей",
    сергея: "сергей",
    сергею: "сергей",
    сергий: "сергей",
    сергій: "сергей",
    сергію: "сергей",
  };
  return aliases[normalized] ?? normalized;
}

function personTokens(value: string) {
  return value
    .split(/[\s,.;:()[\]{}]+/u)
    .map(canonicalPersonToken)
    .filter(Boolean);
}

export function matchOpsAssigneeCandidate(
  reference: string,
  candidates: Array<{
    id: string;
    email: string;
    name: string | null;
    permissions: string[];
  }>
) {
  const normalized = reference.trim();
  const referenceTokens = personTokens(normalized);
  const normalizedReference = normalized.toLocaleLowerCase("uk-UA");
  const matches = candidates.filter((candidate) => {
    if (!matchesAdminPermission(candidate.permissions, ADMIN_PERMISSIONS.OPS_TASKS_READ)) {
      return false;
    }
    if (
      candidate.id === normalized ||
      candidate.email.toLocaleLowerCase("uk-UA") === normalizedReference ||
      candidate.name?.trim().toLocaleLowerCase("uk-UA") === normalizedReference
    ) {
      return true;
    }
    if (!referenceTokens.length || !candidate.name) return false;
    const candidateTokens = personTokens(candidate.name);
    return referenceTokens.every((token, index) =>
      index === 0 ? candidateTokens[0] === token : candidateTokens.includes(token)
    );
  });
  return matches.length === 1 ? matches[0].id : null;
}

async function resolveAssignee(
  client: PrismaClient | Prisma.TransactionClient,
  reference: string | null
) {
  if (!reference) return null;
  const normalized = reference.trim();
  const candidates = await client.adminUser.findMany({
    where: {
      isActive: true,
    },
    select: {
      id: true,
      email: true,
      name: true,
      roles: {
        select: {
          role: {
            select: { permissions: true },
          },
        },
      },
    },
  });
  return matchOpsAssigneeCandidate(
    normalized,
    candidates.map((candidate) => ({
      id: candidate.id,
      email: candidate.email,
      name: candidate.name,
      permissions: candidate.roles.flatMap(({ role }) => role.permissions),
    }))
  );
}

function referencesRequester(reference: string) {
  return /^(?:мне|меня|мені|себе|я)$/iu.test(reference.trim());
}

function referencesRepliedAuthor(reference: string) {
  return /^(?:ему|ей|йому|їй|автору|отправителю|відправнику)$/iu.test(reference.trim());
}

async function resolveAssigneeByTelegramUserId(
  client: PrismaClient | Prisma.TransactionClient,
  telegramUserId: string | null
) {
  if (!telegramUserId || !/^\d+$/.test(telegramUserId)) return null;
  const profile = await client.opsMemberProfile.findFirst({
    where: {
      telegramUserId: BigInt(telegramUserId),
      telegramEnabled: true,
      adminUser: { isActive: true },
    },
    select: {
      adminUserId: true,
      adminUser: {
        select: {
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
  return matchesAdminPermission(permissions, ADMIN_PERMISSIONS.OPS_TASKS_READ)
    ? profile.adminUserId
    : null;
}

async function createProposals(client: PrismaClient, job: OpsJob, payload: TelegramJobPayload) {
  if (!job.inboxItemId || !payload.extraction) {
    throw new Error("OPS_EXTRACTION_MISSING");
  }
  const context = payload.context ?? {
    source: "none",
    projectId: null,
    taskId: null,
    shopOrderId: null,
  };
  let unresolvedAssignee = false;
  const replyAssigneeId = await resolveAssigneeByTelegramUserId(
    client,
    payload.replyToTelegramUserId ?? null
  );
  const hasExtractedContextReference = payload.extraction.tasks.some((task) =>
    Boolean(task.project_ref || task.order_ref)
  );
  const unresolvedContext =
    context.ambiguous === true ||
    (context.source === "none" &&
      (hasExtractedContextReference ||
        payload.extraction.project_candidates.length > 0 ||
        payload.extraction.order_candidates.length > 0));
  let ordinal = 0;
  for (const extracted of payload.extraction.tasks.slice(0, 5)) {
    const explicitAssigneeId = extracted.assignee_ref
      ? referencesRequester(extracted.assignee_ref)
        ? payload.actorAdminUserId
        : referencesRepliedAuthor(extracted.assignee_ref)
          ? replyAssigneeId
          : await resolveAssignee(client, extracted.assignee_ref)
      : null;
    const assigneeId = explicitAssigneeId;
    if (extracted.assignee_ref && !assigneeId) unresolvedAssignee = true;
    const proposal = {
      title: extracted.title,
      description: extracted.description,
      tags: extractedTaskTags(extracted),
      status: "INBOX",
      priority: extracted.priority.toUpperCase(),
      executorType: extracted.executor_type.toUpperCase(),
      dueAt: dateOrNull(extracted.due_at),
      nextAction: extracted.next_action,
      definitionOfDone: extracted.definition_of_done,
      assigneeId,
      projectId: context.projectId,
      shopOrderId: context.shopOrderId,
      parentTaskId: context.taskId,
      sourceType: "TELEGRAM",
      sourceId: job.inboxItemId,
      sourceKey: `telegram:${payload.telegramUpdateId}:task:${ordinal}`,
      extractionMetadata: {
        assigneeReference: extracted.assignee_ref,
        assigneeSource: explicitAssigneeId
          ? referencesRequester(extracted.assignee_ref ?? "")
            ? "requester"
            : referencesRepliedAuthor(extracted.assignee_ref ?? "")
              ? "reply_author"
              : "explicit"
          : "none",
        projectReference: extracted.project_ref,
        orderReference: extracted.order_ref,
        contextSource: context.source,
        untrustedForward: payload.isUntrustedForward,
      },
    };
    const hash = proposalHash(proposal);
    await client.opsInboxProposal.upsert({
      where: {
        inboxItemId_payloadHash: {
          inboxItemId: job.inboxItemId,
          payloadHash: hash,
        },
      },
      create: {
        inboxItemId: job.inboxItemId,
        kind: OpsProposalKind.TASK,
        ordinal,
        payload: proposal as Prisma.InputJsonValue,
        payloadHash: hash,
        confidence: payload.extraction.confidence,
        status: OpsProposalStatus.PENDING,
      },
      update: {},
    });
    ordinal += 1;
  }

  const ambiguities = [
    ...payload.extraction.ambiguities,
    ...(context.ambiguous ? ["Найдено несколько активных контекстов."] : []),
    ...(unresolvedContext && !context.ambiguous ? ["Нужно выбрать проект или заказ вручную."] : []),
    ...(unresolvedAssignee ? ["Не удалось однозначно определить исполнителя."] : []),
    ...(context.source === "none" &&
    (payload.extraction.project_candidates.length > 1 ||
      payload.extraction.order_candidates.length > 1)
      ? ["Нужно выбрать проект или заказ вручную."]
      : []),
  ];
  await client.opsInboxItem.update({
    where: { id: job.inboxItemId },
    data: {
      extractionStatus: OpsInboxExtractionStatus.READY,
      confidence: payload.extraction.confidence,
      summary: payload.extraction.summary,
      ambiguities,
      requiresApproval:
        payload.extraction.requires_approval ||
        unresolvedAssignee ||
        unresolvedContext ||
        payload.previewOnly ||
        payload.isUntrustedForward,
      processedAt: new Date(),
      processingErrorType: null,
      processingError: null,
    },
  });
  return { proposalCount: ordinal, ambiguities, unresolvedAssignee, unresolvedContext };
}

function flagEnabled(value: string | undefined) {
  return value === "1" || value?.toLocaleLowerCase("en-US") === "true";
}

export function decideOpsTelegramAutoCreate(input: {
  enabled: boolean;
  hasExplicitText: boolean;
  hasMedia: boolean;
  previewOnly: boolean;
  isUntrustedForward: boolean;
  intent: OpsExtraction["intent"];
  taskCount: number;
  confidence: string;
  requiresApproval: boolean;
  ambiguityCount: number;
  unresolvedAssignee: boolean;
  unresolvedContext: boolean;
  actorAllowed?: boolean;
  assignmentAllowed?: boolean;
}): OpsTelegramAutoCreateDecision {
  if (!input.enabled) return { eligible: false, reason: "disabled" };
  if (input.previewOnly || input.hasMedia) {
    return { eligible: false, reason: "media_preview_only" };
  }
  if (input.isUntrustedForward) {
    return { eligible: false, reason: "untrusted_forward" };
  }
  if (!input.hasExplicitText || input.intent !== "task") {
    return { eligible: false, reason: "not_explicit_text_task" };
  }
  if (input.taskCount < 1 || input.taskCount > 5) {
    return { eligible: false, reason: "invalid_task_count" };
  }
  if (input.requiresApproval) {
    return { eligible: false, reason: "requires_approval" };
  }
  if (input.ambiguityCount > 0) {
    return { eligible: false, reason: "ambiguous" };
  }
  const confidence = Number.parseFloat(input.confidence);
  if (!Number.isFinite(confidence) || confidence < OPS_TELEGRAM_AUTO_CREATE_MIN_CONFIDENCE) {
    return { eligible: false, reason: "low_confidence" };
  }
  if (input.unresolvedAssignee) {
    return { eligible: false, reason: "unresolved_assignee" };
  }
  if (input.unresolvedContext) {
    return { eligible: false, reason: "unresolved_context" };
  }
  if (input.actorAllowed === false) {
    return { eligible: false, reason: "actor_forbidden" };
  }
  if (input.assignmentAllowed === false) {
    return { eligible: false, reason: "assignment_forbidden" };
  }
  return { eligible: true, reason: "enabled" };
}

type OpsTelegramAutoCreateActor = {
  id: string;
  email: string;
  name: string;
  permissions: string[];
};

async function resolveAutoCreateActor(
  tx: Prisma.TransactionClient,
  actorAdminUserId: string
): Promise<OpsTelegramAutoCreateActor | null> {
  const actor = await tx.adminUser.findFirst({
    where: { id: actorAdminUserId, isActive: true },
    select: {
      id: true,
      email: true,
      name: true,
      roles: {
        select: { role: { select: { permissions: true } } },
      },
    },
  });
  if (!actor) return null;
  return {
    id: actor.id,
    email: actor.email,
    name: actor.name?.trim() || actor.email,
    permissions: Array.from(new Set(actor.roles.flatMap(({ role }) => role.permissions))),
  };
}

export function parseTelegramTaskDescriptionUpdate(text: string | null | undefined) {
  const source = String(text ?? "").trim();
  const match =
    /(?:^|\s)(?:(?:по\s+)?(?:задач(?:а|е|у|і|и)|таск(?:е|у)?)\s*[#№]?|[#№])(\d{1,9})\b/iu.exec(
      source
    );
  if (!match) return null;
  const number = Number.parseInt(match[1], 10);
  const update = source
    .slice((match.index ?? 0) + match[0].length)
    .replace(/^[\s:—–,.-]+/u, "")
    .trim()
    .slice(0, 3_000);
  return Number.isSafeInteger(number) && update ? { number, update } : null;
}

function cleanTelegramProgressText(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/@[A-Za-z0-9_]{3,64}/gu, "")
    .replace(/^[\s:—–,.-]+/u, "")
    .trim()
    .slice(0, 3_000);
}

function taskStatusLabel(status: OpsTaskStatus) {
  const labels: Record<OpsTaskStatus, string> = {
    INBOX: "Входящие",
    PLANNED: "Запланировано",
    IN_PROGRESS: "В работе",
    AGENT_RUNNING: "Выполняет помощник",
    WAITING_HUMAN: "Ждём сотрудника",
    WAITING_EXTERNAL: "Ждём внешнюю сторону",
    NEEDS_APPROVAL: "Нужно согласование",
    REVIEW: "Готово к проверке",
    BLOCKED: "Заблокировано",
    DONE: "Готово",
    CANCELLED: "Отменено",
  };
  return labels[status];
}

async function applyTelegramTaskDescriptionUpdate(input: {
  client: PrismaClient;
  job: OpsJob;
  payload: TelegramJobPayload;
}) {
  const explicitCommand =
    input.payload.isUntrustedForward || input.payload.batchId
      ? null
      : (parseTelegramTaskDescriptionUpdate(input.payload.text) ??
        parseTelegramTaskDescriptionUpdate(input.payload.transcription));
  const replyTaskId =
    !input.payload.isUntrustedForward &&
    !input.payload.batchId &&
    input.payload.context?.source === "reply"
      ? input.payload.context.taskId
      : null;
  const progressText =
    explicitCommand?.update ??
    (replyTaskId
      ? cleanTelegramProgressText(input.payload.transcription ?? input.payload.text)
      : "");
  if ((!explicitCommand && !replyTaskId) || !progressText || !input.job.inboxItemId) return null;
  return input.client.$transaction(async (tx) => {
    const actor = await resolveAutoCreateActor(tx, input.payload.actorAdminUserId);
    const task = await tx.opsTask.findUnique({
      where: explicitCommand ? { number: explicitCommand.number } : { id: replyTaskId! },
      select: {
        id: true,
        number: true,
        title: true,
        description: true,
        assigneeId: true,
        createdById: true,
        isShared: true,
        archivedAt: true,
        version: true,
        status: true,
        nextAction: true,
      },
    });
    const canWrite = Boolean(
      actor &&
        matchesAdminPermission(actor.permissions, ADMIN_PERMISSIONS.OPS_TASKS_WRITE) &&
        task &&
        !task.archivedAt &&
        (task.isShared ||
          task.assigneeId === actor.id ||
          task.createdById === actor.id ||
          matchesAdminPermission(actor.permissions, ADMIN_PERMISSIONS.OPS_TASKS_ASSIGN))
    );
    if (!actor || !task || !canWrite) {
      await tx.opsInboxItem.update({
        where: { id: input.job.inboxItemId! },
        data: {
          extractionStatus: OpsInboxExtractionStatus.READY,
          requiresApproval: true,
          ambiguities: [
            !task
              ? `Задача ${explicitCommand ? `#${explicitCommand.number}` : "из ответа"} не найдена.`
              : `Нет доступа к обновлению задачи #${task?.number ?? explicitCommand?.number ?? ""}.`,
          ],
          processedAt: new Date(),
        },
      });
      return {
        handled: true,
        updated: false,
        taskId: null,
        response: !task
          ? `Не нашёл задачу ${explicitCommand ? `#${explicitCommand.number}` : "из ответа"}. Сообщение оставил во Входящих.`
          : `Нет доступа к задаче #${task?.number ?? explicitCommand?.number ?? ""}. Сообщение оставил во Входящих.`,
      };
    }
    const eventKey = `telegram:task-update:${input.payload.telegramUpdateId}`;
    const existingEvent = await tx.opsTaskEvent.findFirst({
      where: { taskId: task.id, idempotencyKey: eventKey },
      select: { id: true },
    });
    if (existingEvent) {
      return {
        handled: true,
        updated: true,
        taskId: task.id,
        updateEventId: existingEvent.id,
        response: `Описание задачи #${task.number} уже обновлено.`,
      };
    }
    const timestamp = new Intl.DateTimeFormat("ru-RU", {
      timeZone: "Europe/Kyiv",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date());
    const addition = `Обновление из Telegram · ${timestamp}\n${progressText}`;
    const description = [task.description?.trim(), addition].filter(Boolean).join("\n\n");
    const extractedTask =
      input.payload.extraction &&
      !input.payload.extraction.requires_approval &&
      Number.parseFloat(input.payload.extraction.confidence) >= 0.75 &&
      input.payload.extraction.tasks.length === 1
        ? input.payload.extraction.tasks[0]
        : null;
    const nextAction = extractedTask?.next_action?.trim() || task.nextAction;
    const readyAttachments = await tx.opsAttachment.findMany({
      where: { inboxItemId: input.job.inboxItemId!, state: OpsAttachmentState.READY },
      select: { id: true },
    });
    const updated = await tx.opsTask.update({
      where: { id: task.id },
      data: { description, nextAction, version: { increment: 1 } },
      select: {
        id: true,
        number: true,
        title: true,
        version: true,
        status: true,
        nextAction: true,
      },
    });
    const updateEvent = await tx.opsTaskEvent.create({
      data: {
        taskId: task.id,
        type: OpsTaskEventType.UPDATED,
        actorId: actor.id,
        sourceType: OpsTaskSourceType.TELEGRAM,
        sourceId: input.job.inboxItemId,
        idempotencyKey: eventKey,
        payload: {
          kind: "progress_update",
          fields: nextAction !== task.nextAction ? ["description", "nextAction"] : ["description"],
          taskNumber: task.number,
          update: progressText,
          descriptionBefore: task.description,
          descriptionAfter: description,
          nextActionBefore: task.nextAction,
          nextActionAfter: nextAction,
          attachmentIds: readyAttachments.map((attachment) => attachment.id),
          status: task.status,
          previousVersion: task.version,
          version: updated.version,
        },
      },
      select: { id: true },
    });
    if (readyAttachments.length) {
      await tx.opsTaskAttachment.createMany({
        data: readyAttachments.map((attachment) => ({
          taskId: task.id,
          attachmentId: attachment.id,
          attachedById: actor.id,
        })),
        skipDuplicates: true,
      });
    }
    await tx.opsInboxItem.update({
      where: { id: input.job.inboxItemId! },
      data: {
        extractionStatus: OpsInboxExtractionStatus.READY,
        reviewStatus: OpsInboxReviewStatus.APPLIED,
        summary: `Обновлена задача #${task.number}`,
        appliedTaskIds: [task.id],
        reviewedAt: new Date(),
        processedAt: new Date(),
      },
    });
    await tx.adminAuditLog.create({
      data: {
        actorId: actor.id,
        actorEmail: actor.email,
        actorName: actor.name,
        scope: "operations",
        action: "telegram.task.description_update",
        entityType: "ops.task",
        entityId: task.id,
        metadata: {
          taskNumber: task.number,
          telegramUpdateId: input.payload.telegramUpdateId,
          version: updated.version,
          updateEventId: updateEvent.id,
          attachmentCount: readyAttachments.length,
        },
      },
    });
    return {
      handled: true,
      updated: true,
      taskId: task.id,
      updateEventId: updateEvent.id,
      response: [
        `✅ Обновил задачу #${task.number} «${task.title}»`,
        "",
        `Статус: ${taskStatusLabel(updated.status)}`,
        `Новое: ${progressText.slice(0, 1_200)}`,
        updated.nextAction ? `Дальше: ${updated.nextAction.slice(0, 600)}` : null,
        readyAttachments.length ? `Вложения: ${readyAttachments.length}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
    };
  });
}

export async function autoApplyTelegramTaskProposals(input: {
  client: PrismaClient;
  job: OpsJob;
  payload: TelegramJobPayload;
  autoCreateEnabled?: boolean;
  keepInboxPending?: boolean;
  bypassSafetyForInboxDraft?: boolean;
}) {
  const { client, job, payload } = input;
  if (!job.inboxItemId || !payload.extraction) {
    throw new Error("OPS_EXTRACTION_MISSING");
  }
  const extraction = payload.extraction;
  return client.$transaction(
    async (tx) => {
      const inbox = await tx.opsInboxItem.findUnique({
        where: { id: job.inboxItemId! },
        include: {
          attachments: {
            where: { state: OpsAttachmentState.READY },
            select: { id: true },
          },
          proposals: {
            where: {
              kind: OpsProposalKind.TASK,
              status: OpsProposalStatus.PENDING,
            },
            orderBy: { ordinal: "asc" },
            take: 6,
          },
        },
      });
      if (!inbox) throw new Error("OPS_INBOX_NOT_FOUND");
      if (inbox.reviewStatus !== OpsInboxReviewStatus.PENDING) {
        const existingAutoTasks = inbox.appliedTaskIds.length
          ? await tx.opsTask.findMany({
              where: {
                id: { in: inbox.appliedTaskIds },
                sourceKey: { startsWith: `telegram:${payload.telegramUpdateId}:task:` },
              },
              select: { id: true, number: true, externalId: true, title: true },
            })
          : [];
        const autoApplied =
          existingAutoTasks.length > 0 &&
          existingAutoTasks.length === new Set(inbox.appliedTaskIds).size;
        return {
          autoApplied,
          autoAppliedTaskIds: autoApplied ? inbox.appliedTaskIds : [],
          autoAppliedTasks: autoApplied ? existingAutoTasks : [],
          decision: "already_reviewed" as const,
        };
      }
      if (inbox.proposals.length < 1 || inbox.proposals.length > 5) {
        return {
          autoApplied: false,
          autoAppliedTaskIds: [] as string[],
          decision: "invalid_task_count" as const,
        };
      }
      const context = payload.context ?? {
        source: "none" as const,
        projectId: null,
        taskId: null,
        shopOrderId: null,
      };
      const unresolvedContext =
        context.ambiguous === true ||
        (context.source === "none" &&
          (extraction.project_candidates.length > 0 ||
            extraction.order_candidates.length > 0 ||
            extraction.tasks.some((task) => Boolean(task.project_ref || task.order_ref))));
      const unresolvedAssignee = extraction.tasks.some((task, index) => {
        if (!task.assignee_ref) return false;
        const proposalPayload = inbox.proposals[index]?.payload as
          | Record<string, unknown>
          | undefined;
        return !proposalPayload?.assigneeId;
      });
      const safetyDecision = input.bypassSafetyForInboxDraft
        ? ({ eligible: true, reason: "inbox_draft" } as const)
        : decideOpsTelegramAutoCreate({
            enabled:
              input.autoCreateEnabled ?? flagEnabled(process.env.OPS_TELEGRAM_AUTO_CREATE_ENABLED),
            hasExplicitText: Boolean(payload.text?.trim()),
            hasMedia: Boolean(payload.media),
            previewOnly: payload.previewOnly,
            isUntrustedForward: payload.isUntrustedForward,
            intent: extraction.intent,
            taskCount: extraction.tasks.length,
            confidence: extraction.confidence,
            requiresApproval: inbox.requiresApproval || extraction.requires_approval,
            ambiguityCount: inbox.ambiguities.length,
            unresolvedAssignee,
            unresolvedContext,
          });
      if (!safetyDecision.eligible) {
        return {
          autoApplied: false,
          autoAppliedTaskIds: [] as string[],
          decision: safetyDecision.reason,
        };
      }

      const actor = await resolveAutoCreateActor(tx, payload.actorAdminUserId);
      const actorAllowed = Boolean(
        actor && matchesAdminPermission(actor.permissions, ADMIN_PERMISSIONS.OPS_TASKS_WRITE)
      );
      const normalized = inbox.proposals.map((proposal) => ({
        proposal,
        input: normalizeTaskCreateInput(proposal.payload),
      }));
      const assignmentAllowed = Boolean(
        actor &&
          normalized.every(
            ({ input: taskInput }) =>
              !taskInput.assigneeId ||
              taskInput.assigneeId === actor.id ||
              matchesAdminPermission(actor.permissions, ADMIN_PERMISSIONS.OPS_TASKS_ASSIGN)
          )
      );
      if (!actorAllowed || !actor) {
        return {
          autoApplied: false,
          autoAppliedTaskIds: [] as string[],
          decision: "actor_forbidden" as const,
        };
      }
      if (!assignmentAllowed && !input.keepInboxPending) {
        return {
          autoApplied: false,
          autoAppliedTaskIds: [] as string[],
          decision: "assignment_forbidden" as const,
        };
      }

      const tasks: Array<{ id: string; number: number; externalId: string; title: string }> = [];
      for (const { proposal, input: taskInput } of normalized) {
        if (
          input.keepInboxPending &&
          taskInput.assigneeId &&
          taskInput.assigneeId !== actor.id &&
          !matchesAdminPermission(actor.permissions, ADMIN_PERMISSIONS.OPS_TASKS_ASSIGN)
        ) {
          taskInput.assigneeId = null;
        }
        taskInput.description = appendOpsSourceUrls(taskInput.description, [
          inbox.originalMessage,
          inbox.transcription,
          payload.text,
        ]);
        await assertValidOpsTaskRelations(tx, taskInput);
        const sourceKey = `telegram:${payload.telegramUpdateId}:task:${proposal.ordinal}`;
        const existingTask = await tx.opsTask.findUnique({
          where: { sourceKey },
          select: {
            id: true,
            number: true,
            externalId: true,
            title: true,
            assigneeId: true,
            dueAt: true,
            version: true,
          },
        });
        if (existingTask) {
          await tx.opsInboxProposal.update({
            where: { id: proposal.id },
            data: {
              appliedTaskId: existingTask.id,
              ...(input.keepInboxPending
                ? {}
                : { status: OpsProposalStatus.APPLIED, appliedAt: new Date() }),
            },
          });
          tasks.push({
            id: existingTask.id,
            number: existingTask.number,
            externalId: existingTask.externalId,
            title: existingTask.title,
          });
          continue;
        }
        const task = await tx.opsTask.create({
          data: {
            ...taskInput,
            dueAt: resolveOpsTaskDueAt(taskInput.dueAt),
            externalId: createOpsExternalId("ONE"),
            createdById: actor.id,
            sourceType: OpsTaskSourceType.TELEGRAM,
            sourceId: proposal.id,
            sourceKey,
          },
          select: {
            id: true,
            number: true,
            externalId: true,
            title: true,
            assigneeId: true,
            dueAt: true,
            version: true,
          },
        });
        const brandGuides = await linkMatchingBrandGuides(tx, {
          taskId: task.id,
          texts: [
            taskInput.title,
            taskInput.description,
            taskInput.nextAction,
            ...taskInput.tags,
            inbox.originalMessage,
            inbox.transcription,
            payload.text,
          ],
        });
        if (inbox.attachments.length) {
          await tx.opsTaskAttachment.createMany({
            data: inbox.attachments.map((attachment) => ({
              taskId: task.id,
              attachmentId: attachment.id,
              attachedById: actor.id,
            })),
            skipDuplicates: true,
          });
        }
        await tx.opsTaskEvent.create({
          data: {
            taskId: task.id,
            type: OpsTaskEventType.CREATED,
            actorId: actor.id,
            sourceType: OpsTaskSourceType.TELEGRAM,
            sourceId: proposal.id,
            idempotencyKey: `telegram:auto-create:${payload.telegramUpdateId}:${proposal.ordinal}`,
            payload: {
              inboxItemId: inbox.id,
              proposalId: proposal.id,
              autoCreated: true,
              confidence: payload.extraction!.confidence,
              contextSource: payload.context?.source ?? "none",
              brandGuideKeys: brandGuides.brandArticles.map((article) => article.brandKey),
              shippingReferenceLinked: brandGuides.shippingArticles.length > 0,
              shippingEstimateKeys: brandGuides.shippingEstimates.map((estimate) => estimate.key),
            },
          },
        });
        await enqueueOpsTaskAssignmentNotification({
          client: tx,
          task,
          assignedBy: actor,
        });
        await tx.opsInboxProposal.update({
          where: { id: proposal.id },
          data: {
            appliedTaskId: task.id,
            ...(input.keepInboxPending
              ? {}
              : { status: OpsProposalStatus.APPLIED, appliedAt: new Date() }),
          },
        });
        tasks.push({
          id: task.id,
          number: task.number,
          externalId: task.externalId,
          title: task.title,
        });
      }
      if (inbox.attachments.length) {
        await tx.opsAttachment.updateMany({
          where: { id: { in: inbox.attachments.map((attachment) => attachment.id) } },
          data: { retentionAt: null },
        });
      }
      const undoExpiresAt = input.keepInboxPending ? null : new Date(Date.now() + 10 * 60 * 1000);
      await tx.opsInboxItem.update({
        where: { id: inbox.id },
        data: input.keepInboxPending
          ? { appliedTaskIds: tasks.map((task) => task.id) }
          : {
              reviewStatus: OpsInboxReviewStatus.APPLIED,
              reviewedAt: new Date(),
              appliedTaskIds: tasks.map((task) => task.id),
              undoExpiresAt,
            },
      });
      await tx.adminAuditLog.create({
        data: {
          actorId: actor.id,
          actorEmail: actor.email,
          actorName: actor.name,
          scope: "operations",
          action: input.keepInboxPending
            ? "telegram.inbox.draft_materialize"
            : "telegram.inbox.auto_apply",
          entityType: "ops.inbox",
          entityId: inbox.id,
          metadata: {
            taskIds: tasks.map((task) => task.id),
            proposalIds: inbox.proposals.map((proposal) => proposal.id),
            telegramUpdateId: payload.telegramUpdateId,
            confidence: payload.extraction!.confidence,
            undoExpiresAt: undoExpiresAt?.toISOString() ?? null,
          },
        },
      });
      return {
        autoApplied: true,
        autoAppliedTaskIds: tasks.map((task) => task.id),
        autoAppliedTasks: tasks,
        undoExpiresAt,
        decision: input.keepInboxPending ? ("inbox_draft" as const) : ("enabled" as const),
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}

function enforceTelegramBatchMode(extraction: OpsExtraction, payload: TelegramJobPayload) {
  if (payload.batchMode !== "ONE_TASK" || extraction.tasks.length <= 1) return extraction;
  const priorities = ["low", "normal", "high", "urgent"];
  const priority = extraction.tasks.reduce<OpsExtraction["tasks"][number]["priority"]>(
    (current, task) =>
      priorities.indexOf(task.priority.toLowerCase()) > priorities.indexOf(current)
        ? task.priority
        : current,
    "normal"
  );
  const assignees = Array.from(
    new Set(extraction.tasks.map((task) => task.assignee_ref).filter(Boolean))
  );
  const first = extraction.tasks[0];
  return {
    ...extraction,
    tasks: [
      {
        ...first,
        title: extraction.summary || first.title,
        description:
          payload.transcription?.slice(0, 20_000) ||
          extraction.tasks
            .map((task) => [task.title, task.description].filter(Boolean).join(": "))
            .join("\n"),
        priority,
        assignee_ref: assignees.length === 1 ? assignees[0] : null,
      },
    ],
    ambiguities:
      assignees.length > 1
        ? [...extraction.ambiguities, "В сообщениях указаны разные исполнители."]
        : extraction.ambiguities,
  } satisfies OpsExtraction;
}

async function executeTelegramBatchMediaStages(input: {
  client: PrismaClient;
  job: OpsJob;
  payload: TelegramJobPayload;
  dependencies: OpsTelegramJobDependencies;
}) {
  if (!input.job.inboxItemId || !input.payload.batchId || !input.payload.batchItems?.length) {
    throw new Error("OPS_TELEGRAM_BATCH_JOB_INVALID");
  }
  if (input.job.stage === OpsJobStage.INGEST) {
    await input.client.opsInboxItem.update({
      where: { id: input.job.inboxItemId },
      data: { extractionStatus: OpsInboxExtractionStatus.PROCESSING },
    });
    const hasMedia = input.payload.batchItems.some((item) => item.media);
    if (!hasMedia) {
      const extractionText = input.payload.batchItems
        .map((item, index) =>
          [
            `Сообщение ${index + 1}:`,
            item.forwardedFrom?.displayName ? `Автор: ${item.forwardedFrom.displayName}` : null,
            item.text ?? "",
          ]
            .filter(Boolean)
            .join("\n")
        )
        .join("\n\n")
        .slice(0, 30_000);
      return {
        outcome: "advance" as const,
        stage: OpsJobStage.EXTRACT,
        payload: { ...input.payload, extractionText },
      };
    }
    return {
      outcome: "advance" as const,
      stage: OpsJobStage.DOWNLOAD_MEDIA,
      payload: input.payload,
    };
  }

  if (input.job.stage === OpsJobStage.DOWNLOAD_MEDIA) {
    const store = input.dependencies.mediaStore ?? createConfiguredOpsMediaStore();
    const storedItems: NonNullable<TelegramJobPayload["batchStoredItems"]> = [];
    for (const [index, item] of input.payload.batchItems.entries()) {
      if (!item.media) {
        storedItems.push({
          ordinal: index + 1,
          text: item.text,
          media: null,
          forwardedFrom: item.forwardedFrom,
          attachmentId: null,
          storageKey: null,
          mimeType: null,
          transcription: null,
        });
        continue;
      }
      const validated = validateOpsTelegramMedia(item.media);
      const existing = await input.client.opsAttachment.findFirst({
        where: {
          inboxItemId: input.job.inboxItemId,
          state: OpsAttachmentState.READY,
          OR: [
            ...(item.media.fileUniqueId ? [{ telegramFileUniqueId: item.media.fileUniqueId }] : []),
            { telegramFileId: item.media.fileId },
          ],
        },
        select: {
          id: true,
          storageKey: true,
          mimeType: true,
          transcription: true,
        },
      });
      if (existing) {
        storedItems.push({
          ordinal: index + 1,
          text: item.text,
          media: item.media,
          forwardedFrom: item.forwardedFrom,
          attachmentId: existing.id,
          storageKey: existing.storageKey,
          mimeType: existing.mimeType,
          transcription: existing.transcription,
        });
        continue;
      }
      await assertOpsMediaStorageBudget({
        client: input.client,
        incomingBytes: validated.fileSize ?? 0,
      });
      const body = await downloadOpsTelegramFile({
        fileId: validated.fileId,
        fetchImpl: input.dependencies.fetchImpl,
      });
      assertOpsMediaMagicBytes(body, validated.mimeType);
      if (validated.fileSize === null) {
        await assertOpsMediaStorageBudget({
          client: input.client,
          incomingBytes: body.byteLength,
        });
      }
      const reservation = await reserveOpsMediaStorageBudget({
        client: input.client,
        reservationKey: `job:${input.job.id}:batch:${index + 1}`,
        incomingBytes: body.byteLength,
      });
      const checksum = checksumOpsMedia(body);
      const requestedStorageKey = createOpsMediaStorageKey({
        namespace: input.job.inboxItemId,
        telegramFileUniqueId: validated.fileUniqueId,
        checksum,
        fileName: `${index + 1}-${validated.safeFileName}`,
      });
      let stored: { storageKey: string } | null = null;
      try {
        stored = await store.put({
          storageKey: requestedStorageKey,
          body,
          contentType: validated.mimeType,
        });
        const attachment = await input.client.opsAttachment.upsert({
          where: { storageKey: stored.storageKey },
          create: {
            inboxItemId: input.job.inboxItemId,
            storageKey: stored.storageKey,
            checksum,
            mimeType: validated.mimeType,
            sizeBytes: BigInt(body.byteLength),
            fileName: validated.safeFileName,
            telegramFileId: validated.fileId,
            telegramFileUniqueId: validated.fileUniqueId,
            state: OpsAttachmentState.READY,
            retentionAt: opsAttachmentRetentionAt(),
          },
          update: {
            state: OpsAttachmentState.READY,
            retentionAt: opsAttachmentRetentionAt(),
          },
          select: {
            id: true,
            storageKey: true,
            mimeType: true,
            transcription: true,
          },
        });
        storedItems.push({
          ordinal: index + 1,
          text: item.text,
          media: item.media,
          forwardedFrom: item.forwardedFrom,
          attachmentId: attachment.id,
          storageKey: attachment.storageKey,
          mimeType: attachment.mimeType,
          transcription: attachment.transcription,
        });
      } catch (error) {
        if (stored) await store.remove(stored.storageKey).catch(() => undefined);
        await releaseOpsMediaStorageReservation({
          client: input.client,
          reservation,
        });
        throw error;
      }
    }
    return {
      outcome: "advance" as const,
      stage: OpsJobStage.TRANSCRIBE,
      payload: { ...input.payload, batchStoredItems: storedItems },
    };
  }

  if (input.job.stage === OpsJobStage.TRANSCRIBE) {
    const store = input.dependencies.mediaStore ?? createConfiguredOpsMediaStore();
    const properNameHints = await opsBrandProperNameHintsForClient(input.client);
    const transcriptSections: string[] = [];
    const extractionSections: string[] = [];
    const processedAttachments = new Set<string>();
    for (const item of input.payload.batchStoredItems ?? []) {
      let extracted = "";
      const attachmentKey = item.attachmentId ?? item.storageKey;
      const repeatedAttachment = Boolean(attachmentKey && processedAttachments.has(attachmentKey));
      if (attachmentKey) processedAttachments.add(attachmentKey);
      if (item.storageKey && item.mimeType && !repeatedAttachment) {
        const body = await store.get(item.storageKey);
        if (item.mimeType === "text/plain") {
          extracted = new TextDecoder("utf-8", { fatal: false })
            .decode(body)
            .replace(/\u0000/g, "")
            .trim()
            .slice(0, 30_000);
        } else {
          if (isTelegramAudioMedia(item.media) && item.transcription) {
            extracted = item.transcription;
          } else {
            const response = await transcribeOpsMediaWithAi({
              bytes: body,
              mimeType: item.mimeType,
              durationSeconds: item.media?.durationSeconds ?? 0,
              properNameHints,
              budget: createPrismaOpsAiBudget(input.client),
            });
            extracted = response.value.transcript;
            if (item.attachmentId && isTelegramAudioMedia(item.media)) {
              await input.client.opsAttachment.update({
                where: { id: item.attachmentId },
                data: {
                  transcription: response.value.transcript,
                  transcriptionLanguage: response.value.language,
                  transcriptionConfidence: response.value.confidence,
                  transcriptionModel: response.model,
                },
              });
            }
          }
        }
      }
      extractionSections.push(
        [
          `Сообщение ${item.ordinal}:`,
          item.forwardedFrom?.displayName ? `Автор: ${item.forwardedFrom.displayName}` : null,
          item.text ? `Текст: ${item.text}` : null,
          extracted ? `Расшифровка: ${extracted}` : null,
          repeatedAttachment ? "Вложение уже учтено выше." : null,
        ]
          .filter(Boolean)
          .join("\n")
      );
      if (extracted && isTelegramAudioMedia(item.media)) {
        transcriptSections.push(
          [
            `Голосовое ${item.ordinal}:`,
            item.forwardedFrom?.displayName ? `Автор: ${item.forwardedFrom.displayName}` : null,
            extracted,
          ]
            .filter(Boolean)
            .join("\n")
        );
      }
    }
    const transcription = transcriptSections.join("\n\n").slice(0, 30_000) || null;
    const extractionText = extractionSections.join("\n\n").slice(0, 30_000);
    await input.client.opsInboxItem.update({
      where: { id: input.job.inboxItemId },
      data: { transcription },
    });
    return {
      outcome: "advance" as const,
      stage: OpsJobStage.EXTRACT,
      payload: {
        ...input.payload,
        transcription: transcription ?? undefined,
        extractionText,
      },
      result: { transcriptionModel: "batch_multimodal" },
    };
  }

  return null;
}

async function executeTelegramIntakeStage(input: {
  client: PrismaClient;
  job: OpsJob;
  dependencies: OpsTelegramJobDependencies;
}) {
  const payload = asPayload(input.job);
  if (!input.job.inboxItemId) throw new Error("OPS_INBOX_JOB_INVALID");
  if (input.job.type === "telegram_batch") {
    const batchStage = await executeTelegramBatchMediaStages({
      client: input.client,
      job: input.job,
      payload,
      dependencies: input.dependencies,
    });
    if (batchStage) return batchStage;
  }

  if (input.job.stage === OpsJobStage.INGEST) {
    await input.client.opsInboxItem.update({
      where: { id: input.job.inboxItemId },
      data: { extractionStatus: OpsInboxExtractionStatus.PROCESSING },
    });
    if (payload.callbackData) {
      try {
        const callback = await executeOpsTelegramCallback({
          client: input.client,
          actorAdminUserId: payload.actorAdminUserId,
          callbackData: payload.callbackData,
        });
        await finalizeTelegramCallbackInbox({
          client: input.client,
          inboxItemId: input.job.inboxItemId,
          message: callback.message,
        });
        return {
          outcome: "advance" as const,
          stage: OpsJobStage.NOTIFY,
          payload: {
            ...payload,
            callbackResponse: callback.message,
            callbackLink: "link" in callback ? callback.link : null,
          },
        };
      } catch (error) {
        const code = error instanceof Error ? error.message : "TELEGRAM_CALLBACK_FAILED";
        if (
          code === "TELEGRAM_CALLBACK_INVALID" ||
          code === "TELEGRAM_ACTION_FORBIDDEN" ||
          code === "TELEGRAM_ACTOR_INACTIVE" ||
          code === "TELEGRAM_CALLBACK_EXPIRED" ||
          code === "TELEGRAM_CALLBACK_AUTHOR_MISMATCH" ||
          code === "TELEGRAM_CALLBACK_ALREADY_USED" ||
          code === "CALLBACK_RESOURCE_NOT_FOUND" ||
          code === "UNDO_WINDOW_EXPIRED" ||
          code === "UNDO_TASK_CHANGED" ||
          code === "TASK_VERSION_CONFLICT" ||
          (error instanceof Error && error.name === "OpsError")
        ) {
          const message =
            code === "UNDO_WINDOW_EXPIRED" || code === "TELEGRAM_CALLBACK_EXPIRED"
              ? "Срок отмены истёк. Откройте задачу в админке."
              : code === "UNDO_TASK_CHANGED" || code === "TASK_VERSION_CONFLICT"
                ? "Задача уже была изменена. Отмена доступна только из админки после проверки."
                : "Действие недоступно. Откройте запись в админке.";
          await finalizeTelegramCallbackInbox({
            client: input.client,
            inboxItemId: input.job.inboxItemId,
            message,
          });
          return {
            outcome: "advance" as const,
            stage: OpsJobStage.NOTIFY,
            payload: { ...payload, callbackResponse: message },
          };
        }
        throw error;
      }
    }
    return {
      outcome: "advance" as const,
      stage: payload.media ? OpsJobStage.DOWNLOAD_MEDIA : OpsJobStage.EXTRACT,
      payload,
    };
  }

  if (input.job.stage === OpsJobStage.DOWNLOAD_MEDIA) {
    if (!payload.media) {
      return {
        outcome: "advance" as const,
        stage: OpsJobStage.EXTRACT,
        payload,
      };
    }
    let media: ReturnType<typeof validateOpsTelegramMedia>;
    let body: Uint8Array;
    let reservation: OpsMediaStorageReservation | null = null;
    try {
      media = validateOpsTelegramMedia(payload.media);
      await assertOpsMediaStorageBudget({
        client: input.client,
        incomingBytes: media.fileSize ?? 0,
      });
      body = await downloadOpsTelegramFile({
        fileId: media.fileId,
        fetchImpl: input.dependencies.fetchImpl,
      });
      assertOpsMediaMagicBytes(body, media.mimeType);
      if (media.fileSize === null) {
        await assertOpsMediaStorageBudget({
          client: input.client,
          incomingBytes: body.byteLength,
        });
      }
      reservation = await reserveOpsMediaStorageBudget({
        client: input.client,
        reservationKey: `job:${input.job.id}`,
        incomingBytes: body.byteLength,
      });
    } catch (error) {
      if (
        error instanceof OpsMediaError &&
        (error.code === "ATTACHMENT_SIZE_LIMIT" ||
          error.code === "AUDIO_DURATION_LIMIT" ||
          error.code === "ATTACHMENT_TYPE_REJECTED" ||
          error.code === "ATTACHMENT_MIME_REJECTED" ||
          error.code === "ATTACHMENT_SIGNATURE_MISMATCH" ||
          error.code === "MEDIA_MONTHLY_UPLOAD_CAP" ||
          error.code === "MEDIA_RETAINED_SOFT_CAP")
      ) {
        const checksum = crypto.createHash("sha256").update(payload.media.fileId).digest("hex");
        const storageKey = `operations/rejected/${input.job.inboxItemId}/${checksum}`;
        await input.client.opsAttachment.upsert({
          where: { storageKey },
          create: {
            inboxItemId: input.job.inboxItemId,
            storageKey,
            checksum,
            mimeType: payload.media.mimeType ?? "application/octet-stream",
            sizeBytes: BigInt(Math.max(0, payload.media.fileSize ?? 0)),
            fileName: payload.media.fileName,
            telegramFileId: payload.media.fileId,
            telegramFileUniqueId: payload.media.fileUniqueId,
            state: OpsAttachmentState.REJECTED,
            quarantineReason: error.code,
          },
          update: {
            state: OpsAttachmentState.REJECTED,
            quarantineReason: error.code,
          },
        });
        await input.client.opsInboxItem.update({
          where: { id: input.job.inboxItemId },
          data: {
            extractionStatus: OpsInboxExtractionStatus.FAILED,
            processingErrorType: error.code,
            processingError: error.message,
          },
        });
        return {
          outcome: "waiting_human" as const,
          result: { reason: error.code, attachmentRejected: true },
        };
      }
      throw error;
    }
    if (!reservation) {
      throw new Error("MEDIA_STORAGE_RESERVATION_MISSING");
    }
    const checksum = checksumOpsMedia(body);
    const requestedStorageKey = createOpsMediaStorageKey({
      namespace: input.job.inboxItemId,
      telegramFileUniqueId: media.fileUniqueId,
      checksum,
      fileName: media.safeFileName,
    });
    const store = input.dependencies.mediaStore ?? createConfiguredOpsMediaStore();
    let stored: { storageKey: string } | null = null;
    let attachment: { id: string; storageKey: string; mimeType: string };
    try {
      stored = await store.put({
        storageKey: requestedStorageKey,
        body,
        contentType: media.mimeType,
      });
      attachment = await input.client.opsAttachment.upsert({
        where: { storageKey: stored.storageKey },
        create: {
          inboxItemId: input.job.inboxItemId,
          storageKey: stored.storageKey,
          checksum,
          mimeType: media.mimeType,
          sizeBytes: BigInt(body.byteLength),
          fileName: media.safeFileName,
          telegramFileId: media.fileId,
          telegramFileUniqueId: media.fileUniqueId,
          state: OpsAttachmentState.READY,
          retentionAt: opsAttachmentRetentionAt(),
        },
        update: {
          state: OpsAttachmentState.READY,
          retentionAt: opsAttachmentRetentionAt(),
        },
        select: { id: true, storageKey: true, mimeType: true },
      });
    } catch (error) {
      if (stored) {
        await store.remove(stored.storageKey).catch(() => undefined);
      }
      await releaseOpsMediaStorageReservation({
        client: input.client,
        reservation,
      });
      throw error;
    }
    const nextPayload = {
      ...payload,
      attachmentId: attachment.id,
      storageKey: attachment.storageKey,
      attachmentMimeType: attachment.mimeType,
    };
    return {
      outcome: "advance" as const,
      stage: OpsJobStage.TRANSCRIBE,
      payload: nextPayload,
    };
  }

  if (input.job.stage === OpsJobStage.TRANSCRIBE) {
    if (!payload.storageKey || !payload.media || !payload.attachmentMimeType) {
      throw new Error("OPS_TRANSCRIPTION_INPUT_MISSING");
    }
    const store = input.dependencies.mediaStore ?? createConfiguredOpsMediaStore();
    const body = await store.get(payload.storageKey);
    if (payload.attachmentMimeType === "text/plain") {
      const documentText = new TextDecoder("utf-8", { fatal: false })
        .decode(body)
        .replace(/\u0000/g, "")
        .trim()
        .slice(0, 30_000);
      if (!documentText) throw new Error("OPS_DOCUMENT_TEXT_EMPTY");
      await input.client.opsInboxItem.update({
        where: { id: input.job.inboxItemId },
        data: { transcription: null },
      });
      return {
        outcome: "advance" as const,
        stage: OpsJobStage.EXTRACT,
        payload: {
          ...payload,
          transcription: undefined,
          extractionText: [payload.text, documentText].filter(Boolean).join("\n\n"),
        },
        result: { transcriptionModel: "deterministic_utf8" },
      };
    }
    const properNameHints = await opsBrandProperNameHintsForClient(input.client);
    const response = await transcribeOpsMediaWithAi({
      bytes: body,
      mimeType: payload.attachmentMimeType,
      durationSeconds: payload.media.durationSeconds ?? 0,
      properNameHints,
      budget: createPrismaOpsAiBudget(input.client),
    });
    const isAudio = isTelegramAudioMedia(payload.media);
    const transcription = isAudio ? response.value.transcript : null;
    const extractionText = [payload.text, response.value.transcript].filter(Boolean).join("\n\n");
    await input.client.$transaction([
      input.client.opsInboxItem.update({
        where: { id: input.job.inboxItemId },
        data: { transcription },
      }),
      ...(isAudio && payload.attachmentId
        ? [
            input.client.opsAttachment.update({
              where: { id: payload.attachmentId },
              data: {
                transcription: response.value.transcript,
                transcriptionLanguage: response.value.language,
                transcriptionConfidence: response.value.confidence,
                transcriptionModel: response.model,
              },
            }),
          ]
        : []),
    ]);
    return {
      outcome: "advance" as const,
      stage: OpsJobStage.EXTRACT,
      payload: {
        ...payload,
        transcription: transcription ?? undefined,
        extractionText,
      },
      result: { transcriptionModel: response.model },
    };
  }

  if (input.job.stage === OpsJobStage.EXTRACT) {
    const text = payload.extractionText ?? payload.transcription ?? payload.text;
    if (!text) {
      const extraction: OpsExtraction = {
        intent: "note",
        summary: "Сообщение содержит вложение без извлекаемого текста.",
        project_candidates: [],
        order_candidates: [],
        tasks: [],
        confidence: "0.00",
        ambiguities: ["Нужно просмотреть вложение вручную."],
        requires_approval: false,
      };
      return {
        outcome: "advance" as const,
        stage: OpsJobStage.RESOLVE_CONTEXT,
        payload: { ...payload, extraction },
      };
    }
    try {
      const response = await extractOpsProposalWithAi({
        text,
        context: await extractionContext(input.client, payload),
        budget: createPrismaOpsAiBudget(input.client),
      });
      const extraction = enforceTelegramBatchMode(response.value, payload);
      return {
        outcome: "advance" as const,
        stage: OpsJobStage.RESOLVE_CONTEXT,
        payload: { ...payload, extraction },
        result: { extractionModel: response.model },
      };
    } catch (error) {
      const code = String((error as { code?: unknown })?.code ?? "");
      if (code === "AI_BUDGET_EXHAUSTED" || code === "AI_NOT_CONFIGURED") {
        const extraction = createManualOpsExtraction(
          text,
          code as "AI_BUDGET_EXHAUSTED" | "AI_NOT_CONFIGURED"
        );
        await input.client.opsInboxItem.update({
          where: { id: input.job.inboxItemId },
          data: {
            extractionStatus: OpsInboxExtractionStatus.PROCESSING,
            processingErrorType: code,
            processingError: "AI недоступен: создан безопасный черновик для ручной проверки.",
          },
        });
        return {
          outcome: "advance" as const,
          stage: OpsJobStage.RESOLVE_CONTEXT,
          payload: { ...payload, extraction },
          result: {
            reason: code,
            inboxItemId: input.job.inboxItemId,
            extractionModel: "manual_fallback",
          },
        };
      }
      throw error;
    }
  }

  if (input.job.stage === OpsJobStage.RESOLVE_CONTEXT) {
    const context = await resolveContext(input.client, payload);
    return {
      outcome: "advance" as const,
      stage: OpsJobStage.CREATE_PREVIEW_OR_ENTITIES,
      payload: { ...payload, context },
    };
  }

  if (input.job.stage === OpsJobStage.CREATE_PREVIEW_OR_ENTITIES) {
    const taskUpdate = await applyTelegramTaskDescriptionUpdate({
      client: input.client,
      job: input.job,
      payload,
    });
    if (taskUpdate?.handled) {
      return {
        outcome: "advance" as const,
        stage: OpsJobStage.NOTIFY,
        payload: {
          ...payload,
          callbackResponse: taskUpdate.response,
          callbackLink: taskUpdate.taskId
            ? opsAdminLink(`/admin/operations/tasks/${encodeURIComponent(taskUpdate.taskId)}`)
            : opsAdminLink(
                `/admin/operations/inbox?selected=${encodeURIComponent(input.job.inboxItemId!)}`
              ),
          autoApplied: taskUpdate.updated,
          autoAppliedTaskIds: taskUpdate.taskId ? [taskUpdate.taskId] : [],
          taskUpdateEventId:
            "updateEventId" in taskUpdate ? (taskUpdate.updateEventId ?? null) : null,
        },
        result: taskUpdate,
      };
    }
    const preview = await createProposals(input.client, input.job, payload);
    const applied =
      preview.proposalCount > 0
        ? await autoApplyTelegramTaskProposals({
            client: input.client,
            job: input.job,
            payload,
            autoCreateEnabled: true,
            keepInboxPending: true,
            bypassSafetyForInboxDraft: true,
          })
        : {
            autoApplied: false,
            autoAppliedTaskIds: [] as string[],
            decision: "no_task_proposals" as const,
          };
    const result = { ...preview, ...applied };
    return {
      outcome: "advance" as const,
      stage: OpsJobStage.NOTIFY,
      payload: {
        ...payload,
        autoApplied: applied.autoApplied,
        autoAppliedTaskIds: applied.autoAppliedTaskIds,
      },
      result,
    };
  }

  if (input.job.stage === OpsJobStage.NOTIFY) {
    if (payload.batchId) {
      await input.client.opsTelegramBatch.updateMany({
        where: { id: payload.batchId, status: "PROCESSING" },
        data: { status: "READY" },
      });
    }
    const inbox = await input.client.opsInboxItem.findUnique({
      where: { id: input.job.inboxItemId },
      select: {
        id: true,
        summary: true,
        appliedTaskIds: true,
        _count: { select: { proposals: true } },
        telegramUpdate: {
          select: {
            chatId: true,
            telegramUserId: true,
            messageId: true,
          },
        },
      },
    });
    if (!inbox?.telegramUpdate.telegramUserId) throw new Error("OPS_NOTIFICATION_TARGET_MISSING");
    const member = await input.client.opsMemberProfile.findFirst({
      where: {
        telegramUserId: inbox.telegramUpdate.telegramUserId,
        telegramEnabled: true,
        adminUser: { isActive: true },
      },
      select: { id: true },
    });
    if (!member) {
      return {
        outcome: "succeeded" as const,
        result: { notification: "skipped_recipient_no_longer_allowed" },
      };
    }
    const requestedTaskIds = payload.autoApplied
      ? (payload.autoAppliedTaskIds ?? inbox.appliedTaskIds).slice(0, 5)
      : [];
    const unorderedTasks = requestedTaskIds.length
      ? await input.client.opsTask.findMany({
          where: { id: { in: requestedTaskIds } },
          select: { id: true, number: true, externalId: true, title: true },
        })
      : [];
    const tasksById = new Map(unorderedTasks.map((task) => [task.id, task]));
    const autoAppliedTasks = requestedTaskIds.flatMap((id) => {
      const task = tasksById.get(id);
      return task ? [task] : [];
    });
    const text = payload.callbackResponse
      ? payload.callbackResponse
      : buildOpsInboxNotification({
          taskCount: inbox._count.proposals,
          summary: inbox.summary,
          inboxItemId: inbox.id,
          adminBaseUrl: resolveOpsAdminBaseUrl(),
          previewOnly: payload.previewOnly,
          sourceKind: payload.batchItems?.length
            ? "batch"
            : isTelegramAudioMedia(payload.media)
              ? "voice"
              : "message",
          autoAppliedTasks,
        });
    const cancelData = payload.callbackResponse
      ? payload.taskUpdateEventId
        ? await createOpsTelegramCallbackState({
            client: input.client,
            action: "undo_task_update",
            resourceId: payload.taskUpdateEventId,
            actorAdminUserId: payload.actorAdminUserId,
            ttlMs: 10 * 60 * 1000,
          })
        : null
      : await createOpsTelegramCallbackState({
          client: input.client,
          action: "cancel_creation",
          resourceId: inbox.id,
          actorAdminUserId: payload.actorAdminUserId,
          ttlMs: 10 * 60 * 1000,
        });
    const openUrl =
      payload.callbackLink ??
      (autoAppliedTasks[0]
        ? opsAdminLink(`/admin/operations/tasks/${encodeURIComponent(autoAppliedTasks[0].id)}`)
        : opsAdminLink(`/admin/operations/inbox?selected=${encodeURIComponent(inbox.id)}`));
    const replyMarkup =
      openUrl || cancelData
        ? {
            inline_keyboard: [
              ...(openUrl
                ? [
                    [
                      {
                        text:
                          payload.callbackResponse || autoAppliedTasks[0]
                            ? "📋 Открыть задачу"
                            : "📥 Проверить",
                        url: openUrl,
                        style: "primary" as const,
                      },
                    ],
                  ]
                : []),
              ...(cancelData
                ? [
                    [
                      {
                        text: payload.callbackResponse
                          ? "↩️ Отменить обновление"
                          : "↩️ Отменить создание",
                        callback_data: cancelData,
                        style: "danger" as const,
                      },
                    ],
                  ]
                : []),
            ],
          }
        : undefined;
    try {
      const sent = await sendOpsTelegramNotification({
        chatId: inbox.telegramUpdate.chatId,
        text,
        replyToMessageId: inbox.telegramUpdate.messageId,
        replyMarkup,
        fetchImpl: input.dependencies.fetchImpl,
      });
      await input.client.opsTelegramDelivery.upsert({
        where: {
          chatId_telegramMessageId: {
            chatId: sent.chatId,
            telegramMessageId: sent.messageId,
          },
        },
        create: {
          inboxItemId: inbox.id,
          taskId: autoAppliedTasks.length === 1 ? autoAppliedTasks[0].id : null,
          chatId: sent.chatId,
          telegramMessageId: sent.messageId,
          kind:
            autoAppliedTasks.length === 1
              ? "task_auto_created"
              : autoAppliedTasks.length > 1
                ? "task_auto_created_batch"
                : "inbox_preview",
        },
        update: {},
      });
      return {
        outcome: "succeeded" as const,
        result: { notification: "sent", telegramMessageId: sent.messageId },
      };
    } catch (error) {
      if (error instanceof OpsNotificationError && error.code === "NOTIFICATIONS_DISABLED") {
        return {
          outcome: "succeeded" as const,
          result: { notification: "disabled" },
        };
      }
      throw error;
    }
  }

  throw new Error(`OPS_JOB_STAGE_UNSUPPORTED:${input.job.stage}`);
}

type OpsCatalogCheckProduct = {
  id: string;
  sku: string | null;
  slug: string;
  brand: string | null;
  titleUa: string;
  titleEn: string;
  categoryUa: string | null;
  categoryEn: string | null;
  image: string | null;
  isPublished: boolean;
  status: string;
  stock: string;
  updatedAt: Date;
};

export function buildOpsCatalogCheckResult(input: {
  product: OpsCatalogCheckProduct | null;
  requestedProductId: string;
  requestedSku?: string;
}) {
  if (!input.product) {
    return {
      kind: "catalog_check",
      outcome: "not_found",
      requestedProductId: input.requestedProductId,
      requestedSku: input.requestedSku ?? null,
      readOnly: true,
      effectExecuted: false,
    };
  }
  const checks = {
    skuPresent: Boolean(input.product.sku?.trim()),
    brandPresent: Boolean(input.product.brand?.trim()),
    titleUaPresent: Boolean(input.product.titleUa.trim()),
    titleEnPresent: Boolean(input.product.titleEn.trim()),
    imagePresent: Boolean(input.product.image?.trim()),
    published: input.product.isPublished,
    catalogStatusActive: input.product.status === "ACTIVE",
  };
  const issueCodes = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([check]) => check);
  return {
    kind: "catalog_check",
    outcome: "found",
    product: {
      id: input.product.id,
      sku: input.product.sku,
      slug: input.product.slug,
      brand: input.product.brand,
      titleUa: input.product.titleUa,
      titleEn: input.product.titleEn,
      categoryUa: input.product.categoryUa,
      categoryEn: input.product.categoryEn,
      image: input.product.image,
      isPublished: input.product.isPublished,
      status: input.product.status,
      stock: input.product.stock,
      updatedAt: input.product.updatedAt.toISOString(),
    },
    checks,
    issueCodes,
    readyForReview: issueCodes.length === 0,
    readOnly: true,
    effectExecuted: false,
  };
}

async function writeOpsWorkerAudit(
  tx: Prisma.TransactionClient,
  entry: {
    action: string;
    entityId: string;
    metadata: Prisma.InputJsonValue;
  }
) {
  await tx.adminAuditLog.create({
    data: {
      actorId: null,
      actorEmail: "operations-worker@internal",
      actorName: "Operations worker",
      scope: "operations",
      action: entry.action,
      entityType: "ops.automation",
      entityId: entry.entityId,
      metadata: entry.metadata,
    },
  });
}

function terminalAutomationOutcome(
  status: OpsAutomationStatus,
  automationRunId: string,
  result: Prisma.JsonValue | null
) {
  if (status === OpsAutomationStatus.WAITING_HUMAN) {
    return {
      outcome: "waiting_human" as const,
      result: { automationRunId, terminalStatus: status, result },
    };
  }
  return {
    outcome: "succeeded" as const,
    result: { automationRunId, terminalStatus: status, result },
  };
}

async function executeCatalogCheckAutomation(
  client: PrismaClient,
  job: OpsJob,
  automationRunId: string
) {
  const preparation = await client.$transaction(
    async (tx) => {
      const run = await tx.opsAutomationRun.findUnique({
        where: { id: automationRunId },
        select: {
          id: true,
          taskId: true,
          automationType: true,
          status: true,
          inputSnapshot: true,
          result: true,
          task: {
            select: {
              id: true,
              status: true,
              version: true,
              archivedAt: true,
            },
          },
        },
      });
      if (
        !run ||
        run.automationType !== "catalog_check" ||
        !job.taskId ||
        run.taskId !== job.taskId
      ) {
        throw new Error("AUTOMATION_RUN_MISMATCH");
      }
      if (
        run.status === OpsAutomationStatus.SUCCEEDED ||
        run.status === OpsAutomationStatus.WAITING_HUMAN ||
        run.status === OpsAutomationStatus.FAILED ||
        run.status === OpsAutomationStatus.CANCELLED
      ) {
        return {
          terminal: terminalAutomationOutcome(run.status, run.id, run.result),
          request: null,
        };
      }
      const request = parseOpsAutomationRequest(run.inputSnapshot);
      if (request.type !== "catalog_check" || !request.input.productId) {
        throw new Error("AUTOMATION_INPUT_NOT_RESOLVED");
      }
      if (run.status === OpsAutomationStatus.RUNNING) {
        return { terminal: null, request };
      }
      if (run.status !== OpsAutomationStatus.QUEUED) {
        throw new Error("AUTOMATION_RUN_STATE_INVALID");
      }

      if (
        run.task.archivedAt ||
        run.task.status === OpsTaskStatus.DONE ||
        run.task.status === OpsTaskStatus.CANCELLED
      ) {
        const now = new Date();
        const result = {
          reason: run.task.archivedAt ? "task_archived" : "task_closed",
          readOnly: true,
          effectExecuted: false,
        };
        await tx.opsAutomationRun.update({
          where: { id: run.id },
          data: {
            status: OpsAutomationStatus.CANCELLED,
            stage: "task_unavailable",
            result,
            finishedAt: now,
          },
        });
        await tx.opsTaskEvent.create({
          data: {
            taskId: run.taskId,
            type: OpsTaskEventType.AUTOMATION_FINISHED,
            sourceType: OpsTaskSourceType.AUTOMATION,
            sourceId: run.id,
            idempotencyKey: job.idempotencyKey,
            payload: {
              automationRunId: run.id,
              automationType: "catalog_check",
              outcome: "cancelled",
              reason: result.reason,
              effectExecuted: false,
            },
          },
        });
        await writeOpsWorkerAudit(tx, {
          action: "automation.catalog_check.cancel",
          entityId: run.id,
          metadata: {
            taskId: run.taskId,
            jobId: job.id,
            reason: result.reason,
            effectExecuted: false,
          },
        });
        return {
          terminal: terminalAutomationOutcome(OpsAutomationStatus.CANCELLED, run.id, result),
          request: null,
        };
      }
      if (run.task.status === OpsTaskStatus.AGENT_RUNNING) {
        const result = {
          reason: "task_already_agent_running",
          readOnly: true,
          effectExecuted: false,
        };
        await tx.opsAutomationRun.update({
          where: { id: run.id },
          data: {
            status: OpsAutomationStatus.WAITING_HUMAN,
            stage: "task_state_conflict",
            result,
            finishedAt: new Date(),
          },
        });
        await tx.opsTaskEvent.create({
          data: {
            taskId: run.taskId,
            type: OpsTaskEventType.AUTOMATION_FINISHED,
            sourceType: OpsTaskSourceType.AUTOMATION,
            sourceId: run.id,
            idempotencyKey: job.idempotencyKey,
            payload: {
              automationRunId: run.id,
              automationType: "catalog_check",
              outcome: "waiting_human",
              reason: result.reason,
              effectExecuted: false,
            },
          },
        });
        await writeOpsWorkerAudit(tx, {
          action: "automation.catalog_check.wait",
          entityId: run.id,
          metadata: {
            taskId: run.taskId,
            jobId: job.id,
            reason: result.reason,
            effectExecuted: false,
          },
        });
        return {
          terminal: terminalAutomationOutcome(OpsAutomationStatus.WAITING_HUMAN, run.id, result),
          request: null,
        };
      }

      const taskChanged = await tx.opsTask.updateMany({
        where: {
          id: run.taskId,
          version: run.task.version,
          status: run.task.status,
          archivedAt: null,
        },
        data: {
          status: OpsTaskStatus.AGENT_RUNNING,
          nextAction: "Дождаться результата проверки карточки товара",
          blockerType: null,
          blockerDescription: null,
          attemptCount: { increment: 1 },
          version: { increment: 1 },
        },
      });
      if (taskChanged.count !== 1) {
        throw new Error("AUTOMATION_TASK_VERSION_CONFLICT");
      }
      const now = new Date();
      await tx.opsAutomationRun.update({
        where: { id: run.id },
        data: {
          status: OpsAutomationStatus.RUNNING,
          stage: "catalog_lookup",
          attempts: { increment: 1 },
          startedAt: now,
        },
      });
      await tx.opsTaskEvent.create({
        data: {
          taskId: run.taskId,
          type: OpsTaskEventType.AUTOMATION_STARTED,
          sourceType: OpsTaskSourceType.AUTOMATION,
          sourceId: run.id,
          idempotencyKey: job.idempotencyKey,
          payload: {
            phase: "running",
            automationRunId: run.id,
            automationType: "catalog_check",
            jobId: job.id,
            versionFrom: run.task.version,
            versionTo: run.task.version + 1,
          },
        },
      });
      await writeOpsWorkerAudit(tx, {
        action: "automation.catalog_check.running",
        entityId: run.id,
        metadata: {
          taskId: run.taskId,
          jobId: job.id,
          versionFrom: run.task.version,
          versionTo: run.task.version + 1,
          effectExecuted: false,
        },
      });
      return { terminal: null, request };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
  if (preparation.terminal || !preparation.request) {
    return preparation.terminal!;
  }
  const productId = preparation.request.input.productId;
  if (!productId) {
    throw new Error("AUTOMATION_INPUT_NOT_RESOLVED");
  }

  const product = await client.shopProduct.findFirst({
    where: {
      id: productId,
      ...(preparation.request.input.sku ? { sku: preparation.request.input.sku } : {}),
    },
    select: {
      id: true,
      sku: true,
      slug: true,
      brand: true,
      titleUa: true,
      titleEn: true,
      categoryUa: true,
      categoryEn: true,
      image: true,
      isPublished: true,
      status: true,
      stock: true,
      updatedAt: true,
    },
  });
  const result = buildOpsCatalogCheckResult({
    product,
    requestedProductId: productId,
    requestedSku: preparation.request.input.sku,
  });

  return client.$transaction(
    async (tx) => {
      const current = await tx.opsAutomationRun.findUnique({
        where: { id: automationRunId },
        select: {
          id: true,
          status: true,
          result: true,
          task: {
            select: {
              id: true,
              status: true,
              version: true,
            },
          },
        },
      });
      if (!current) throw new Error("AUTOMATION_RUN_NOT_FOUND");
      if (current.status !== OpsAutomationStatus.RUNNING) {
        return terminalAutomationOutcome(current.status, current.id, current.result);
      }
      if (current.task.status !== OpsTaskStatus.AGENT_RUNNING) {
        const humanOverrideResult = {
          ...result,
          outcome: "human_override",
          reason: "task_status_changed_during_execution",
        };
        await tx.opsAutomationRun.update({
          where: { id: current.id },
          data: {
            status: OpsAutomationStatus.WAITING_HUMAN,
            stage: "human_override",
            result: humanOverrideResult,
            finishedAt: new Date(),
          },
        });
        await tx.opsTaskEvent.create({
          data: {
            taskId: current.task.id,
            type: OpsTaskEventType.AUTOMATION_FINISHED,
            sourceType: OpsTaskSourceType.AUTOMATION,
            sourceId: current.id,
            idempotencyKey: job.idempotencyKey,
            payload: {
              automationRunId: current.id,
              automationType: "catalog_check",
              outcome: "human_override",
              effectExecuted: false,
            },
          },
        });
        await writeOpsWorkerAudit(tx, {
          action: "automation.catalog_check.wait",
          entityId: current.id,
          metadata: {
            taskId: current.task.id,
            jobId: job.id,
            reason: "task_status_changed_during_execution",
            effectExecuted: false,
          },
        });
        return {
          outcome: "waiting_human" as const,
          result: { automationRunId: current.id, ...humanOverrideResult },
        };
      }

      const productFound = result.outcome === "found";
      const taskChanged = await tx.opsTask.updateMany({
        where: {
          id: current.task.id,
          version: current.task.version,
          status: OpsTaskStatus.AGENT_RUNNING,
        },
        data: productFound
          ? {
              status: OpsTaskStatus.REVIEW,
              nextAction: result.readyForReview
                ? "Проверить результат и подтвердить карточку товара"
                : "Проверить замечания по карточке товара",
              blockerType: null,
              blockerDescription: null,
              version: { increment: 1 },
            }
          : {
              status: OpsTaskStatus.WAITING_HUMAN,
              nextAction: null,
              blockerType: OpsBlockerType.INFORMATION,
              blockerDescription:
                "Товар больше не найден по сохранённому ID и SKU. Нужен ручной выбор товара.",
              version: { increment: 1 },
            },
      });
      if (taskChanged.count !== 1) {
        throw new Error("AUTOMATION_TASK_VERSION_CONFLICT");
      }
      const finalStatus = productFound
        ? OpsAutomationStatus.SUCCEEDED
        : OpsAutomationStatus.WAITING_HUMAN;
      await tx.opsAutomationRun.update({
        where: { id: current.id },
        data: {
          status: finalStatus,
          stage: productFound ? "review" : "catalog_target_missing",
          result,
          finishedAt: new Date(),
        },
      });
      await tx.opsTaskEvent.create({
        data: {
          taskId: current.task.id,
          type: OpsTaskEventType.AUTOMATION_FINISHED,
          sourceType: OpsTaskSourceType.AUTOMATION,
          sourceId: current.id,
          idempotencyKey: job.idempotencyKey,
          payload: {
            automationRunId: current.id,
            automationType: "catalog_check",
            outcome: result.outcome,
            issueCodes: result.outcome === "found" ? result.issueCodes : [],
            effectExecuted: false,
            versionFrom: current.task.version,
            versionTo: current.task.version + 1,
          },
        },
      });
      await writeOpsWorkerAudit(tx, {
        action: productFound ? "automation.catalog_check.finish" : "automation.catalog_check.wait",
        entityId: current.id,
        metadata: {
          taskId: current.task.id,
          jobId: job.id,
          outcome: result.outcome,
          issueCodes: result.outcome === "found" ? result.issueCodes : [],
          versionFrom: current.task.version,
          versionTo: current.task.version + 1,
          effectExecuted: false,
        },
      });
      if (!productFound) {
        return {
          outcome: "waiting_human" as const,
          result: { automationRunId: current.id, ...result },
        };
      }
      return {
        outcome: "succeeded" as const,
        result: { automationRunId: current.id, ...result },
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}

async function executeAutomationJob(client: PrismaClient, job: OpsJob) {
  const payload = (job.payload && typeof job.payload === "object" ? job.payload : {}) as Record<
    string,
    unknown
  >;
  const automationRunId = String(payload.automationRunId ?? "");
  const type = String(payload.type ?? "") as OpsAutomationType;
  if (!automationRunId || !Object.hasOwn(OPS_AUTOMATION_REGISTRY, type)) {
    throw new Error("AUTOMATION_NOT_ALLOWED");
  }

  // The registry deliberately has no purchase/payment/checkout/browser/shell/SQL
  // capability. Actual helper execution remains canary-gated; queued work stays
  // visible instead of silently performing an effect.
  if (!isOpsAutomationsEnabled()) {
    await client.opsAutomationRun.update({
      where: { id: automationRunId },
      data: {
        status: OpsAutomationStatus.WAITING_HUMAN,
        stage: "canary_gate",
        result: {
          reason: "Automation helpers are disabled until the canary gate is accepted",
          registry: OPS_AUTOMATION_REGISTRY[type],
        },
        finishedAt: new Date(),
      },
    });
    return {
      outcome: "waiting_human" as const,
      result: { automationRunId, reason: "canary_gate" },
    };
  }

  if (type === "catalog_check") {
    return executeCatalogCheckAutomation(client, job, automationRunId);
  }

  await client.opsAutomationRun.update({
    where: { id: automationRunId },
    data: {
      status: OpsAutomationStatus.WAITING_HUMAN,
      stage: "typed_helper_pending",
      result: {
        reason: "Typed helper requires an explicit implementation and human review",
        registry: OPS_AUTOMATION_REGISTRY[type],
      },
      finishedAt: new Date(),
    },
  });
  return {
    outcome: "waiting_human" as const,
    result: { automationRunId, reason: "typed_helper_pending" },
  };
}

async function executeInternalNotificationJob(input: {
  client: PrismaClient;
  job: OpsJob;
  fetchImpl?: typeof fetch;
}) {
  const payload = (
    input.job.payload && typeof input.job.payload === "object" ? input.job.payload : {}
  ) as Record<string, unknown>;
  const telegramUserId = BigInt(String(payload.telegramUserId ?? "0"));
  const profile = await input.client.opsMemberProfile.findFirst({
    where: {
      telegramUserId,
      telegramEnabled: true,
      adminUser: { isActive: true },
    },
    select: {
      id: true,
      adminUserId: true,
      timezone: true,
      adminUser: {
        select: {
          name: true,
          roles: {
            select: {
              role: { select: { key: true, permissions: true } },
            },
          },
        },
      },
    },
  });
  if (!profile) {
    return {
      outcome: "succeeded" as const,
      result: { notification: "skipped_recipient_no_longer_allowed" },
    };
  }
  const expectedAdminUserId = String(payload.recipientAdminUserId ?? "").trim();
  if (expectedAdminUserId && expectedAdminUserId !== profile.adminUserId) {
    return {
      outcome: "succeeded" as const,
      result: { notification: "skipped_recipient_identity_changed" },
    };
  }
  if (!opsRolesAllowNotification(profile.adminUser.roles, input.job.type)) {
    return {
      outcome: "succeeded" as const,
      result: { notification: "skipped_recipient_permission_revoked" },
    };
  }
  if (input.job.type === "telegram_task_assigned" || input.job.type === "telegram_task_reminder") {
    const taskId = String(payload.taskId ?? input.job.taskId ?? "").trim();
    const assignedTask = taskId
      ? await input.client.opsTask.findFirst({
          where: {
            id: taskId,
            archivedAt: null,
            assigneeId: profile.adminUserId,
          },
          select: { id: true },
        })
      : null;
    if (!assignedTask) {
      return {
        outcome: "succeeded" as const,
        result: { notification: "skipped_task_no_longer_assigned" },
      };
    }
  }
  let text: string;
  let replyMarkup: OpsTelegramReplyMarkup | undefined;
  if (input.job.type === "telegram_task_assigned") {
    const title = String(payload.title ?? "Задача").slice(0, 500);
    const recipientName = String(profile.adminUser.name ?? "").trim() || "Вы";
    const dueAt = payload.dueAt ? new Date(String(payload.dueAt)) : null;
    const dueLabel =
      dueAt && !Number.isNaN(dueAt.getTime())
        ? dueAt.toLocaleString("ru-RU", {
            timeZone: profile.timezone,
            dateStyle: "medium",
            timeStyle: "short",
          })
        : "без срока";
    const taskId = String(payload.taskId ?? input.job.taskId ?? "");
    const taskUrl = taskId ? opsAdminLink(`/admin/operations/tasks/${taskId}`) : null;
    text = [
      "🆕 Вам назначена задача",
      `${String(payload.externalId ?? "")} — ${title}`.trim(),
      "",
      `👤 ИСПОЛНИТЕЛЬ: ${recipientName}`,
      `👤 Поставил: ${String(payload.assignedByName ?? "менеджер")}`,
      `⏰ Срок: ${dueLabel}`,
    ].join("\n");
    const rows: NonNullable<typeof replyMarkup>["inline_keyboard"] = [];
    if (taskUrl) rows.push([{ text: "📋 Открыть задачу", url: taskUrl, style: "primary" }]);
    const callbacks: OpsTelegramReplyMarkup["inline_keyboard"][number] = [];
    for (const [action, label, style] of [
      ["start", "▶️ Взять в работу", "success"],
      ["not_mine", "🙋 Не моя задача", "danger"],
    ] as const) {
      const callbackData = await createOpsTelegramCallbackState({
        client: input.client,
        action,
        resourceId: taskId,
        actorAdminUserId: profile.adminUserId,
        ttlMs: 7 * 24 * 60 * 60 * 1000,
      });
      if (callbackData) callbacks.push({ text: label, callback_data: callbackData, style });
    }
    if (callbacks.length) rows.push(callbacks);
    if (rows.length) replyMarkup = { inline_keyboard: rows };
  } else if (input.job.type === "telegram_task_reminder") {
    const title = String(payload.title ?? "Задача").slice(0, 500);
    const dueAt = payload.dueAt ? new Date(String(payload.dueAt)) : null;
    const dueLabel =
      dueAt && !Number.isNaN(dueAt.getTime())
        ? dueAt.toLocaleString("ru-RU", { timeZone: "Europe/Kyiv" })
        : "срок не указан";
    text = [
      "⏰ Срок задачи истёк",
      `${String(payload.externalId ?? "")} — ${title}`.trim(),
      "",
      payload.missingNextAction === true
        ? "Нужно указать следующее действие."
        : `Дедлайн: ${dueLabel}`,
      "Это единственное напоминание по этой задаче.",
    ]
      .filter(Boolean)
      .join("\n");
    const taskId = String(payload.taskId ?? input.job.taskId ?? "");
    const taskUrl = taskId ? opsAdminLink(`/admin/operations/tasks/${taskId}`) : null;
    const callbacks: OpsTelegramReplyMarkup["inline_keyboard"][number] = [];
    for (const [action, label, style] of [
      ["edit", "✏️ Исправить", undefined],
      ["assign", "👤 Назначить", "primary"],
      ["change_due", "🗓 Изменить срок", "primary"],
      ["done", "✅ Выполнено", "success"],
    ] as const) {
      const callbackData = await createOpsTelegramCallbackState({
        client: input.client,
        action,
        resourceId: taskId,
        actorAdminUserId: profile.adminUserId,
        ttlMs: 24 * 60 * 60 * 1000,
      });
      if (callbackData)
        callbacks.push({
          text: label,
          callback_data: callbackData,
          ...(style ? { style } : {}),
        });
    }
    const rows: NonNullable<typeof replyMarkup>["inline_keyboard"] = [];
    if (taskUrl) rows.push([{ text: "📋 Открыть задачу", url: taskUrl, style: "primary" }]);
    for (let index = 0; index < callbacks.length; index += 2) {
      rows.push(callbacks.slice(index, index + 2));
    }
    if (rows.length) replyMarkup = { inline_keyboard: rows };
  } else {
    const counts = (
      payload.counts && typeof payload.counts === "object" ? payload.counts : {}
    ) as Record<string, unknown>;
    const active = Object.values(counts).reduce<number>(
      (sum, value) => sum + (Number(value) || 0),
      0
    );
    text = [
      "☀️ Ваши задачи на сегодня",
      "",
      `Всего активных: ${active}`,
      `🔴 Просрочено: ${Number(payload.overdueCount ?? 0)}`,
      `🟠 На сегодня: ${Number(payload.todayCount ?? 0)}`,
      `⚪ Без срока: ${Number(payload.withoutDueCount ?? 0)}`,
    ]
      .filter(Boolean)
      .join("\n");
    const tasksUrl = opsAdminLink("/admin/operations/tasks?mine=1");
    if (tasksUrl) {
      replyMarkup = {
        inline_keyboard: [[{ text: "📋 Открыть мои задачи", url: tasksUrl, style: "primary" }]],
      };
    }
  }
  try {
    const sent = await sendOpsTelegramNotification({
      chatId: telegramUserId,
      text,
      replyMarkup,
      fetchImpl: input.fetchImpl,
    });
    if (input.job.taskId) {
      await input.client.opsTelegramDelivery.upsert({
        where: {
          chatId_telegramMessageId: {
            chatId: sent.chatId,
            telegramMessageId: sent.messageId,
          },
        },
        create: {
          taskId: input.job.taskId,
          chatId: sent.chatId,
          telegramMessageId: sent.messageId,
          kind: input.job.type === "telegram_task_assigned" ? "task_assignment" : "task_reminder",
        },
        update: {},
      });
    }
    return {
      outcome: "succeeded" as const,
      result: { notification: "sent", telegramMessageId: sent.messageId },
    };
  } catch (error) {
    if (error instanceof OpsNotificationError && error.code === "NOTIFICATIONS_DISABLED") {
      return {
        outcome: "succeeded" as const,
        result: { notification: "disabled" },
      };
    }
    throw error;
  }
}

export function createOpsJobStageExecutor(input: {
  client: PrismaClient;
  dependencies?: OpsTelegramJobDependencies;
}): OpsJobStageExecutor {
  return async ({ job }) => {
    if (job.type === "telegram_intake" || job.type === "telegram_batch") {
      return executeTelegramIntakeStage({
        client: input.client,
        job,
        dependencies: input.dependencies ?? {},
      });
    }
    if (job.type.startsWith("automation:") && job.stage === OpsJobStage.EXECUTE_AUTOMATIONS) {
      return executeAutomationJob(input.client, job);
    }
    if (
      (job.type === "telegram_task_assigned" ||
        job.type === "telegram_task_reminder" ||
        job.type === "telegram_internal_report") &&
      job.stage === OpsJobStage.NOTIFY
    ) {
      return executeInternalNotificationJob({
        client: input.client,
        job,
        fetchImpl: input.dependencies?.fetchImpl,
      });
    }
    if (job.type === "watchdog" && job.stage === OpsJobStage.WATCHDOG) {
      return {
        outcome: "succeeded",
        result: { deterministic: true, aiUsed: false },
      };
    }
    throw new Error(`OPS_JOB_TYPE_NOT_ALLOWED:${job.type}`);
  };
}

export async function listPublishedKnowledgeContext(client: PrismaClient, query: string) {
  const terms = query
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 3)
    .slice(0, 5);
  if (!terms.length) return [];
  return client.opsKnowledgeArticle.findMany({
    where: {
      status: OpsKnowledgeStatus.PUBLISHED,
      OR: terms.flatMap((term) => [
        { title: { contains: term, mode: "insensitive" as const } },
        { searchText: { contains: term, mode: "insensitive" as const } },
      ]),
    },
    orderBy: { updatedAt: "desc" },
    take: 5,
    select: { id: true, title: true, category: true },
  });
}
