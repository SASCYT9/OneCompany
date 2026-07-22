"use client";

import { useEffect, useMemo, useState } from "react";

import {
  Check,
  ArrowLeft,
  ChevronDown,
  CircleAlert,
  FileAudio,
  Inbox,
  Loader2,
  MessageSquareText,
  Pencil,
  Search,
  Send,
  ShieldAlert,
  Save,
  SlidersHorizontal,
  X,
} from "lucide-react";

import { opsRu } from "@/lib/operations/i18n";
import { cn } from "@/lib/utils";

import { OpsPageHeader } from "./OpsPageHeader";
import { OpsSurface } from "./OpsSurface";
import { opsGet, opsMutation } from "./opsApi";
import type { OpsInboxItem, OpsPerson, OpsPriority, OpsProject } from "./types";

function proposalAssigneeLabel(assigneeId: unknown, members: readonly OpsPerson[]) {
  const id = String(assigneeId ?? "");
  if (!id) return "Исполнитель не выбран";
  const member = members.find((item) => item.id === id);
  return member?.name || member?.email || "Исполнитель выбран";
}

export function OpsInbox({
  initialItems,
  demoMode = false,
  permissions,
  canReview = false,
  canApply = false,
  canAssign = false,
  initialSelectedId,
}: {
  initialItems?: OpsInboxItem[];
  demoMode?: boolean;
  permissions: readonly string[];
  canReview?: boolean;
  canApply?: boolean;
  canAssign?: boolean;
  initialSelectedId?: string;
}) {
  const [items, setItems] = useState(initialItems ?? []);
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId ?? null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(!initialItems);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [editingProposalId, setEditingProposalId] = useState<string | null>(null);
  const [proposalTitle, setProposalTitle] = useState("");
  const [proposalDescription, setProposalDescription] = useState("");
  const [proposalPriority, setProposalPriority] = useState<OpsPriority>("NORMAL");
  const [proposalDueAt, setProposalDueAt] = useState("");
  const [proposalNextAction, setProposalNextAction] = useState("");
  const [proposalDefinitionOfDone, setProposalDefinitionOfDone] = useState("");
  const [proposalProjectId, setProposalProjectId] = useState("");
  const [proposalAssigneeId, setProposalAssigneeId] = useState("");
  const [projects, setProjects] = useState<OpsProject[]>([]);
  const [members, setMembers] = useState<OpsPerson[]>([]);
  const [membersLoaded, setMembersLoaded] = useState(false);
  const [referenceLoading, setReferenceLoading] = useState(false);

  useEffect(() => {
    if (initialItems || demoMode) return;
    const controller = new AbortController();
    void opsGet<{ items: OpsInboxItem[] }>(
      "/api/admin/operations/inbox?limit=100",
      controller.signal
    )
      .then((response) => {
        setItems(response.items);
      })
      .catch((cause) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : "Не удалось загрузить входящие");
        }
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [demoMode, initialItems]);

  useEffect(() => {
    if (!canAssign || demoMode || membersLoaded) return;
    setMembersLoaded(true);
    void opsGet<{ members: OpsPerson[] }>("/api/admin/operations/members")
      .then((response) => setMembers(response.members))
      .catch((cause) => {
        setError(cause instanceof Error ? cause.message : "Не удалось загрузить исполнителей");
      });
  }, [canAssign, demoMode, membersLoaded]);

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    return items.filter(
      (item) =>
        item.reviewStatus === "PENDING" &&
        (!value ||
          [item.summary, item.originalMessage, item.transcription].some((field) =>
            String(field ?? "")
              .toLowerCase()
              .includes(value)
          ))
    );
  }, [items, query]);

  const selected = items.find((item) => item.id === selectedId) ?? null;
  const selectedAudioAttachments =
    selected?.attachments?.filter((item) => item.mimeType.startsWith("audio/")) ?? [];

  async function review(action: "apply" | "ignore") {
    if (!selected || pendingAction) return;
    if ((action === "apply" && !canApply) || (action === "ignore" && !canReview)) {
      return;
    }
    setPendingAction(action);
    setError(null);
    try {
      if (demoMode) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      } else {
        await opsMutation({
          path: `/api/admin/operations/inbox/${selected.id}/${action}`,
          body:
            action === "apply"
              ? { proposalIds: selected.proposals?.map((proposal) => proposal.id) ?? [] }
              : {},
          scope: `inbox-${action}:${selected.id}`,
        });
      }
      setItems((current) =>
        current.map((item) =>
          item.id === selected.id
            ? { ...item, reviewStatus: action === "apply" ? "APPLIED" : "IGNORED" }
            : item
        )
      );
      const next = filtered.find((item) => item.id !== selected.id);
      setSelectedId(next?.id ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Действие не выполнено");
    } finally {
      setPendingAction(null);
    }
  }

  async function openProposalEditor(proposalId?: string) {
    if (!selected || !canApply) return;
    const proposal =
      selected.proposals?.find((item) => item.id === proposalId) ??
      selected.proposals?.find((item) => item.status === "PENDING");
    if (!proposal) {
      const source = String(
        selected.transcription || selected.originalMessage || selected.summary || ""
      ).trim();
      setEditingProposalId("new");
      setProposalTitle(source.split(/\r?\n/)[0]?.slice(0, 160) || "Новая задача");
      setProposalDescription(source);
      setProposalPriority("NORMAL");
      setProposalDueAt("");
      setProposalNextAction("");
      setProposalDefinitionOfDone("");
      setProposalProjectId("");
      setProposalAssigneeId("");
      setError(null);
    } else {
      const payload = proposal.payload;
      setEditingProposalId(proposal.id);
      setProposalTitle(String(payload.title ?? ""));
      setProposalDescription(String(payload.description ?? ""));
      setProposalPriority(
        ["LOW", "NORMAL", "HIGH", "URGENT"].includes(String(payload.priority))
          ? (String(payload.priority) as OpsPriority)
          : "NORMAL"
      );
      setProposalDueAt(
        payload.dueAt && !Number.isNaN(new Date(String(payload.dueAt)).getTime())
          ? new Date(String(payload.dueAt)).toISOString().slice(0, 16)
          : ""
      );
      setProposalNextAction(String(payload.nextAction ?? ""));
      setProposalDefinitionOfDone(String(payload.definitionOfDone ?? ""));
      setProposalProjectId(String(payload.projectId ?? ""));
      setProposalAssigneeId(String(payload.assigneeId ?? ""));
      setError(null);
    }

    if (demoMode || projects.length || referenceLoading) return;
    setReferenceLoading(true);
    try {
      const [projectResult, memberResult] = await Promise.all([
        opsGet<{ projects: OpsProject[] }>("/api/admin/operations/projects?limit=100"),
        canAssign
          ? opsGet<{ members: OpsPerson[] }>("/api/admin/operations/members")
          : Promise.resolve({ members: [] as OpsPerson[] }),
      ]);
      setProjects(projectResult.projects);
      setMembers(memberResult.members);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Не удалось загрузить проекты и исполнителей"
      );
    } finally {
      setReferenceLoading(false);
    }
  }

  async function saveProposal() {
    if (!selected || !editingProposalId || pendingAction || !proposalTitle.trim()) return;
    const creating = editingProposalId === "new";
    const existingProposal = selected.proposals?.find((item) => item.id === editingProposalId);
    if (!creating && !existingProposal) {
      setError("Предложение больше недоступно для редактирования.");
      return;
    }
    setPendingAction("proposal");
    setError(null);
    const patch = {
      title: proposalTitle.trim(),
      description: proposalDescription.trim() || null,
      priority: proposalPriority,
      dueAt: proposalDueAt ? new Date(proposalDueAt).toISOString() : null,
      nextAction: proposalNextAction.trim() || null,
      definitionOfDone: proposalDefinitionOfDone.trim() || null,
      projectId: proposalProjectId || null,
      ...(canAssign ? { assigneeId: proposalAssigneeId || null } : {}),
    };
    try {
      const proposal = demoMode
        ? {
            ...(existingProposal ?? {
              id: `manual-${Date.now()}`,
              kind: "TASK",
              status: "PENDING",
              payloadHash: "demo",
            }),
            payload: {
              ...(existingProposal?.payload ?? {}),
              ...patch,
            },
          }
        : (
            await opsMutation<{
              proposal: NonNullable<OpsInboxItem["proposals"]>[number];
            }>({
              path: creating
                ? `/api/admin/operations/inbox/${selected.id}/proposals`
                : `/api/admin/operations/inbox/${selected.id}/proposals/${editingProposalId}`,
              method: creating ? "POST" : "PATCH",
              body: patch,
              etag: creating ? undefined : existingProposal?.payloadHash,
              scope: creating
                ? `inbox-proposal-create:${selected.id}`
                : `inbox-proposal-edit:${editingProposalId}`,
            })
          ).proposal;
      setItems((current) =>
        current.map((item) =>
          item.id === selected.id
            ? {
                ...item,
                proposals: creating
                  ? [...(item.proposals ?? []), proposal]
                  : item.proposals?.map((entry) => (entry.id === proposal.id ? proposal : entry)),
              }
            : item
        )
      );
      setEditingProposalId(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Предложение не сохранено");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <OpsSurface inboxCount={filtered.length} permissions={permissions}>
      <OpsPageHeader title={opsRu.inbox.title} description={opsRu.inbox.subtitle} />
      <div className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6 lg:px-8">
        <label className="relative block max-w-xl">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск сообщений…"
            className="h-11 w-full rounded-lg border border-slate-300 pl-10 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </label>
      </div>

      {loading ? (
        <div className="flex min-h-[65vh] items-center justify-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          {opsRu.common.loading}
        </div>
      ) : (
        <div className="grid min-h-[650px] grid-cols-1 bg-white lg:grid-cols-[minmax(360px,38%)_minmax(0,1fr)]">
          <aside
            className={cn(
              "border-r border-slate-200 bg-slate-50 p-3 sm:p-5",
              selected && "hidden lg:block"
            )}
          >
            {filtered.length ? (
              <div className="space-y-2">
                {filtered.map((item) => {
                  return (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => {
                        setSelectedId(item.id);
                        setTranscriptOpen(false);
                      }}
                      className={cn(
                        "w-full rounded-xl border bg-white p-4 text-left shadow-sm transition hover:border-blue-200",
                        item.id === selected?.id
                          ? "border-blue-500 ring-1 ring-blue-500"
                          : "border-slate-200"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
                          {item.telegramUpdate?.updateType === "VOICE" ? (
                            <FileAudio className="h-4 w-4" />
                          ) : (
                            <MessageSquareText className="h-4 w-4" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-2 text-sm font-semibold leading-5 text-slate-900">
                            {item.summary || item.originalMessage}
                          </span>
                          <span className="mt-2 flex items-center justify-between gap-2">
                            <span className="text-xs font-medium text-slate-500">
                              {item.telegramUpdate?.updateType === "VOICE"
                                ? "Голосовое"
                                : item.telegramUpdate?.isUntrustedForward
                                  ? "Пересланное сообщение"
                                  : "Telegram"}
                            </span>
                            <span className="text-xs text-slate-400">
                              {new Intl.DateTimeFormat("ru-RU", {
                                hour: "2-digit",
                                minute: "2-digit",
                              }).format(new Date(item.createdAt))}
                            </span>
                          </span>
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex min-h-72 flex-col items-center justify-center px-5 text-center">
                <Inbox className="h-9 w-9 text-slate-300" />
                <p className="mt-3 text-sm font-medium text-slate-700">{opsRu.inbox.empty}</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">
                  Новые сообщения Telegram появятся здесь.
                </p>
              </div>
            )}
          </aside>

          <main className={cn("min-w-0 bg-white", !selected && "hidden lg:block")}>
            {selected ? (
              <div className="mx-auto max-w-4xl p-4 sm:p-6 lg:p-8">
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="mb-4 flex h-10 items-center gap-2 text-sm font-medium text-slate-600 lg:hidden"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Все входящие
                </button>
                <div className="flex items-start gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-sky-600">
                      <Send className="h-4 w-4" />
                      Telegram Manager
                    </div>
                    <h2 className="mt-2 text-xl font-bold leading-tight text-slate-950 sm:text-2xl">
                      {selected.summary || "Новое сообщение"}
                    </h2>
                    <p className="mt-2 text-xs text-slate-400">
                      {new Intl.DateTimeFormat("ru-RU", {
                        day: "numeric",
                        month: "long",
                        hour: "2-digit",
                        minute: "2-digit",
                      }).format(new Date(selected.createdAt))}
                    </p>
                  </div>
                </div>

                {selected.telegramUpdate?.isUntrustedForward ? (
                  <div className="mt-5 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                    Пересланный текст считается внешним источником. Проверьте его перед созданием.
                  </div>
                ) : null}

                <section className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    Оригинал
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-800">
                    {selected.originalMessage}
                  </p>
                </section>

                {selectedAudioAttachments.length ? (
                  <section className="mt-4 rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <FileAudio className="h-5 w-5 text-blue-600" />
                      Голосовые сообщения · {selectedAudioAttachments.length}
                    </div>
                    <div className="mt-3 space-y-3">
                      {selectedAudioAttachments.map((attachment, index) => (
                        <div key={attachment.id}>
                          <div className="mb-1 text-xs font-medium text-slate-500">
                            Голосовое {index + 1}
                          </div>
                          <audio
                            className="h-10 w-full"
                            controls
                            preload="none"
                            src={
                              demoMode || attachment.state !== "READY"
                                ? undefined
                                : `/api/admin/operations/inbox/${selected.id}/attachments/${attachment.id}/access`
                            }
                          >
                            Ваш браузер не поддерживает аудио.
                          </audio>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}

                {selected.transcription ? (
                  <section className="mt-4 rounded-xl border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setTranscriptOpen((open) => !open)}
                      aria-expanded={transcriptOpen}
                      className="flex w-full items-center justify-between px-4 py-4 text-left text-sm font-semibold"
                    >
                      Транскрипция
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 text-slate-500 transition-transform",
                          transcriptOpen && "rotate-180"
                        )}
                      />
                    </button>
                    {transcriptOpen ? (
                      <p className="border-t border-slate-100 px-4 py-4 text-sm leading-6 text-slate-600">
                        {selected.transcription}
                      </p>
                    ) : null}
                  </section>
                ) : null}

                <section className="mt-5">
                  <h3 className="text-sm font-bold text-slate-950">Что нужно сделать</h3>
                  <div className="mt-3 space-y-3">
                    {selected.proposals?.map((proposal, index) => (
                      <article
                        key={proposal.id}
                        className="rounded-xl border border-blue-200 bg-blue-50/40 p-4"
                      >
                        <div className="flex items-start gap-3">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                            {index + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <h4 className="font-semibold text-slate-900">
                              {String(proposal.payload.title || "Название не извлечено")}
                            </h4>
                            <p className="mt-1 text-sm text-slate-600">
                              {proposalAssigneeLabel(proposal.payload.assigneeId, members)}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                              {proposal.payload.priority ? (
                                <span className="rounded-full bg-white px-2 py-1">
                                  Приоритет: {String(proposal.payload.priority)}
                                </span>
                              ) : null}
                              {proposal.payload.dueAt ? (
                                <span className="rounded-full bg-white px-2 py-1">
                                  Срок:{" "}
                                  {new Intl.DateTimeFormat("ru-RU", {
                                    day: "numeric",
                                    month: "short",
                                  }).format(new Date(String(proposal.payload.dueAt)))}
                                </span>
                              ) : null}
                            </div>
                          </div>
                          {canApply && proposal.status === "PENDING" ? (
                            <button
                              type="button"
                              onClick={() => void openProposalEditor(proposal.id)}
                              aria-label="Исправить предложение"
                              className="rounded-lg p-2 text-slate-500 hover:bg-white hover:text-blue-600"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          ) : null}
                        </div>
                      </article>
                    ))}
                  </div>
                </section>

                {error ? (
                  <div className="mt-4 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                    <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                    {error}
                  </div>
                ) : null}

                {canReview || canApply ? (
                  <div className="mt-6 grid gap-2 sm:grid-cols-3">
                    {canApply ? (
                      <>
                        <button
                          type="button"
                          onClick={() => void review("apply")}
                          disabled={
                            Boolean(pendingAction) ||
                            !selected.proposals?.some((proposal) => proposal.status === "PENDING")
                          }
                          className="flex h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
                        >
                          {pendingAction === "apply" ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="h-4 w-4" />
                          )}
                          Создать задачу
                        </button>
                        <button
                          type="button"
                          onClick={() => void openProposalEditor()}
                          className="flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700"
                        >
                          <SlidersHorizontal className="h-4 w-4" />
                          {selected.proposals?.some((proposal) => proposal.status === "PENDING")
                            ? "Настроить"
                            : "Создать вручную"}
                        </button>
                      </>
                    ) : null}
                    {canReview ? (
                      <button
                        type="button"
                        onClick={() => void review("ignore")}
                        disabled={Boolean(pendingAction)}
                        className="flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-600 disabled:opacity-50"
                      >
                        {pendingAction === "ignore" ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <X className="h-4 w-4" />
                        )}
                        {opsRu.inbox.ignore}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
                <Inbox className="h-9 w-9 text-slate-300" />
                <h2 className="mt-3 font-semibold text-slate-800">Выберите сообщение</h2>
                <p className="mt-1 text-sm text-slate-500">Предложения появятся справа.</p>
              </div>
            )}
          </main>
        </div>
      )}

      {editingProposalId ? (
        <div
          className="fixed inset-0 z-[85] flex items-end bg-slate-950/45 p-0 backdrop-blur-[2px] sm:items-center sm:justify-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ops-proposal-edit-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !pendingAction) {
              setEditingProposalId(null);
            }
          }}
        >
          <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:max-w-2xl sm:rounded-2xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 id="ops-proposal-edit-title" className="text-lg font-bold text-slate-950">
                  Настроить задачу
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Проверьте текст и выберите исполнителя. Создание — отдельной кнопкой.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingProposalId(null)}
                disabled={Boolean(pendingAction)}
                aria-label="Закрыть"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {error ? (
              <div className="mt-4 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </div>
            ) : null}

            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Название</span>
                <input
                  value={proposalTitle}
                  onChange={(event) => setProposalTitle(event.target.value)}
                  className="mt-2 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Описание</span>
                <textarea
                  value={proposalDescription}
                  onChange={(event) => setProposalDescription(event.target.value)}
                  rows={3}
                  className="mt-2 w-full resize-y rounded-lg border border-slate-300 p-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Приоритет</span>
                  <select
                    value={proposalPriority}
                    onChange={(event) => setProposalPriority(event.target.value as OpsPriority)}
                    className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-500"
                  >
                    <option value="LOW">Низкий</option>
                    <option value="NORMAL">Обычный</option>
                    <option value="HIGH">Высокий</option>
                    <option value="URGENT">Срочный</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Срок</span>
                  <input
                    type="datetime-local"
                    value={proposalDueAt}
                    onChange={(event) => setProposalDueAt(event.target.value)}
                    className="mt-2 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-blue-500"
                  />
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Проект</span>
                  <select
                    value={proposalProjectId}
                    onChange={(event) => setProposalProjectId(event.target.value)}
                    disabled={referenceLoading}
                    className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-500 disabled:opacity-60"
                  >
                    <option value="">Без проекта</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.title}
                      </option>
                    ))}
                  </select>
                </label>
                {canAssign ? (
                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">Исполнитель</span>
                    <select
                      value={proposalAssigneeId}
                      onChange={(event) => setProposalAssigneeId(event.target.value)}
                      disabled={referenceLoading}
                      className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-500 disabled:opacity-60"
                    >
                      <option value="">Не назначен</option>
                      {members.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name || member.email}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2 pb-[env(safe-area-inset-bottom)]">
              <button
                type="button"
                onClick={() => setEditingProposalId(null)}
                disabled={Boolean(pendingAction)}
                className="h-10 rounded-lg border border-slate-300 px-4 text-sm font-medium disabled:opacity-50"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={() => void saveProposal()}
                disabled={Boolean(pendingAction) || !proposalTitle.trim() || referenceLoading}
                className="flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                {pendingAction === "proposal" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Сохранить
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </OpsSurface>
  );
}
