import {
  OpsInboxExtractionStatus,
  OpsInboxReviewStatus,
  OpsJobStatus,
  Prisma,
  type PrismaClient,
} from "@prisma/client";

import { OpsError } from "@/lib/operations/errors";
import { OPS_JOB_MAX_ATTEMPTS } from "@/lib/operations/jobs";
import { getOpsMediaConfiguration } from "@/lib/operations/media";

export const OPS_SYSTEM_RECENT_JOBS_LIMIT = 50;

const OPS_SYSTEM_USAGE_FEATURES = ["telegram_manager", "media_upload", "media_retained"] as const;

const OPS_SYSTEM_SAFE_JOB_TYPES = new Set([
  "telegram_intake",
  "telegram_task_assigned",
  "telegram_task_reminder",
  "telegram_internal_report",
  "automation:research_draft",
  "automation:document_summary",
  "automation:catalog_check",
]);

const OPS_SYSTEM_SAFE_ERROR_LABELS: Readonly<Record<string, string>> = {
  WAITING_HUMAN: "Требуется действие сотрудника.",
  AI_BUDGET_EXHAUSTED: "Месячный лимит AI исчерпан.",
  AI_NOT_CONFIGURED: "AI-провайдер не настроен.",
  AI_OUTPUT_EMPTY: "AI вернул пустой результат.",
  AI_OUTPUT_INVALID: "AI вернул результат неверного формата.",
  AI_PROVIDER_FAILED: "AI-провайдер временно недоступен.",
  TRANSCRIPTION_EMPTY: "В записи не удалось распознать речь.",
  LEASE_EXPIRED: "Worker не завершил этап в пределах lease.",
  OPS_JOB_STAGE_TIMEOUT: "Этап превысил допустимое время.",
  ATTACHMENT_MIME_REJECTED: "Тип вложения не разрешён.",
  ATTACHMENT_SIGNATURE_MISMATCH: "Содержимое файла не соответствует его типу.",
  ATTACHMENT_SIZE_LIMIT: "Файл превышает допустимый размер.",
  ATTACHMENT_TYPE_REJECTED: "Тип файла заблокирован.",
  AUDIO_DURATION_LIMIT: "Аудиозапись превышает допустимую длительность.",
  MEDIA_MONTHLY_UPLOAD_CAP: "Месячный лимит загрузок исчерпан.",
  MEDIA_RETAINED_SOFT_CAP: "Достигнут лимит сохранённых медиа.",
  PRIVATE_BLOB_NOT_CONFIGURED: "Закрытое файловое хранилище не настроено.",
  TELEGRAM_DOWNLOAD_FAILED: "Telegram не отдал файл.",
  TELEGRAM_FILE_INVALID: "Telegram вернул некорректный файл.",
  TELEGRAM_GET_FILE_FAILED: "Telegram не отдал метаданные файла.",
  TELEGRAM_SEND_FAILED: "Telegram не принял уведомление.",
  TELEGRAM_SEND_INVALID: "Telegram вернул некорректный ответ.",
  TELEGRAM_TOKEN_NOT_CONFIGURED: "Lab-бот не настроен.",
  NOTIFICATIONS_DISABLED: "Внутренние уведомления выключены.",
  AUTOMATION_NOT_ALLOWED: "Тип помощника не разрешён.",
  AUTOMATION_RUN_MISMATCH: "Задача помощника не соответствует durable job.",
  AUTOMATION_INPUT_NOT_RESOLVED: "Помощнику не удалось определить входные данные.",
  AUTOMATION_RUN_STATE_INVALID: "Состояние запуска помощника изменилось.",
  JOB_STAGE_FAILED: "Этап завершился ошибкой. Детали доступны только в серверных логах.",
};

export const opsSystemJobSelect = {
  id: true,
  type: true,
  status: true,
  stage: true,
  errorType: true,
  attempts: true,
  maxAttempts: true,
  availableAt: true,
  startedAt: true,
  finishedAt: true,
  createdAt: true,
  updatedAt: true,
  task: {
    select: {
      id: true,
      externalId: true,
    },
  },
  inboxItem: {
    select: {
      id: true,
      extractionStatus: true,
      reviewStatus: true,
      createdAt: true,
    },
  },
} satisfies Prisma.OpsJobSelect;

export type OpsSystemJobRow = Prisma.OpsJobGetPayload<{
  select: typeof opsSystemJobSelect;
}>;

export type OpsSystemJobSummary = ReturnType<typeof toOpsSystemJobSummary>;

function currentMonth(now: Date) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function safeJobType(value: string) {
  return OPS_SYSTEM_SAFE_JOB_TYPES.has(value)
    ? value
    : value.startsWith("automation:")
      ? "automation:unknown"
      : "internal_job";
}

function safeJobError(status: OpsJobStatus, value: string | null) {
  const candidate = String(value ?? "")
    .trim()
    .toUpperCase();
  const type =
    candidate && Object.hasOwn(OPS_SYSTEM_SAFE_ERROR_LABELS, candidate)
      ? candidate
      : status === OpsJobStatus.WAITING_HUMAN
        ? "WAITING_HUMAN"
        : "JOB_STAGE_FAILED";
  return {
    type,
    message: OPS_SYSTEM_SAFE_ERROR_LABELS[type],
  };
}

/**
 * Deliberately serializes only an allowlisted projection. In particular this
 * function never accepts or emits job payload/result, raw Telegram updates,
 * private messages, addresses, payment data, lease owner, or raw error text.
 */
export function toOpsSystemJobSummary(row: OpsSystemJobRow) {
  return {
    id: row.id,
    type: safeJobType(row.type),
    status: row.status,
    stage: row.stage,
    attempts: row.attempts,
    maxAttempts: Math.max(1, Math.min(OPS_JOB_MAX_ATTEMPTS, row.maxAttempts)),
    availableAt: row.availableAt,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    error: safeJobError(row.status, row.errorType),
    task: row.task
      ? {
          id: row.task.id,
          externalId: row.task.externalId,
        }
      : null,
    inboxItem: row.inboxItem
      ? {
          id: row.inboxItem.id,
          extractionStatus: row.inboxItem.extractionStatus,
          reviewStatus: row.inboxItem.reviewStatus,
          createdAt: row.inboxItem.createdAt,
        }
      : null,
  };
}

export function assertOpsSystemJobRetryable(job: {
  status: OpsJobStatus;
  leaseOwner: string | null;
  leaseExpiresAt: Date | null;
}) {
  if (job.status !== OpsJobStatus.DEAD_LETTER && job.status !== OpsJobStatus.WAITING_HUMAN) {
    throw new OpsError(
      "JOB_NOT_RETRYABLE",
      409,
      "Only dead-letter or waiting-human jobs can be retried"
    );
  }
  if (job.leaseOwner || job.leaseExpiresAt) {
    throw new OpsError("JOB_RETRY_CONFLICT", 409, "The job still has an active or stale lease");
  }
}

export function opsSystemManualRetryData(input: { maxAttempts: number; now: Date }) {
  return {
    status: OpsJobStatus.QUEUED,
    attempts: 0,
    maxAttempts: Math.max(1, Math.min(OPS_JOB_MAX_ATTEMPTS, input.maxAttempts)),
    availableAt: input.now,
    leaseOwner: null,
    leaseExpiresAt: null,
    heartbeatAt: null,
    cancelRequestedAt: null,
    startedAt: null,
    finishedAt: null,
    errorType: null,
    errorMessage: null,
  } as const;
}

export async function retryOpsSystemJob(input: {
  tx: Prisma.TransactionClient;
  jobId: string;
  now?: Date;
}) {
  const job = await input.tx.opsJob.findUnique({
    where: { id: input.jobId },
    select: {
      id: true,
      type: true,
      status: true,
      stage: true,
      attempts: true,
      maxAttempts: true,
      leaseOwner: true,
      leaseExpiresAt: true,
    },
  });
  if (!job) {
    throw new OpsError("NOT_FOUND", 404, "Operations job not found");
  }
  assertOpsSystemJobRetryable(job);
  const now = input.now ?? new Date();
  const retryData = opsSystemManualRetryData({
    maxAttempts: job.maxAttempts,
    now,
  });
  const changed = await input.tx.opsJob.updateMany({
    where: {
      id: job.id,
      status: job.status,
      leaseOwner: null,
      leaseExpiresAt: null,
    },
    data: retryData,
  });
  if (changed.count !== 1) {
    throw new OpsError("JOB_RETRY_CONFLICT", 409, "The job changed before the retry was queued");
  }
  return {
    id: job.id,
    type: safeJobType(job.type),
    previousStatus: job.status,
    stage: job.stage,
    previousAttempts: job.attempts,
    attempts: retryData.attempts,
    maxAttempts: retryData.maxAttempts,
    status: retryData.status,
    availableAt: retryData.availableAt,
  };
}

export async function getOpsSystemHealth(input: {
  client: PrismaClient;
  now?: Date;
  recentJobsLimit?: number;
}) {
  const now = input.now ?? new Date();
  const since24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1_000);
  const recentJobsLimit = Math.max(
    1,
    Math.min(OPS_SYSTEM_RECENT_JOBS_LIMIT, input.recentJobsLimit ?? 25)
  );
  const month = currentMonth(now);

  const [
    jobGroups,
    recentJobs,
    failedInbox,
    failedPendingReview,
    failedInboxLast24Hours,
    usageBuckets,
  ] = await Promise.all([
    input.client.opsJob.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    input.client.opsJob.findMany({
      where: {
        status: {
          in: [OpsJobStatus.DEAD_LETTER, OpsJobStatus.WAITING_HUMAN],
        },
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: recentJobsLimit,
      select: opsSystemJobSelect,
    }),
    input.client.opsInboxItem.count({
      where: { extractionStatus: OpsInboxExtractionStatus.FAILED },
    }),
    input.client.opsInboxItem.count({
      where: {
        extractionStatus: OpsInboxExtractionStatus.FAILED,
        reviewStatus: OpsInboxReviewStatus.PENDING,
      },
    }),
    input.client.opsInboxItem.count({
      where: {
        extractionStatus: OpsInboxExtractionStatus.FAILED,
        updatedAt: { gte: since24Hours },
      },
    }),
    input.client.opsUsageBucket.findMany({
      where: {
        OR: [
          {
            month,
            feature: {
              in: ["telegram_manager", "media_upload"],
            },
          },
          {
            feature: "media_retained",
          },
        ],
      },
      orderBy: [{ feature: "asc" }, { month: "desc" }],
      take: OPS_SYSTEM_USAGE_FEATURES.length,
      select: {
        id: true,
        month: true,
        feature: true,
        inputTokens: true,
        outputTokens: true,
        audioSeconds: true,
        costMicros: true,
        storageBytes: true,
        warningMicros: true,
        hardStopMicros: true,
        updatedAt: true,
      },
    }),
  ]);

  const jobs = Object.fromEntries(
    Object.values(OpsJobStatus).map((status) => [status, 0])
  ) as Record<OpsJobStatus, number>;
  for (const group of jobGroups) {
    jobs[group.status] = group._count._all;
  }

  return {
    generatedAt: now,
    media: getOpsMediaConfiguration(),
    jobs,
    attention: recentJobs.map(toOpsSystemJobSummary),
    inbox: {
      failed: failedInbox,
      failedPendingReview,
      failedLast24Hours: failedInboxLast24Hours,
    },
    usage: usageBuckets.map((bucket) => ({
      ...bucket,
      feature: OPS_SYSTEM_USAGE_FEATURES.includes(
        bucket.feature as (typeof OPS_SYSTEM_USAGE_FEATURES)[number]
      )
        ? bucket.feature
        : "unknown",
      warningReached: bucket.costMicros >= bucket.warningMicros,
      hardStopReached: bucket.costMicros >= bucket.hardStopMicros,
    })),
  };
}
