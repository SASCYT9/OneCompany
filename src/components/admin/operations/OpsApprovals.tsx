"use client";

import { useEffect, useMemo, useState } from "react";

import Link from "next/link";
import {
  Check,
  ChevronRight,
  Loader2,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";

import { OpsPageHeader } from "./OpsPageHeader";
import { OpsSurface } from "./OpsSurface";
import { opsGet, opsMutation } from "./opsApi";
import type { OpsApproval } from "./types";

type ApprovalFilter = "PENDING" | "ALL" | "APPROVED" | "REJECTED" | "EXPIRED";
type Decision = "approve" | "reject";

const FILTER_LABELS: Record<ApprovalFilter, string> = {
  PENDING: "Ожидают",
  ALL: "Все",
  APPROVED: "Согласованы",
  REJECTED: "Отклонены",
  EXPIRED: "Истёк срок",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Ожидает решения",
  APPROVED: "Согласовано",
  REJECTED: "Отклонено",
  EXPIRED: "Срок истёк",
  CANCELLED: "Отменено",
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function payloadPreview(value: unknown) {
  const text = JSON.stringify(value, null, 2) ?? "null";
  return text.length > 5_000 ? `${text.slice(0, 5_000)}\n…` : text;
}

export function OpsApprovals({
  permissions,
  initialTaskId,
}: {
  permissions: readonly string[];
  initialTaskId?: string;
}) {
  const [filter, setFilter] = useState<ApprovalFilter>("PENDING");
  const [approvals, setApprovals] = useState<OpsApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<OpsApproval | null>(null);
  const [decision, setDecision] = useState<Decision>("approve");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError(null);
    void opsGet<{ approvals: OpsApproval[] }>(
      `/api/admin/operations/approvals?status=${filter}&take=100`,
      controller.signal
    )
      .then((response) => setApprovals(response.approvals))
      .catch((cause) => {
        if (controller.signal.aborted) return;
        setLoadError(cause instanceof Error ? cause.message : "Не удалось загрузить согласования.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [filter, reloadNonce]);

  const visibleApprovals = useMemo(
    () =>
      initialTaskId
        ? approvals.filter((approval) => approval.task.id === initialTaskId)
        : approvals,
    [approvals, initialTaskId]
  );

  function openDecision(approval: OpsApproval, nextDecision: Decision) {
    setSelected(approval);
    setDecision(nextDecision);
    setNote("");
    setDecisionError(null);
  }

  function closeDecision() {
    if (saving) return;
    setSelected(null);
    setNote("");
    setDecisionError(null);
  }

  async function saveDecision() {
    const normalizedNote = note.trim();
    if (!selected || saving || !normalizedNote) {
      setDecisionError("Добавьте обязательный комментарий к решению.");
      return;
    }
    setSaving(true);
    setDecisionError(null);
    try {
      const response = await opsMutation<{
        approval: Pick<
          OpsApproval,
          "id" | "status" | "decisionNote" | "approvedAt" | "rejectedAt" | "updatedAt"
        >;
        taskVersion: number;
        effectExecuted: false;
      }>({
        path: `/api/admin/operations/approvals/${selected.id}/decide`,
        body: { decision, note: normalizedNote },
        version: selected.task.version,
        scope: `approval-decision:${selected.id}`,
      });
      setApprovals((current) => {
        const updated = current.map((approval) => {
          const task =
            approval.task.id === selected.task.id
              ? { ...approval.task, version: response.taskVersion }
              : approval.task;
          return approval.id === selected.id
            ? { ...approval, ...response.approval, task }
            : { ...approval, task };
        });
        return filter === "PENDING"
          ? updated.filter((approval) => approval.id !== selected.id)
          : updated;
      });
      setSelected(null);
      setNote("");
      setDecisionError(null);
    } catch (cause) {
      setDecisionError(cause instanceof Error ? cause.message : "Не удалось сохранить решение.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <OpsSurface permissions={permissions}>
      <OpsPageHeader
        title="Согласования"
        description="Решения по неизменяемым запросам. Согласование фиксируется в истории, но само действие не выполняется автоматически."
        actions={
          <button
            type="button"
            onClick={() => setReloadNonce((value) => value + 1)}
            disabled={loading}
            className="flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:border-blue-300 hover:text-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} aria-hidden="true" />
            Обновить
          </button>
        }
      />

      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex gap-2 overflow-x-auto pb-2" aria-label="Фильтр согласований">
          {(Object.keys(FILTER_LABELS) as ApprovalFilter[]).map((item) => (
            <button
              type="button"
              key={item}
              onClick={() => setFilter(item)}
              aria-pressed={filter === item}
              className={cn(
                "h-9 shrink-0 rounded-full border px-3 text-xs font-semibold transition",
                filter === item
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-slate-300 bg-white text-slate-600 hover:border-blue-300"
              )}
            >
              {FILTER_LABELS[item]}
            </button>
          ))}
        </div>

        {initialTaskId ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
            <span>Показаны согласования выбранной задачи.</span>
            <Link href="/admin/operations/approvals" className="font-semibold underline">
              Показать все
            </Link>
          </div>
        ) : null}

        {loadError ? (
          <div
            role="alert"
            className="mt-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <div className="flex-1">
              <p className="font-semibold">Согласования не загрузились</p>
              <p className="mt-1">{loadError}</p>
            </div>
          </div>
        ) : loading ? (
          <div className="mt-8 flex min-h-56 items-center justify-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            Загрузка согласований…
          </div>
        ) : visibleApprovals.length ? (
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {visibleApprovals.map((approval) => (
              <article
                key={approval.id}
                className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {approval.task.externalId}
                    </p>
                    <Link
                      href={`/admin/operations/tasks/${approval.task.id}`}
                      className="mt-1 flex min-w-0 items-center gap-1 text-base font-semibold text-slate-950 hover:text-blue-700"
                    >
                      <span className="truncate">{approval.task.title}</span>
                      <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                    </Link>
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                      approval.status === "PENDING" && "bg-amber-50 text-amber-800",
                      approval.status === "APPROVED" && "bg-emerald-50 text-emerald-700",
                      approval.status === "REJECTED" && "bg-red-50 text-red-700",
                      !["PENDING", "APPROVED", "REJECTED"].includes(approval.status) &&
                        "bg-slate-100 text-slate-600"
                    )}
                  >
                    {STATUS_LABELS[approval.status] ?? approval.status}
                  </span>
                </div>

                <div className="mt-4 rounded-lg bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Запрошенное действие
                  </p>
                  <p className="mt-1 break-words text-sm font-medium text-slate-800">
                    {approval.action}
                  </p>
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs font-semibold text-blue-700">
                      Проверить неизменяемые данные
                    </summary>
                    <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-950 p-3 text-xs leading-5 text-slate-100">
                      {payloadPreview(approval.payload)}
                    </pre>
                    <p className="mt-2 break-all text-[10px] text-slate-400">
                      SHA-256: {approval.payloadHash}
                    </p>
                  </details>
                </div>

                <dl className="mt-4 grid gap-3 text-xs text-slate-500 sm:grid-cols-2">
                  <div>
                    <dt className="font-medium text-slate-400">Запросил</dt>
                    <dd className="mt-1 text-slate-700">
                      {approval.requester.name || approval.requester.email}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-400">Решить до</dt>
                    <dd className="mt-1 text-slate-700">{formatDate(approval.expiresAt)}</dd>
                  </div>
                </dl>

                {approval.decisionNote ? (
                  <div className="mt-4 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600">
                    <p className="text-xs font-semibold text-slate-400">Комментарий к решению</p>
                    <p className="mt-1 whitespace-pre-wrap">{approval.decisionNote}</p>
                  </div>
                ) : null}

                {approval.status === "PENDING" ? (
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => openDecision(approval, "reject")}
                      className="flex h-11 items-center justify-center gap-2 rounded-lg border border-red-200 text-sm font-semibold text-red-700 hover:bg-red-50"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                      Отклонить
                    </button>
                    <button
                      type="button"
                      onClick={() => openDecision(approval, "approve")}
                      className="flex h-11 items-center justify-center gap-2 rounded-lg bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-700"
                    >
                      <Check className="h-4 w-4" aria-hidden="true" />
                      Согласовать
                    </button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-8 flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-6 text-center">
            <ShieldCheck className="h-10 w-10 text-slate-300" aria-hidden="true" />
            <h2 className="mt-3 text-base font-semibold text-slate-800">Согласований нет</h2>
            <p className="mt-1 max-w-sm text-sm leading-6 text-slate-500">
              Для выбранного фильтра нет запросов, требующих решения.
            </p>
          </div>
        )}
      </div>

      {selected ? (
        <div
          className="fixed inset-0 z-[90] flex items-end bg-slate-950/50 p-0 backdrop-blur-[2px] sm:items-center sm:justify-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ops-approval-decision-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDecision();
          }}
        >
          <div className="w-full rounded-t-2xl bg-white p-5 shadow-2xl sm:max-w-lg sm:rounded-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="ops-approval-decision-title" className="text-lg font-bold text-slate-950">
                  {decision === "approve" ? "Согласовать запрос" : "Отклонить запрос"}
                </h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Решение попадёт в неизменяемую историю. Запрошенное действие не выполнится
                  автоматически.
                </p>
              </div>
              <button
                type="button"
                onClick={closeDecision}
                disabled={saving}
                aria-label="Закрыть"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm">
              <p className="font-semibold text-slate-800">{selected.action}</p>
              <p className="mt-1 text-xs text-slate-500">{selected.task.title}</p>
            </div>

            <label className="mt-4 block">
              <span className="text-sm font-medium text-slate-700">
                Комментарий к решению <span className="text-red-600">*</span>
              </span>
              <textarea
                value={note}
                onChange={(event) => {
                  setNote(event.target.value);
                  setDecisionError(null);
                }}
                rows={4}
                maxLength={2_000}
                placeholder={
                  decision === "approve"
                    ? "Почему запрос можно согласовать?"
                    : "Что нужно исправить перед повторным запросом?"
                }
                className="mt-2 w-full resize-y rounded-lg border border-slate-300 p-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
              <span className="mt-1 block text-right text-[11px] text-slate-400">
                {note.length}/2000
              </span>
            </label>

            {decisionError ? (
              <div
                role="alert"
                className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                {decisionError}
              </div>
            ) : null}

            <div className="mt-5 flex justify-end gap-2 pb-[env(safe-area-inset-bottom)]">
              <button
                type="button"
                onClick={closeDecision}
                disabled={saving}
                className="h-10 rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 disabled:opacity-50"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={() => void saveDecision()}
                disabled={saving || !note.trim()}
                className={cn(
                  "flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-50",
                  decision === "approve"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-red-600 hover:bg-red-700"
                )}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : decision === "approve" ? (
                  <Check className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <X className="h-4 w-4" aria-hidden="true" />
                )}
                {decision === "approve" ? "Согласовать" : "Отклонить"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </OpsSurface>
  );
}
