"use client";

import { useMemo, useState } from "react";

import Link from "next/link";
import {
  Bot,
  CheckCircle2,
  Clock3,
  FileSearch,
  Loader2,
  PackageSearch,
  Play,
  Search,
  ShieldCheck,
  TriangleAlert,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";

import { opsMutation } from "./opsApi";
import type { OpsAutomationRun, OpsTask, OpsTaskApproval } from "./types";

type AutomationType = "research_draft" | "document_summary" | "catalog_check";

const AUTOMATION_LABELS: Record<AutomationType, string> = {
  research_draft: "Черновик исследования",
  document_summary: "Краткое содержание документа",
  catalog_check: "Проверка товара в каталоге",
};

const AUTOMATION_ICONS = {
  research_draft: Search,
  document_summary: FileSearch,
  catalog_check: PackageSearch,
} satisfies Record<AutomationType, typeof Search>;

const RUN_STATUS_LABELS: Record<string, string> = {
  QUEUED: "В очереди",
  RUNNING: "Выполняется",
  WAITING_HUMAN: "Нужен сотрудник",
  SUCCEEDED: "Готово",
  FAILED: "Ошибка",
  CANCELLED: "Отменено",
};

const APPROVAL_STATUS_LABELS: Record<string, string> = {
  PENDING: "Ожидает решения",
  APPROVED: "Согласовано",
  REJECTED: "Отклонено",
  EXPIRED: "Срок истёк",
  CANCELLED: "Отменено",
};

function formatDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function safeResultPreview(value: unknown) {
  if (value === null || value === undefined) return null;
  const serialized = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  if (!serialized) return null;
  return serialized.length > 3_000 ? `${serialized.slice(0, 3_000)}\n…` : serialized;
}

function RunStatusIcon({ status }: { status: string }) {
  if (status === "SUCCEEDED") {
    return <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />;
  }
  if (status === "FAILED") {
    return <TriangleAlert className="h-4 w-4 text-red-600" aria-hidden="true" />;
  }
  if (status === "RUNNING") {
    return <Loader2 className="h-4 w-4 animate-spin text-blue-600" aria-hidden="true" />;
  }
  return <Clock3 className="h-4 w-4 text-slate-500" aria-hidden="true" />;
}

function ApprovalList({
  approvals,
  canDecideApprovals,
  taskId,
}: {
  approvals: OpsTaskApproval[];
  canDecideApprovals: boolean;
  taskId: string;
}) {
  if (!approvals.length) return null;
  return (
    <section className="mt-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck className="h-5 w-5 text-violet-600" aria-hidden="true" />
          Согласования
        </h3>
        {canDecideApprovals && approvals.some((item) => item.status === "PENDING") ? (
          <Link
            href={`/admin/operations/approvals?taskId=${encodeURIComponent(taskId)}`}
            className="flex h-9 items-center rounded-lg border border-violet-200 px-3 text-xs font-semibold text-violet-700 hover:bg-violet-50"
          >
            Рассмотреть
          </Link>
        ) : null}
      </div>
      <ol className="mt-3 space-y-2">
        {approvals.map((approval) => (
          <li key={approval.id} className="rounded-lg border border-slate-200 px-3 py-2.5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="break-words text-sm font-medium text-slate-800">{approval.action}</p>
                {approval.decisionNote ? (
                  <p className="mt-1 text-xs leading-5 text-slate-500">{approval.decisionNote}</p>
                ) : null}
              </div>
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                  approval.status === "APPROVED" && "bg-emerald-50 text-emerald-700",
                  approval.status === "REJECTED" && "bg-red-50 text-red-700",
                  approval.status === "PENDING" && "bg-amber-50 text-amber-800",
                  !["APPROVED", "REJECTED", "PENDING"].includes(approval.status) &&
                    "bg-slate-100 text-slate-600"
                )}
              >
                {APPROVAL_STATUS_LABELS[approval.status] ?? approval.status}
              </span>
            </div>
            {approval.expiresAt ? (
              <p className="mt-2 text-[11px] text-slate-400">
                Срок решения: {formatDate(approval.expiresAt)}
              </p>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

export function OpsTaskAutomation({
  task,
  canRunAutomation,
  automationsEnabled,
  canDecideApprovals,
  demoMode = false,
  onTaskChange,
}: {
  task: OpsTask;
  canRunAutomation: boolean;
  automationsEnabled: boolean;
  canDecideApprovals: boolean;
  demoMode?: boolean;
  onTaskChange: (task: OpsTask) => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [automationType, setAutomationType] = useState<AutomationType>("research_draft");
  const [query, setQuery] = useState("");
  const [attachmentId, setAttachmentId] = useState("");
  const [sku, setSku] = useState("");
  const [productId, setProductId] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runs = task.automationRuns ?? [];
  const approvals = task.approvals ?? [];
  const activeRun = runs.some((run) => ["QUEUED", "RUNNING"].includes(run.status));
  const eligibleDocuments = useMemo(
    () =>
      (task.attachments ?? [])
        .map(({ attachment }) => attachment)
        .filter(
          (attachment) =>
            attachment.state === "READY" &&
            ["application/pdf", "text/plain"].includes(attachment.mimeType.toLowerCase())
        ),
    [task.attachments]
  );
  const taskCanStart =
    canRunAutomation &&
    automationsEnabled &&
    !activeRun &&
    !["DONE", "CANCELLED", "AGENT_RUNNING"].includes(task.status);

  function resetDialog() {
    setDialogOpen(false);
    setError(null);
    setQuery("");
    setAttachmentId("");
    setSku("");
    setProductId("");
  }

  function buildInput(): Record<string, string> {
    if (automationType === "research_draft") {
      const value = query.trim();
      if (!value) throw new Error("Укажите вопрос для исследования.");
      return { query: value };
    }
    if (automationType === "document_summary") {
      if (!attachmentId) throw new Error("Выберите PDF или текстовый файл задачи.");
      return { attachmentId };
    }
    const normalizedSku = sku.trim();
    const normalizedProductId = productId.trim();
    if (!normalizedSku && !normalizedProductId) {
      throw new Error("Укажите SKU или внутренний ID товара.");
    }
    const input: Record<string, string> = {};
    if (normalizedSku) input.sku = normalizedSku;
    if (normalizedProductId) input.productId = normalizedProductId;
    return input;
  }

  async function startAutomation() {
    if (!taskCanStart || pending) return;
    setError(null);
    let input: Record<string, string>;
    try {
      input = buildInput();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Проверьте поля запуска.");
      return;
    }

    setPending(true);
    try {
      let run: OpsAutomationRun;
      let taskVersion: number;
      if (demoMode) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        run = {
          id: `demo-run-${Date.now()}`,
          automationType,
          status: "QUEUED",
          stage: "EXECUTE_AUTOMATIONS",
          inputSnapshot: { type: automationType, input },
          createdAt: new Date().toISOString(),
        };
        taskVersion = task.version + 1;
      } else {
        const response = await opsMutation<{
          run: OpsAutomationRun;
          taskVersion: number;
        }>({
          path: `/api/admin/operations/tasks/${task.id}/automations`,
          body: { type: automationType, input },
          version: task.version,
          scope: `task-automation:${task.id}:${automationType}`,
        });
        run = response.run;
        taskVersion = response.taskVersion;
      }
      onTaskChange({
        ...task,
        version: taskVersion,
        automationRuns: [run, ...runs.filter((item) => item.id !== run.id)],
      });
      resetDialog();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось запустить помощника.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      {runs.length || taskCanStart ? (
        <section className="mt-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Bot className="h-5 w-5 text-blue-600" aria-hidden="true" />
                Помощник
              </h3>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Только внутренние черновики и проверки. Покупки, оплаты, checkout и внешние
                сообщения недоступны.
              </p>
            </div>
            {taskCanStart ? (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setDialogOpen(true);
                }}
                className="flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700"
              >
                <Play className="h-4 w-4" aria-hidden="true" />
                Запустить помощника
              </button>
            ) : null}
          </div>

          {runs.length ? (
            <ol className="mt-4 space-y-2">
              {runs.map((run) => {
                const result = safeResultPreview(run.result);
                return (
                  <li key={run.id} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex min-w-0 items-start gap-2">
                        <RunStatusIcon status={run.status} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800">
                            {AUTOMATION_LABELS[run.automationType as AutomationType] ??
                              run.automationType}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {RUN_STATUS_LABELS[run.status] ?? run.status}
                            {run.stage ? ` · ${run.stage}` : ""}
                            {run.createdAt ? ` · ${formatDate(run.createdAt)}` : ""}
                          </p>
                        </div>
                      </div>
                    </div>
                    {run.errorMessage ? (
                      <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">
                        {run.errorMessage}
                      </p>
                    ) : null}
                    {result ? (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs font-semibold text-blue-700">
                          Результат
                        </summary>
                        <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-950 p-3 text-xs leading-5 text-slate-100">
                          {result}
                        </pre>
                      </details>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="mt-4 text-sm text-slate-500">
              Помощник ещё не запускался для этой задачи.
            </p>
          )}
        </section>
      ) : null}

      <ApprovalList
        approvals={approvals}
        canDecideApprovals={canDecideApprovals}
        taskId={task.id}
      />

      {dialogOpen ? (
        <div
          className="fixed inset-0 z-[90] flex items-end bg-slate-950/50 p-0 backdrop-blur-[2px] sm:items-center sm:justify-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ops-automation-dialog-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !pending) resetDialog();
          }}
        >
          <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:max-w-xl sm:rounded-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="ops-automation-dialog-title" className="text-lg font-bold text-slate-950">
                  Запустить помощника
                </h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Выберите одну безопасную операцию. Результат останется внутренним черновиком.
                </p>
              </div>
              <button
                type="button"
                onClick={resetDialog}
                disabled={pending}
                aria-label="Закрыть"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <fieldset className="mt-5">
              <legend className="text-sm font-semibold text-slate-800">Что сделать</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {(Object.keys(AUTOMATION_LABELS) as AutomationType[]).map((type) => {
                  const Icon = AUTOMATION_ICONS[type];
                  return (
                    <label
                      key={type}
                      className={cn(
                        "cursor-pointer rounded-xl border p-3 text-left transition",
                        automationType === type
                          ? "border-blue-500 bg-blue-50 text-blue-900"
                          : "border-slate-200 hover:border-blue-300"
                      )}
                    >
                      <input
                        type="radio"
                        name="automation-type"
                        value={type}
                        checked={automationType === type}
                        onChange={() => {
                          setAutomationType(type);
                          setError(null);
                        }}
                        className="sr-only"
                      />
                      <Icon className="h-5 w-5" aria-hidden="true" />
                      <span className="mt-2 block text-xs font-semibold leading-4">
                        {AUTOMATION_LABELS[type]}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div className="mt-5">
              {automationType === "research_draft" ? (
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">
                    Вопрос для исследования
                  </span>
                  <textarea
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    rows={4}
                    maxLength={2_000}
                    placeholder="Например: проверить совместимость детали по открытым источникам"
                    className="mt-2 w-full resize-y rounded-lg border border-slate-300 p-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </label>
              ) : automationType === "document_summary" ? (
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">
                    Документ из этой задачи
                  </span>
                  <select
                    value={attachmentId}
                    onChange={(event) => setAttachmentId(event.target.value)}
                    className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-500"
                  >
                    <option value="">Выберите PDF или текстовый файл</option>
                    {eligibleDocuments.map((attachment) => (
                      <option key={attachment.id} value={attachment.id}>
                        {attachment.fileName || attachment.id}
                      </option>
                    ))}
                  </select>
                  {!eligibleDocuments.length ? (
                    <span className="mt-2 block text-xs text-amber-700">
                      В задаче нет готового PDF или текстового файла.
                    </span>
                  ) : null}
                </label>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">SKU</span>
                    <input
                      value={sku}
                      onChange={(event) => setSku(event.target.value)}
                      maxLength={200}
                      placeholder="Например, MX-123"
                      className="mt-2 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-blue-500"
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">Внутренний ID товара</span>
                    <input
                      value={productId}
                      onChange={(event) => setProductId(event.target.value)}
                      maxLength={100}
                      placeholder="Необязательно, если указан SKU"
                      className="mt-2 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-blue-500"
                    />
                  </label>
                </div>
              )}
            </div>

            {error ? (
              <div
                role="alert"
                className="mt-4 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                {error}
              </div>
            ) : null}

            <div className="mt-5 flex justify-end gap-2 pb-[env(safe-area-inset-bottom)]">
              <button
                type="button"
                onClick={resetDialog}
                disabled={pending}
                className="h-10 rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 disabled:opacity-50"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={() => void startAutomation()}
                disabled={pending}
                className="flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Play className="h-4 w-4" aria-hidden="true" />
                )}
                Запустить
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
