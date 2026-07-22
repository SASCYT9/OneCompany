"use client";

import { useEffect, useMemo, useState } from "react";

import Link from "next/link";
import {
  Activity,
  Bot,
  CircleAlert,
  Clock3,
  Database,
  HardDrive,
  Inbox,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  TriangleAlert,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";

import { opsGet, opsMutation } from "./opsApi";
import { OpsPageHeader } from "./OpsPageHeader";
import { OpsSurface } from "./OpsSurface";

type JobStatus =
  | "QUEUED"
  | "RUNNING"
  | "WAITING_HUMAN"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELLED"
  | "DEAD_LETTER";

type SystemJob = {
  id: string;
  type: string;
  status: "WAITING_HUMAN" | "DEAD_LETTER";
  stage: string;
  attempts: number;
  maxAttempts: number;
  availableAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  error: {
    type: string;
    message: string;
  };
  task: {
    id: string;
    externalId: string;
  } | null;
  inboxItem: {
    id: string;
    extractionStatus: string;
    reviewStatus: string;
    createdAt: string;
  } | null;
};

type UsageBucket = {
  id: string;
  month: string;
  feature: string;
  inputTokens: string;
  outputTokens: string;
  audioSeconds: number;
  costMicros: string;
  storageBytes: string;
  warningMicros: string;
  hardStopMicros: string;
  warningReached: boolean;
  hardStopReached: boolean;
  updatedAt: string;
};

type SystemHealth = {
  generatedAt: string;
  media: {
    provider: "local" | "vercel_blob" | "missing" | "invalid";
    configured: boolean;
    productionReady: boolean;
  };
  jobs: Record<JobStatus, number>;
  attention: SystemJob[];
  inbox: {
    failed: number;
    failedPendingReview: number;
    failedLast24Hours: number;
  };
  usage: UsageBucket[];
};

const JOB_TYPE_LABELS: Readonly<Record<string, string>> = {
  telegram_intake: "Входящее Telegram",
  telegram_task_reminder: "Напоминание о задаче",
  telegram_internal_report: "Внутренний отчёт",
  "automation:research_draft": "Помощник: поиск",
  "automation:document_summary": "Помощник: документ",
  "automation:catalog_check": "Помощник: товар",
  "automation:unknown": "Помощник",
  internal_job: "Внутренняя задача",
};

const STAGE_LABELS: Readonly<Record<string, string>> = {
  INGEST: "Приём",
  DOWNLOAD_MEDIA: "Загрузка файла",
  TRANSCRIBE: "Транскрибация",
  EXTRACT: "Разбор сообщения",
  RESOLVE_CONTEXT: "Определение контекста",
  CREATE_PREVIEW_OR_ENTITIES: "Создание preview",
  EXECUTE_AUTOMATIONS: "Работа помощника",
  NOTIFY: "Уведомление",
  WATCHDOG: "Системная проверка",
};

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function numeric(value: string | number) {
  const result = Number(value);
  return Number.isFinite(result) && result > 0 ? result : 0;
}

function formatBytes(value: string | number) {
  const bytes = numeric(value);
  if (bytes < 1024) return `${Math.round(bytes)} Б`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} КБ`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} МБ`;
  return `${(bytes / 1024 ** 3).toFixed(2)} ГБ`;
}

function formatUsdMicros(value: string | number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numeric(value) / 1_000_000);
}

function usageLabel(feature: string) {
  if (feature === "telegram_manager") return "AI и транскрибация";
  if (feature === "media_upload") return "Загрузки в этом месяце";
  if (feature === "media_retained") return "Сохранённые файлы";
  return "Системный ресурс";
}

function usageValue(bucket: UsageBucket) {
  if (bucket.feature === "telegram_manager") {
    return formatUsdMicros(bucket.costMicros);
  }
  return formatBytes(bucket.storageBytes);
}

function usageLimit(bucket: UsageBucket) {
  if (bucket.feature === "telegram_manager") return numeric(bucket.hardStopMicros);
  if (bucket.feature === "media_upload") return 2 * 1024 ** 3;
  if (bucket.feature === "media_retained") return 10 * 1024 ** 3;
  return 0;
}

function usageCurrent(bucket: UsageBucket) {
  return bucket.feature === "telegram_manager"
    ? numeric(bucket.costMicros)
    : numeric(bucket.storageBytes);
}

function mediaStoreLabel(provider: SystemHealth["media"]["provider"]) {
  if (provider === "vercel_blob") return "Vercel Blob";
  if (provider === "local") return "Локальное Lab-хранилище";
  if (provider === "invalid") return "Неверная конфигурация";
  return "Не настроено";
}

export function OpsSystem({ permissions }: { permissions: readonly string[] }) {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<SystemJob | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError(null);
    void opsGet<SystemHealth>("/api/admin/operations/system?take=50", controller.signal)
      .then(setHealth)
      .catch((cause) => {
        if (controller.signal.aborted) return;
        setLoadError(
          cause instanceof Error ? cause.message : "Не удалось загрузить состояние системы."
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [reloadNonce]);

  const attentionCount = useMemo(
    () => (health?.jobs.DEAD_LETTER ?? 0) + (health?.jobs.WAITING_HUMAN ?? 0),
    [health]
  );

  async function retryJob() {
    if (!selectedJob || retrying) return;
    setRetrying(true);
    setRetryError(null);
    try {
      await opsMutation<{
        job: {
          id: string;
          status: "QUEUED";
        };
      }>({
        path: "/api/admin/operations/system",
        body: {
          action: "retry",
          jobId: selectedJob.id,
        },
        scope: `system-job-retry:${selectedJob.id}`,
      });
      setNotice("Задача повторно поставлена в очередь без создания дубликата.");
      setSelectedJob(null);
      setReloadNonce((value) => value + 1);
    } catch (cause) {
      setRetryError(
        cause instanceof Error ? cause.message : "Не удалось повторно поставить задачу в очередь."
      );
    } finally {
      setRetrying(false);
    }
  }

  return (
    <OpsSurface permissions={permissions}>
      <OpsPageHeader
        title="Система"
        description="Безопасный обзор очереди, ошибок и лимитов One Company Operations."
        actions={
          <button
            type="button"
            onClick={() => {
              setNotice(null);
              setReloadNonce((value) => value + 1);
            }}
            disabled={loading}
            className="flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:border-blue-300 hover:text-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} aria-hidden="true" />
            Обновить
          </button>
        }
      />

      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8" data-ops-system-health>
        {notice ? (
          <div
            role="status"
            className="mb-5 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
          >
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <span className="flex-1">{notice}</span>
            <button
              type="button"
              onClick={() => setNotice(null)}
              aria-label="Закрыть сообщение"
              className="rounded-md p-1 hover:bg-emerald-100"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ) : null}

        {loadError ? (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-semibold">Система не загрузилась</p>
              <p className="mt-1">{loadError}</p>
            </div>
          </div>
        ) : loading && !health ? (
          <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            Проверяем очередь и лимиты…
          </div>
        ) : health ? (
          <>
            <section aria-labelledby="ops-system-summary-title">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2
                    id="ops-system-summary-title"
                    className="text-base font-semibold text-slate-950"
                  >
                    Состояние очереди
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Обновлено {formatDate(health.generatedAt)}
                  </p>
                </div>
                <p className="text-xs text-slate-500">
                  Требуют внимания:{" "}
                  <span className="font-semibold text-slate-800">{attentionCount}</span>
                </p>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <SummaryCard
                  label="В очереди"
                  value={health.jobs.QUEUED}
                  hint="Ожидают worker"
                  icon={Clock3}
                  tone="blue"
                />
                <SummaryCard
                  label="Выполняются"
                  value={health.jobs.RUNNING}
                  hint="Активный lease"
                  icon={Activity}
                  tone="emerald"
                />
                <SummaryCard
                  label="Нужен сотрудник"
                  value={health.jobs.WAITING_HUMAN}
                  hint="Без автопродолжения"
                  icon={CircleAlert}
                  tone="amber"
                />
                <SummaryCard
                  label="Dead letter"
                  value={health.jobs.DEAD_LETTER}
                  hint="Исчерпаны попытки"
                  icon={TriangleAlert}
                  tone="red"
                />
              </div>
            </section>

            <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.7fr)]">
              <section aria-labelledby="ops-system-attention-title">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2
                      id="ops-system-attention-title"
                      className="text-base font-semibold text-slate-950"
                    >
                      Требуют внимания
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                      Только безопасные технические данные без сообщений и вложений.
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700">
                    {health.attention.length}
                  </span>
                </div>

                {health.attention.length ? (
                  <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                    <div className="divide-y divide-slate-200">
                      {health.attention.map((job) => (
                        <article
                          key={job.id}
                          className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={cn(
                                  "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                                  job.status === "DEAD_LETTER"
                                    ? "bg-red-50 text-red-700"
                                    : "bg-amber-50 text-amber-800"
                                )}
                              >
                                {job.status === "DEAD_LETTER" ? "Dead letter" : "Нужен сотрудник"}
                              </span>
                              <span className="text-xs text-slate-400">
                                {STAGE_LABELS[job.stage] ?? "Внутренний этап"}
                              </span>
                            </div>
                            <h3 className="mt-2 truncate text-sm font-semibold text-slate-950">
                              {JOB_TYPE_LABELS[job.type] ?? "Внутренняя задача"}
                            </h3>
                            <p className="mt-1 text-sm leading-5 text-slate-600">
                              {job.error.message}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                              <span>
                                Код:{" "}
                                <span className="font-mono text-slate-700">{job.error.type}</span>
                              </span>
                              <span>
                                Попытки: {job.attempts}/{job.maxAttempts}
                              </span>
                              <span>{formatDate(job.updatedAt)}</span>
                            </div>
                            {job.task ? (
                              <Link
                                href={`/admin/operations/tasks/${job.task.id}`}
                                className="mt-2 inline-flex max-w-full items-center gap-1 text-xs font-semibold text-blue-700 hover:underline"
                              >
                                <span className="shrink-0">{job.task.externalId}</span>
                                <span className="truncate">Открыть связанную задачу</span>
                              </Link>
                            ) : job.inboxItem ? (
                              <Link
                                href={`/admin/operations/inbox?selected=${encodeURIComponent(job.inboxItem.id)}`}
                                className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline"
                              >
                                <Inbox className="h-3.5 w-3.5" aria-hidden="true" />
                                Открыть Входящие
                              </Link>
                            ) : null}
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedJob(job);
                              setRetryError(null);
                            }}
                            className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 text-sm font-semibold text-blue-700 hover:border-blue-300 hover:bg-blue-100 sm:w-auto"
                          >
                            <RotateCcw className="h-4 w-4" aria-hidden="true" />
                            Повторить
                          </button>
                        </article>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center">
                    <ShieldCheck className="h-9 w-9 text-emerald-500" aria-hidden="true" />
                    <h3 className="mt-3 text-sm font-semibold text-slate-800">
                      Очередь не требует вмешательства
                    </h3>
                    <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">
                      Нет dead-letter или waiting-human задач.
                    </p>
                  </div>
                )}
              </section>

              <aside className="space-y-6">
                <section aria-labelledby="ops-system-inbox-title">
                  <h2
                    id="ops-system-inbox-title"
                    className="text-base font-semibold text-slate-950"
                  >
                    Ошибки Входящих
                  </h2>
                  <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <dl className="grid grid-cols-3 gap-2 text-center">
                      <Metric label="Всего" value={health.inbox.failed} />
                      <Metric label="Не разобраны" value={health.inbox.failedPendingReview} />
                      <Metric label="За 24 часа" value={health.inbox.failedLast24Hours} />
                    </dl>
                    <Link
                      href="/admin/operations/inbox"
                      className="mt-4 flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 text-sm font-semibold text-slate-700 hover:border-blue-300 hover:text-blue-700"
                    >
                      <Inbox className="h-4 w-4" aria-hidden="true" />
                      Открыть Входящие
                    </Link>
                  </div>
                </section>

                <section aria-labelledby="ops-system-usage-title">
                  <h2
                    id="ops-system-usage-title"
                    className="text-base font-semibold text-slate-950"
                  >
                    Лимиты и хранение
                  </h2>
                  <div className="mt-3 space-y-3">
                    <div
                      className={cn(
                        "rounded-xl border bg-white p-4 shadow-sm",
                        health.media.configured ? "border-emerald-200" : "border-amber-200"
                      )}
                      data-ops-media-store-status={health.media.provider}
                    >
                      <div className="flex items-start gap-3">
                        <HardDrive
                          className={cn(
                            "mt-0.5 h-5 w-5 shrink-0",
                            health.media.configured ? "text-emerald-600" : "text-amber-600"
                          )}
                          aria-hidden="true"
                        />
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            Вложения: {mediaStoreLabel(health.media.provider)}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            {health.media.provider === "vercel_blob"
                              ? "Приватное хранилище готово для Preview и production."
                              : health.media.provider === "local"
                                ? "Голосовые и изображения сохраняются только в локальном Lab."
                                : health.media.provider === "invalid"
                                  ? "Локальное хранилище запрещено в production. Настройте private Blob."
                                  : "Добавьте OPS_BLOB_STORE_ID с Vercel OIDC или отдельный Ops Blob token."}
                          </p>
                        </div>
                      </div>
                    </div>
                    {health.usage.length ? (
                      health.usage.map((bucket) => <UsageCard key={bucket.id} bucket={bucket} />)
                    ) : (
                      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500 shadow-sm">
                        Использование ещё не зафиксировано.
                      </div>
                    )}
                  </div>
                </section>
              </aside>
            </div>
          </>
        ) : null}
      </main>

      {selectedJob ? (
        <div
          className="fixed inset-0 z-[90] flex items-end bg-slate-950/50 backdrop-blur-[2px] sm:items-center sm:justify-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ops-system-retry-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !retrying) {
              setSelectedJob(null);
            }
          }}
        >
          <div className="w-full rounded-t-2xl bg-white p-5 shadow-2xl sm:max-w-md sm:rounded-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="ops-system-retry-title" className="text-lg font-bold text-slate-950">
                  Повторить системную задачу?
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Будет использована та же durable job и тот же idempotency key. Новые сущности не
                  создаются.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedJob(null)}
                disabled={retrying}
                aria-label="Закрыть"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-4 rounded-lg bg-slate-50 p-3">
              <p className="text-sm font-semibold text-slate-800">
                {JOB_TYPE_LABELS[selectedJob.type] ?? "Внутренняя задача"}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Этап: {STAGE_LABELS[selectedJob.stage] ?? "Внутренний этап"}
              </p>
              <p className="mt-2 text-xs leading-5 text-slate-600">
                Счётчик попыток начнётся заново, но автоматический цикл останется ограничен максимум
                четырьмя попытками.
              </p>
            </div>

            {retryError ? (
              <div
                role="alert"
                className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                {retryError}
              </div>
            ) : null}

            <div className="mt-5 flex justify-end gap-2 pb-[env(safe-area-inset-bottom)]">
              <button
                type="button"
                onClick={() => setSelectedJob(null)}
                disabled={retrying}
                className="h-10 rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 disabled:opacity-50"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={() => void retryJob()}
                disabled={retrying}
                className="flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {retrying ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                )}
                Поставить в очередь
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </OpsSurface>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  hint: string;
  icon: typeof Activity;
  tone: "blue" | "emerald" | "amber" | "red";
}) {
  const tones = {
    blue: "bg-blue-50 text-blue-700",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-800",
    red: "bg-red-50 text-red-700",
  };
  return (
    <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-slate-950">{value}</p>
        </div>
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
            tones[tone]
          )}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-2 truncate text-[11px] text-slate-400">{hint}</p>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0 rounded-lg bg-slate-50 px-2 py-3">
      <dt className="truncate text-[10px] font-medium uppercase tracking-wide text-slate-400">
        {label}
      </dt>
      <dd className="mt-1 text-xl font-bold tabular-nums text-slate-950">{value}</dd>
    </div>
  );
}

function UsageCard({ bucket }: { bucket: UsageBucket }) {
  const limit = usageLimit(bucket);
  const current = usageCurrent(bucket);
  const percentage = limit > 0 ? Math.min(100, Math.max(0, (current / limit) * 100)) : 0;
  const Icon = bucket.feature === "telegram_manager" ? Bot : HardDrive;
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-slate-800">
                {usageLabel(bucket.feature)}
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                {usageValue(bucket)}
                {limit > 0
                  ? ` из ${
                      bucket.feature === "telegram_manager"
                        ? formatUsdMicros(limit)
                        : formatBytes(limit)
                    }`
                  : ""}
              </p>
            </div>
            {bucket.hardStopReached ? (
              <span className="rounded-full bg-red-50 px-2 py-1 text-[10px] font-semibold text-red-700">
                Стоп
              </span>
            ) : bucket.warningReached ? (
              <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-800">
                Внимание
              </span>
            ) : null}
          </div>
          <div
            className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"
            role="progressbar"
            aria-label={usageLabel(bucket.feature)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(percentage)}
          >
            <div
              className={cn(
                "h-full rounded-full",
                percentage >= 100 ? "bg-red-500" : percentage >= 75 ? "bg-amber-500" : "bg-blue-600"
              )}
              style={{ width: `${percentage}%` }}
            />
          </div>
          {bucket.feature === "telegram_manager" ? (
            <p className="mt-2 text-[11px] text-slate-400">
              {numeric(bucket.inputTokens).toLocaleString("ru-RU")} входных ·{" "}
              {numeric(bucket.outputTokens).toLocaleString("ru-RU")} выходных токенов ·{" "}
              {bucket.audioSeconds} сек аудио
            </p>
          ) : (
            <p className="mt-2 flex items-center gap-1 text-[11px] text-slate-400">
              <Database className="h-3 w-3" aria-hidden="true" />
              Счётчик PostgreSQL, без публичных ссылок на файлы
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
