"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  BookOpen,
  CalendarDays,
  CircleSlash2,
  Check,
  ChevronDown,
  CircleUserRound,
  Clipboard,
  Download,
  ExternalLink,
  FileText,
  Flag,
  ImageIcon,
  Link2,
  Loader2,
  MessageSquareText,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Send,
  Unlink,
  UserRoundCheck,
  Video,
  X,
} from "lucide-react";

import { OPS_PRIORITY_LABELS, OPS_STATUS_LABELS } from "@/lib/operations/i18n";
import { cn } from "@/lib/utils";

import { OpsApiError, opsGet, opsMutation } from "./opsApi";
import { OpsTaskAutomation } from "./OpsTaskAutomation";
import type {
  OpsKnowledgeArticle,
  OpsAttachment,
  OpsPerson,
  OpsPriority,
  OpsProject,
  OpsTask,
  OpsTaskStatus,
} from "./types";

type OpsAiDraftSuggestion = {
  suggestion: {
    nextAction: string | null;
    definitionOfDone: string | null;
    tags: string[];
    confidence: string;
    ambiguities: string[];
    requiresApproval: boolean;
    model: string;
  };
};

function OpsLinkedText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(https?:\/\/[^\s]+)/giu).map((part, index) => {
        if (!/^https?:\/\//iu.test(part)) {
          return <span key={`${index}-${part}`}>{part}</span>;
        }
        const cleanUrl = part.replace(/[),.;!?]+$/u, "");
        const suffix = part.slice(cleanUrl.length);
        return (
          <span key={`${index}-${part}`}>
            <a
              href={cleanUrl}
              target="_blank"
              rel="noreferrer"
              className="break-all font-medium text-blue-700 underline decoration-blue-200 underline-offset-2 hover:decoration-blue-600"
            >
              {cleanUrl}
            </a>
            {suffix}
          </span>
        );
      })}
    </>
  );
}

const priorityColor: Record<OpsPriority, string> = {
  LOW: "bg-slate-300",
  NORMAL: "bg-amber-400",
  HIGH: "bg-red-500",
  URGENT: "bg-rose-600",
};

const processTagLabels: Record<string, string> = {
  pricing: "Расчёт цены",
  delivery: "Доставка",
  order: "Заказ",
  catalog: "Каталог",
  customer: "Клиент",
  supplier: "Поставщик",
  research: "Поиск",
  admin: "Админка",
  other: "Другое",
};

function taskTagPresentation(tag: string) {
  const separator = tag.indexOf(":");
  const type = separator > 0 ? tag.slice(0, separator) : "other";
  const value = separator > 0 ? tag.slice(separator + 1) : tag;
  if (type === "brand") {
    return { label: value, className: "border-violet-200 bg-violet-50 text-violet-700" };
  }
  if (type === "product") {
    return { label: value, className: "border-sky-200 bg-sky-50 text-sky-700" };
  }
  return {
    label: processTagLabels[value] ?? value,
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  };
}

const transitionTargets: Record<OpsTaskStatus, OpsTaskStatus[]> = {
  INBOX: [
    "PLANNED",
    "IN_PROGRESS",
    "WAITING_HUMAN",
    "WAITING_EXTERNAL",
    "NEEDS_APPROVAL",
    "REVIEW",
    "BLOCKED",
    "DONE",
    "CANCELLED",
  ],
  PLANNED: [
    "INBOX",
    "IN_PROGRESS",
    "WAITING_HUMAN",
    "WAITING_EXTERNAL",
    "NEEDS_APPROVAL",
    "REVIEW",
    "BLOCKED",
    "DONE",
    "CANCELLED",
  ],
  IN_PROGRESS: [
    "INBOX",
    "PLANNED",
    "WAITING_HUMAN",
    "WAITING_EXTERNAL",
    "NEEDS_APPROVAL",
    "REVIEW",
    "BLOCKED",
    "DONE",
    "CANCELLED",
  ],
  AGENT_RUNNING: [],
  WAITING_HUMAN: ["INBOX", "PLANNED", "IN_PROGRESS", "REVIEW", "BLOCKED", "DONE", "CANCELLED"],
  WAITING_EXTERNAL: ["INBOX", "PLANNED", "IN_PROGRESS", "REVIEW", "BLOCKED", "DONE", "CANCELLED"],
  NEEDS_APPROVAL: ["INBOX", "PLANNED", "IN_PROGRESS", "REVIEW", "BLOCKED", "DONE", "CANCELLED"],
  REVIEW: ["INBOX", "PLANNED", "IN_PROGRESS", "BLOCKED", "DONE", "CANCELLED"],
  BLOCKED: ["INBOX", "PLANNED", "IN_PROGRESS", "REVIEW", "DONE", "CANCELLED"],
  DONE: ["PLANNED", "IN_PROGRESS"],
  CANCELLED: ["PLANNED", "IN_PROGRESS"],
};

const waitingStatuses = new Set<OpsTaskStatus>([
  "WAITING_HUMAN",
  "WAITING_EXTERNAL",
  "NEEDS_APPROVAL",
  "BLOCKED",
]);

const nextActionStatuses = new Set<OpsTaskStatus>();

function blockerTypeForStatus(status: OpsTaskStatus) {
  if (status === "NEEDS_APPROVAL") return "APPROVAL";
  if (status === "WAITING_HUMAN") return "HUMAN";
  if (status === "WAITING_EXTERNAL") return "EXTERNAL";
  return "OTHER";
}

function formatDue(date?: string | null) {
  if (!date) return "Без срока";
  const value = new Date(date);
  const now = new Date();
  const sameDay =
    value.getDate() === now.getDate() &&
    value.getMonth() === now.getMonth() &&
    value.getFullYear() === now.getFullYear();
  if (sameDay) {
    return `Сегодня, ${new Intl.DateTimeFormat("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(value)}`;
  }
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function dueInputValue(date?: string | null) {
  if (!date) return "";
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return "";
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function initials(name?: string | null) {
  if (!name) return "—";
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function displayPersonName(person?: { name?: string | null; email?: string | null } | null) {
  const name = person?.name?.trim();
  const email = person?.email?.trim();
  if (
    name?.toLocaleLowerCase("en-US") === "sasha" &&
    email?.toLocaleLowerCase("en-US") === "sashatsompel@gmail.com"
  ) {
    return "Саша Цомпель";
  }
  return name || email || "Неизвестно";
}

function normalizeTaskAssignees(task: Pick<OpsTask, "assignee" | "assignees">): OpsPerson[] {
  const people = (task.assignees ?? []).flatMap((entry) => {
    const person =
      entry && typeof entry === "object" && "adminUser" in entry ? entry.adminUser : entry;
    return person && typeof person.id === "string" ? [person] : [];
  });

  if (!people.length && task.assignee) {
    people.push(task.assignee);
  }

  return Array.from(new Map(people.map((person) => [person.id, person])).values());
}

export function OpsTaskDetail({
  task,
  compact = false,
  onTaskChange,
  demoMode = false,
  canLinkKnowledge = false,
  initialKnowledge,
  canWrite = false,
  canReadKnowledge = false,
  canAssign = false,
  automationsEnabled = false,
  canRunAutomation = false,
  canDecideApprovals = false,
}: {
  task: OpsTask;
  compact?: boolean;
  onTaskChange?: (task: OpsTask) => void;
  demoMode?: boolean;
  canLinkKnowledge?: boolean;
  initialKnowledge?: OpsKnowledgeArticle[];
  canWrite?: boolean;
  canReadKnowledge?: boolean;
  canAssign?: boolean;
  automationsEnabled?: boolean;
  canRunAutomation?: boolean;
  canDecideApprovals?: boolean;
}) {
  const [current, setCurrent] = useState(task);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(!compact);
  const [statusOpen, setStatusOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [knowledgePickerOpen, setKnowledgePickerOpen] = useState(false);
  const [knowledgeLoading, setKnowledgeLoading] = useState(false);
  const [knowledgeArticles, setKnowledgeArticles] = useState<OpsKnowledgeArticle[]>(
    initialKnowledge ?? []
  );
  const [selectedKnowledgeId, setSelectedKnowledgeId] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editDescription, setEditDescription] = useState(task.description ?? "");
  const [editNextAction, setEditNextAction] = useState(task.nextAction ?? "");
  const [editDefinitionOfDone, setEditDefinitionOfDone] = useState(task.definitionOfDone ?? "");
  const [editTags, setEditTags] = useState(task.tags ?? []);
  const [aiDraftStatus, setAiDraftStatus] = useState<
    "idle" | "waiting" | "loading" | "ready" | "review" | "error"
  >("idle");
  const [aiDraftMessage, setAiDraftMessage] = useState("");
  const aiDraftLastFingerprintRef = useRef("");
  const aiDraftCurrentFingerprintRef = useRef("");
  const aiDraftRequestRef = useRef(0);
  const aiDraftAutoRunsRef = useRef(0);
  const [commentText, setCommentText] = useState("");
  const [editProjectId, setEditProjectId] = useState(task.project?.id ?? "");
  const [editShared, setEditShared] = useState(task.isShared);
  const [taskProjects, setTaskProjects] = useState<OpsProject[]>([]);
  const [taskMembers, setTaskMembers] = useState<OpsPerson[]>([]);
  const [taskReferencesLoading, setTaskReferencesLoading] = useState(false);
  const [inlineMembersLoading, setInlineMembersLoading] = useState(false);
  const [assigneePickerOpen, setAssigneePickerOpen] = useState(false);
  const [assigneeSearch, setAssigneeSearch] = useState("");
  const assigneePickerRef = useRef<HTMLDivElement>(null);
  const [transitionDialogStatus, setTransitionDialogStatus] = useState<OpsTaskStatus | null>(null);
  const [transitionNextAction, setTransitionNextAction] = useState("");
  const [transitionBlockerDescription, setTransitionBlockerDescription] = useState("");
  const [transitionComment, setTransitionComment] = useState("");
  const [previewAttachment, setPreviewAttachment] = useState<OpsAttachment | null>(null);
  const [dueDraft, setDueDraft] = useState(dueInputValue(task.dueAt));
  const attachments =
    current.attachments
      ?.map(({ attachment }) => attachment)
      .filter((attachment) => attachment.state === "READY") ?? [];
  const audioAttachments = attachments.filter((attachment) =>
    attachment.mimeType.startsWith("audio/")
  );
  const imageAttachments = attachments.filter((attachment) =>
    attachment.mimeType.startsWith("image/")
  );
  const videoAttachments = attachments.filter((attachment) =>
    attachment.mimeType.startsWith("video/")
  );
  const documentAttachments = attachments.filter(
    (attachment) =>
      !attachment.mimeType.startsWith("audio/") &&
      !attachment.mimeType.startsWith("image/") &&
      !attachment.mimeType.startsWith("video/")
  );
  const legacyTranscript = audioAttachments.some((attachment) => attachment.transcription)
    ? null
    : audioAttachments.find((attachment) => attachment.inboxItem?.transcription)?.inboxItem
        ?.transcription;

  const activity = useMemo(() => current.events ?? [], [current.events]);
  const currentAssignees = useMemo(() => normalizeTaskAssignees(current), [current]);
  const effectiveRequester =
    current.requestedBy === undefined ? (current.createdBy ?? null) : current.requestedBy;
  const knownTaskMembers = useMemo(() => {
    const byId = new Map<string, OpsPerson>();
    for (const person of [
      ...currentAssignees,
      effectiveRequester,
      current.createdBy,
      ...taskMembers,
    ]) {
      if (person) byId.set(person.id, person);
    }
    return Array.from(byId.values());
  }, [current.createdBy, currentAssignees, effectiveRequester, taskMembers]);
  const filteredTaskMembers = useMemo(() => {
    const query = assigneeSearch.trim().toLocaleLowerCase("ru-RU");
    const selectedIds = new Set(currentAssignees.map((person) => person.id));
    return knownTaskMembers
      .filter((member) => {
        if (!query) return true;
        return `${displayPersonName(member)} ${member.email}`
          .toLocaleLowerCase("ru-RU")
          .includes(query);
      })
      .sort((left, right) => {
        const selectedDifference =
          Number(selectedIds.has(right.id)) - Number(selectedIds.has(left.id));
        if (selectedDifference) return selectedDifference;
        return displayPersonName(left).localeCompare(displayPersonName(right), "ru");
      });
  }, [assigneeSearch, currentAssignees, knownTaskMembers]);
  const progressUpdates = useMemo(() => {
    const events = current.events ?? [];
    const reverted = new Set(
      events.flatMap((event) =>
        event.type === "UNDONE" &&
        event.payload?.kind === "progress_update_undo" &&
        typeof event.payload.revertedEventId === "string"
          ? [event.payload.revertedEventId]
          : []
      )
    );
    return events.flatMap((event) =>
      event.type === "UPDATED" &&
      event.payload?.kind === "progress_update" &&
      typeof event.payload.update === "string"
        ? [{ ...event, update: event.payload.update, reverted: reverted.has(event.id) }]
        : []
    );
  }, [current.events]);

  useEffect(() => {
    setCurrent(task);
    setDueDraft(dueInputValue(task.dueAt));
    setPreviewAttachment(null);
  }, [task]);

  useEffect(() => {
    setDueDraft(dueInputValue(current.dueAt));
  }, [current.dueAt]);

  useEffect(() => {
    if (!assigneePickerOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !assigneePickerRef.current?.contains(event.target)) {
        setAssigneePickerOpen(false);
        setAssigneeSearch("");
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setAssigneePickerOpen(false);
        setAssigneeSearch("");
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [assigneePickerOpen]);

  function taskDraftFingerprint() {
    return JSON.stringify([editTitle.trim(), editDescription.trim()]);
  }

  async function refineTaskDraft(fingerprint = taskDraftFingerprint(), manual = false) {
    if (!editOpen || demoMode || !canWrite || !editTitle.trim()) return;
    if (!manual && aiDraftAutoRunsRef.current >= 4) return;
    const requestId = aiDraftRequestRef.current + 1;
    aiDraftRequestRef.current = requestId;
    if (!manual) aiDraftAutoRunsRef.current += 1;
    setAiDraftStatus("loading");
    setAiDraftMessage("Gemini проверяет связанные поля…");
    try {
      const response = await opsMutation<OpsAiDraftSuggestion>({
        path: `/api/admin/operations/tasks/${current.id}/ai-draft`,
        body: {
          title: editTitle,
          description: editDescription,
          nextAction: editNextAction,
          definitionOfDone: editDefinitionOfDone,
        },
        scope: `task-ai-draft:${current.id}`,
      });
      if (
        requestId !== aiDraftRequestRef.current ||
        fingerprint !== aiDraftCurrentFingerprintRef.current
      ) {
        return;
      }
      const suggestion = response.suggestion;
      const confidence = Number.parseFloat(suggestion.confidence);
      if (!suggestion.requiresApproval && confidence >= 0.7) {
        if (suggestion.nextAction) setEditNextAction(suggestion.nextAction);
        if (suggestion.definitionOfDone) {
          setEditDefinitionOfDone(suggestion.definitionOfDone);
        }
        if (suggestion.tags.length) setEditTags(suggestion.tags);
        setAiDraftStatus("ready");
        setAiDraftMessage(
          `Gemini обновил следующее действие, критерий завершения и теги · ${suggestion.model}`
        );
      } else {
        setAiDraftStatus("review");
        setAiDraftMessage(
          suggestion.ambiguities[0] ||
            "Gemini не уверен в контексте — связанные поля оставлены без изменений."
        );
      }
      aiDraftLastFingerprintRef.current = fingerprint;
    } catch (cause) {
      if (requestId !== aiDraftRequestRef.current) return;
      setAiDraftStatus("error");
      setAiDraftMessage(
        cause instanceof Error ? cause.message : "Gemini не смог обновить черновик."
      );
    }
  }

  useEffect(() => {
    if (!editOpen) {
      aiDraftRequestRef.current += 1;
      return;
    }
    const fingerprint = taskDraftFingerprint();
    aiDraftCurrentFingerprintRef.current = fingerprint;
    if (
      demoMode ||
      !canWrite ||
      editTitle.trim().length + editDescription.trim().length < 12 ||
      fingerprint === aiDraftLastFingerprintRef.current ||
      aiDraftAutoRunsRef.current >= 4
    ) {
      return;
    }
    setAiDraftStatus("waiting");
    setAiDraftMessage("Gemini обновит связанные поля после паузы…");
    const timer = window.setTimeout(() => {
      void refineTaskDraft(fingerprint);
    }, 1_800);
    return () => window.clearTimeout(timer);
    // The authored text is the trigger; AI-derived fields intentionally are not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editOpen, editTitle, editDescription, canWrite, demoMode]);

  useEffect(() => {
    if (!canAssign || demoMode) return;
    const controller = new AbortController();
    setInlineMembersLoading(true);
    void opsGet<{ members: OpsPerson[] }>("/api/admin/operations/members", controller.signal)
      .then((response) => setTaskMembers(response.members))
      .catch((cause) => {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : "Не удалось загрузить исполнителей");
      })
      .finally(() => {
        if (!controller.signal.aborted) setInlineMembersLoading(false);
      });
    return () => controller.abort();
  }, [canAssign, demoMode]);

  function openTransitionDialog(status: OpsTaskStatus) {
    if (!canWrite || pending || status === current.status) return;
    setTransitionDialogStatus(status);
    setTransitionNextAction(current.nextAction ?? "");
    setTransitionBlockerDescription(current.blockerDescription ?? "");
    setTransitionComment("");
    setStatusOpen(false);
    setError(null);
  }

  async function transition(status: OpsTaskStatus, commentOverride?: string) {
    if (!canWrite || pending || status === current.status) return;
    const waiting = waitingStatuses.has(status);
    const reopening = ["DONE", "CANCELLED"].includes(current.status);
    const nextAction = waiting
      ? null
      : nextActionStatuses.has(status)
        ? transitionNextAction.trim() || null
        : (current.nextAction ?? null);
    const blockerDescription = waiting ? transitionBlockerDescription.trim() || null : null;
    const comment =
      status === "CANCELLED" || reopening
        ? commentOverride?.trim() || transitionComment.trim() || null
        : null;

    if ((status === "CANCELLED" || reopening) && !comment) {
      setError(
        reopening
          ? "Укажите, почему задача открывается повторно."
          : "Укажите причину отмены задачи."
      );
      return;
    }
    setPending(true);
    setError(null);
    setStatusOpen(false);
    setTransitionDialogStatus(null);
    const previous = current;
    const optimistic = {
      ...current,
      status,
      nextAction,
      blockerType: waiting && blockerDescription ? blockerTypeForStatus(status) : null,
      blockerDescription,
      version: current.version + 1,
    };
    setCurrent(optimistic);
    onTaskChange?.(optimistic);
    try {
      if (demoMode) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        return;
      }
      const response = await opsMutation<{ task: OpsTask }>({
        path: `/api/admin/operations/tasks/${current.id}/transition`,
        body: {
          status,
          nextAction,
          reopen: reopening,
          comment,
          ...(waiting && blockerDescription
            ? {
                blockerType: blockerTypeForStatus(status),
                blockerDescription,
              }
            : {}),
        },
        version: current.version,
        scope: `task-transition:${current.id}`,
      });
      setCurrent(response.task);
      onTaskChange?.(response.task);
    } catch (cause) {
      setCurrent(previous);
      onTaskChange?.(previous);
      setError(cause instanceof Error ? cause.message : "Не удалось изменить статус");
    } finally {
      setPending(false);
    }
  }

  async function saveTask() {
    if (!canWrite || pending || !editTitle.trim()) return;
    setPending(true);
    setError(null);
    try {
      let updated: OpsTask;
      const patch = {
        title: editTitle.trim(),
        description: editDescription.trim() || null,
        nextAction: editNextAction.trim() || null,
        definitionOfDone: editDefinitionOfDone.trim() || null,
        tags: editTags,
        projectId: editProjectId || null,
        isShared: editShared,
      };
      if (demoMode) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        updated = { ...current, ...patch, version: current.version + 1 };
      } else {
        updated = await mutateTaskPatchWithRefresh(patch, `task-edit:${current.id}`);
      }
      setCurrent(updated);
      onTaskChange?.(updated);
      setEditOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось сохранить задачу");
    } finally {
      setPending(false);
    }
  }

  async function mutateTaskPatchWithRefresh(
    patch: Record<string, unknown>,
    scope: string,
    patchAfterRefresh?: (latest: OpsTask) => Record<string, unknown>
  ): Promise<OpsTask> {
    const mutate = (version: number, body = patch) =>
      opsMutation<{ task: OpsTask }>({
        path: `/api/admin/operations/tasks/${current.id}`,
        method: "PATCH",
        body,
        version,
        scope,
      });
    try {
      return (await mutate(current.version)).task;
    } catch (cause) {
      const isVersionConflict =
        cause instanceof OpsApiError &&
        (cause.status === 409 || cause.status === 412 || cause.code === "VERSION_CONFLICT");
      if (!isVersionConflict) throw cause;
      const latest = await opsGet<{ task: OpsTask }>(`/api/admin/operations/tasks/${current.id}`);
      setCurrent(latest.task);
      onTaskChange?.(latest.task);
      return (await mutate(latest.task.version, patchAfterRefresh?.(latest.task) ?? patch)).task;
    }
  }

  async function saveInlineTaskPatch(
    patch: Record<string, unknown>,
    scope: string,
    patchAfterRefresh?: (latest: OpsTask) => Record<string, unknown>
  ) {
    const participantChange = scope === "assignee" || scope === "requester";
    if (pending || (!canWrite && !(canAssign && participantChange))) return false;
    setPending(true);
    setError(null);
    try {
      let updated: OpsTask;
      if (demoMode) {
        await new Promise((resolve) => setTimeout(resolve, 180));
        const hasAssigneeIds = Object.hasOwn(patch, "assigneeIds");
        const assigneeIds =
          hasAssigneeIds && Array.isArray(patch.assigneeIds)
            ? patch.assigneeIds.filter((value): value is string => typeof value === "string")
            : [];
        const hasRequestedById = Object.hasOwn(patch, "requestedById");
        const requestedById =
          hasRequestedById && typeof patch.requestedById === "string" ? patch.requestedById : null;
        const taskPatch = Object.fromEntries(
          Object.entries(patch).filter(([key]) => key !== "assigneeIds" && key !== "requestedById")
        );
        const demoAssignees = assigneeIds.flatMap((id) => {
          const person = knownTaskMembers.find((member) => member.id === id);
          return person ? [person] : [];
        });
        updated = {
          ...current,
          ...taskPatch,
          ...(hasAssigneeIds
            ? {
                assignees: demoAssignees,
                assignee: demoAssignees[0] ?? null,
              }
            : {}),
          ...(hasRequestedById
            ? {
                requestedBy: knownTaskMembers.find((member) => member.id === requestedById) ?? null,
              }
            : {}),
          version: current.version + 1,
        } as OpsTask;
      } else {
        updated = await mutateTaskPatchWithRefresh(
          patch,
          `task-inline-${scope}:${current.id}`,
          patchAfterRefresh
        );
      }
      setCurrent(updated);
      onTaskChange?.(updated);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось сохранить изменение");
      return false;
    } finally {
      setPending(false);
    }
  }

  async function saveDueDraft() {
    if (!canWrite || pending) return;
    const currentValue = dueInputValue(current.dueAt);
    if (dueDraft === currentValue) return;
    const parsed = dueDraft ? new Date(dueDraft) : null;
    if (parsed && Number.isNaN(parsed.getTime())) {
      setError("Укажите корректные дату и время");
      return;
    }
    const saved = await saveInlineTaskPatch({ dueAt: parsed?.toISOString() ?? null }, "due");
    if (!saved) setDueDraft(currentValue);
  }

  async function loadInlineMembers() {
    if (!canAssign || demoMode || taskMembers.length || inlineMembersLoading) return;
    setInlineMembersLoading(true);
    setError(null);
    try {
      const response = await opsGet<{ members: OpsPerson[] }>("/api/admin/operations/members");
      setTaskMembers(response.members);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось загрузить исполнителей");
    } finally {
      setInlineMembersLoading(false);
    }
  }

  async function updateTaskAssignee(memberId: string, assigned: boolean) {
    if (!canAssign || pending) return;
    const currentIds = currentAssignees.map((person) => person.id);
    const assigneeIds = assigned
      ? Array.from(new Set([...currentIds, memberId]))
      : currentIds.filter((id) => id !== memberId);
    await saveInlineTaskPatch({ assigneeIds }, "assignee", (latest) => {
      const latestIds = normalizeTaskAssignees(latest).map((person) => person.id);
      return {
        assigneeIds: assigned
          ? Array.from(new Set([...latestIds, memberId]))
          : latestIds.filter((id) => id !== memberId),
      };
    });
  }

  async function openTaskEditor() {
    setEditTitle(current.title);
    setEditDescription(current.description ?? "");
    setEditNextAction(current.nextAction ?? "");
    setEditDefinitionOfDone(current.definitionOfDone ?? "");
    setEditTags(current.tags ?? []);
    setEditProjectId(current.project?.id ?? "");
    setEditShared(current.isShared);
    aiDraftAutoRunsRef.current = 0;
    aiDraftLastFingerprintRef.current = JSON.stringify([
      current.title.trim(),
      (current.description ?? "").trim(),
    ]);
    aiDraftCurrentFingerprintRef.current = aiDraftLastFingerprintRef.current;
    setAiDraftStatus("idle");
    setAiDraftMessage("");
    setEditOpen(true);
    setError(null);
    if (demoMode || taskProjects.length || taskReferencesLoading) return;
    setTaskReferencesLoading(true);
    try {
      const projectResult = await opsGet<{ projects: OpsProject[] }>(
        "/api/admin/operations/projects?limit=100"
      );
      setTaskProjects(projectResult.projects);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось загрузить проекты");
    } finally {
      setTaskReferencesLoading(false);
    }
  }

  async function addComment() {
    const text = commentText.trim();
    if (!canWrite || pending || !text) return;
    setPending(true);
    setError(null);
    try {
      const comment = demoMode
        ? {
            id: `demo-comment-${Date.now()}`,
            text,
            createdAt: new Date().toISOString(),
          }
        : (
            await opsMutation<{ comment: NonNullable<OpsTask["comments"]>[number] }>({
              path: `/api/admin/operations/tasks/${current.id}/comments`,
              body: { text },
              scope: `task-comment:${current.id}`,
            })
          ).comment;
      const updated = {
        ...current,
        comments: [...(current.comments ?? []), comment],
      };
      setCurrent(updated);
      onTaskChange?.(updated);
      setCommentText("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось добавить комментарий");
    } finally {
      setPending(false);
    }
  }

  async function openKnowledgePicker() {
    setKnowledgePickerOpen(true);
    setError(null);
    if (initialKnowledge || demoMode || knowledgeArticles.length) return;
    setKnowledgeLoading(true);
    try {
      const response = await opsGet<{ articles: OpsKnowledgeArticle[] }>(
        "/api/admin/operations/knowledge?locale=ru&limit=100"
      );
      setKnowledgeArticles(response.articles);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось загрузить БАЗУ");
    } finally {
      setKnowledgeLoading(false);
    }
  }

  async function linkKnowledge(articleId: string) {
    if (!articleId || pending) return;
    const article = knowledgeArticles.find((item) => item.id === articleId);
    if (!article) return;
    setPending(true);
    setError(null);
    try {
      let updated: OpsTask;
      if (demoMode) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        updated = {
          ...current,
          version: current.version + 1,
          knowledgeLinks: [
            ...(current.knowledgeLinks ?? []),
            {
              article: {
                id: article.id,
                slug: article.slug,
                title: article.title,
                category: article.category,
                brandKey: article.brandKey,
                tags: article.tags,
                status: article.status,
                updatedAt: article.updatedAt,
              },
            },
          ],
        };
      } else {
        const response = await opsMutation<{ task: OpsTask }>({
          path: `/api/admin/operations/tasks/${current.id}/knowledge/${articleId}`,
          body: {},
          version: current.version,
          scope: `task-knowledge-link:${current.id}:${articleId}`,
        });
        updated = response.task;
      }
      setCurrent(updated);
      onTaskChange?.(updated);
      setSelectedKnowledgeId("");
      setKnowledgePickerOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось прикрепить статью");
    } finally {
      setPending(false);
    }
  }

  async function unlinkKnowledge(articleId: string) {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      let updated: OpsTask;
      if (demoMode) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        updated = {
          ...current,
          version: current.version + 1,
          knowledgeLinks: current.knowledgeLinks?.filter(({ article }) => article.id !== articleId),
        };
      } else {
        const response = await opsMutation<{ task: OpsTask }>({
          path: `/api/admin/operations/tasks/${current.id}/knowledge/${articleId}`,
          method: "DELETE",
          body: {},
          version: current.version,
          scope: `task-knowledge-unlink:${current.id}:${articleId}`,
        });
        updated = response.task;
      }
      setCurrent(updated);
      onTaskChange?.(updated);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось отвязать статью");
    } finally {
      setPending(false);
    }
  }

  const transitionIsWaiting = transitionDialogStatus
    ? waitingStatuses.has(transitionDialogStatus)
    : false;
  const transitionNeedsNextAction = transitionDialogStatus
    ? nextActionStatuses.has(transitionDialogStatus)
    : false;
  const transitionIsReopening =
    Boolean(transitionDialogStatus) && ["DONE", "CANCELLED"].includes(current.status);
  const transitionNeedsComment = transitionDialogStatus === "CANCELLED" || transitionIsReopening;
  const transitionFormValid =
    Boolean(transitionDialogStatus) &&
    (!transitionNeedsNextAction || Boolean(transitionNextAction.trim())) &&
    (!transitionNeedsComment || Boolean(transitionComment.trim()));

  return (
    <article className={cn("relative min-w-0 bg-white", compact ? "h-full" : "min-h-full")}>
      {!compact ? (
        <div className="flex h-16 items-center justify-between bg-[#0b1b2d] px-4 text-white lg:hidden">
          <Link
            href="/admin/operations/tasks"
            aria-label="Назад к задачам"
            className="flex h-11 items-center gap-2 rounded-lg px-1 text-sm font-medium"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>Мои задачи</span>
          </Link>
          {canReadKnowledge ? (
            <Link
              href="/admin/operations/knowledge"
              className="flex h-10 items-center gap-2 rounded-lg border border-blue-400 px-3 text-blue-400"
            >
              <BookOpen className="h-5 w-5" />
              <span>БАЗА</span>
            </Link>
          ) : null}
        </div>
      ) : null}

      <div className={cn("mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8", compact && "py-7")}>
        {editOpen ? (
          <div className="border border-blue-200 bg-blue-50/40 p-3 sm:p-4">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Название
              </span>
              <textarea
                autoFocus
                aria-label="Название задачи"
                value={editTitle}
                onChange={(event) => setEditTitle(event.target.value)}
                rows={2}
                className={cn(
                  "mt-2 w-full resize-none border border-slate-300 bg-white px-3 py-2 font-bold leading-tight tracking-tight text-slate-950 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100",
                  compact ? "text-lg xl:text-xl 2xl:text-2xl" : "text-2xl sm:text-3xl"
                )}
              />
            </label>
            <label className="mt-4 block">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Описание
              </span>
              <textarea
                aria-label="Описание задачи"
                value={editDescription}
                onChange={(event) => setEditDescription(event.target.value)}
                rows={4}
                placeholder="Добавьте детали, ссылки или важный контекст"
                className="mt-2 w-full resize-y border border-slate-300 bg-white p-3 text-sm leading-6 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <div
              className={cn(
                "mt-3 flex items-start justify-between gap-3 border px-3 py-2 text-xs",
                aiDraftStatus === "error"
                  ? "border-red-200 bg-red-50 text-red-700"
                  : aiDraftStatus === "review"
                    ? "border-amber-200 bg-amber-50 text-amber-800"
                    : "border-blue-200 bg-blue-50 text-blue-700"
              )}
            >
              <span className="min-w-0 leading-5">
                {aiDraftMessage ||
                  "После ручной правки Gemini уточнит следующее действие, критерий завершения и теги."}
              </span>
              <button
                type="button"
                disabled={aiDraftStatus === "loading" || !editTitle.trim()}
                onClick={() => void refineTaskDraft(taskDraftFingerprint(), true)}
                className="shrink-0 font-semibold underline underline-offset-2 disabled:opacity-50"
              >
                {aiDraftStatus === "loading" ? "Проверяю…" : "Проверить сейчас"}
              </button>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Следующее действие
                </span>
                <textarea
                  aria-label="Следующее действие"
                  value={editNextAction}
                  onChange={(event) => setEditNextAction(event.target.value)}
                  rows={3}
                  className="mt-2 w-full resize-y border border-slate-300 bg-white p-3 text-sm leading-5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Готово, когда
                </span>
                <textarea
                  aria-label="Критерий готовности"
                  value={editDefinitionOfDone}
                  onChange={(event) => setEditDefinitionOfDone(event.target.value)}
                  rows={3}
                  className="mt-2 w-full resize-y border border-slate-300 bg-white p-3 text-sm leading-5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>
            </div>
            {editTags.length ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {editTags.map((tag) => {
                  const presentation = taskTagPresentation(tag);
                  return (
                    <span
                      key={tag}
                      className={cn(
                        "border px-2 py-1 text-xs font-semibold",
                        presentation.className
                      )}
                    >
                      {presentation.label}
                    </span>
                  );
                })}
              </div>
            ) : null}
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                disabled={pending}
                className="h-10 border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 disabled:opacity-50"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={() => void saveTask()}
                disabled={!editTitle.trim() || pending || taskReferencesLoading}
                className="flex h-10 items-center gap-2 bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Сохранить
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-3">
              <h2
                className={cn(
                  "min-w-0 flex-1 font-bold leading-tight tracking-tight text-slate-950",
                  compact ? "text-lg xl:text-xl 2xl:text-2xl" : "text-[24px] sm:text-3xl"
                )}
              >
                {current.title}
              </h2>
              {canWrite ? (
                <button
                  type="button"
                  onClick={() => void openTaskEditor()}
                  className="mt-0.5 flex h-10 items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:border-blue-300 hover:text-blue-700"
                >
                  <Pencil className="h-4 w-4" />
                  <span className="hidden sm:inline">Редактировать</span>
                </button>
              ) : null}
            </div>
            {current.number ? (
              <p className="mt-1 font-mono text-xs font-semibold text-blue-600">
                Задача #{current.number}
              </p>
            ) : null}
            {current.description ? (
              <div className="mt-3 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-slate-600">
                <OpsLinkedText text={current.description} />
              </div>
            ) : null}
            {current.tags?.length ? (
              <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Теги задачи">
                {current.tags.map((tag) => {
                  const presentation = taskTagPresentation(tag);
                  return (
                    <span
                      key={tag}
                      className={cn(
                        "border px-2 py-1 text-xs font-semibold",
                        presentation.className
                      )}
                    >
                      {presentation.label}
                    </span>
                  );
                })}
              </div>
            ) : null}
          </>
        )}

        <div
          className={cn(
            "mt-6 grid border-b border-slate-200 pb-5",
            compact ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-4"
          )}
        >
          <div
            className={cn(
              "relative",
              compact
                ? "border-r border-slate-200 pr-3"
                : "border-b border-slate-200 pb-4 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-4"
            )}
          >
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Check className="h-4 w-4 text-blue-600" />
              Статус
            </div>
            {canWrite && current.status !== "AGENT_RUNNING" ? (
              <button
                type="button"
                onClick={() => setStatusOpen((open) => !open)}
                disabled={pending}
                className="mt-2 flex min-h-9 items-center gap-2 text-left text-sm font-medium text-blue-600 disabled:opacity-50"
              >
                {OPS_STATUS_LABELS[current.status]}
                <ChevronDown className="h-4 w-4" />
              </button>
            ) : (
              <div className="mt-2 flex min-h-9 items-center text-sm font-medium text-slate-700">
                {OPS_STATUS_LABELS[current.status]}
              </div>
            )}
            {statusOpen ? (
              <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                {transitionTargets[current.status].map((status) => (
                  <button
                    type="button"
                    key={status}
                    onClick={() => openTransitionDialog(status)}
                    className={cn(
                      "block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-100",
                      status === current.status && "bg-blue-50 text-blue-700"
                    )}
                  >
                    {OPS_STATUS_LABELS[status]}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div
            className={cn(
              compact
                ? "pl-3"
                : "border-b border-slate-200 py-4 sm:border-b-0 sm:border-r sm:px-4 sm:py-0"
            )}
          >
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Flag className="h-4 w-4" />
              Приоритет
            </div>
            {canWrite ? (
              <div className="mt-2 flex min-h-9 items-center gap-1">
                <span
                  className={cn(
                    "h-2.5 w-2.5 shrink-0 rounded-full",
                    priorityColor[current.priority]
                  )}
                />
                <select
                  aria-label="Приоритет задачи"
                  value={current.priority}
                  disabled={pending}
                  onChange={(event) =>
                    void saveInlineTaskPatch(
                      { priority: event.target.value as OpsPriority },
                      "priority"
                    )
                  }
                  className="h-9 min-w-0 flex-1 cursor-pointer rounded-md border-0 bg-transparent px-1 text-sm font-medium text-slate-900 outline-none hover:bg-slate-50 focus:ring-2 focus:ring-blue-100 disabled:opacity-50"
                >
                  {(Object.keys(OPS_PRIORITY_LABELS) as OpsPriority[]).map((priority) => (
                    <option key={priority} value={priority}>
                      {OPS_PRIORITY_LABELS[priority]}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="mt-2 flex min-h-9 items-center gap-2 text-sm font-medium">
                <span className={cn("h-2.5 w-2.5 rounded-full", priorityColor[current.priority])} />
                {OPS_PRIORITY_LABELS[current.priority]}
              </div>
            )}
          </div>
          <div
            className={cn(
              "relative",
              compact
                ? "mt-4 border-r border-t border-slate-200 pr-3 pt-4"
                : "border-b border-slate-200 py-4 sm:border-b-0 sm:border-r sm:px-4 sm:py-0"
            )}
          >
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <CircleUserRound className="h-4 w-4" />
              Исполнители
            </div>
            {current.isShared ? (
              <div className="mt-2 flex min-h-9 items-center gap-2 text-sm font-semibold text-blue-700">
                <span className="flex h-7 min-w-7 items-center justify-center bg-blue-100 px-1 text-[10px]">
                  ВСЕ
                </span>
                Вся команда
              </div>
            ) : canAssign ? (
              <div ref={assigneePickerRef} className="relative mt-2 min-h-9">
                <div className="flex flex-wrap items-center gap-1.5">
                  {currentAssignees.map((person) => (
                    <span
                      key={person.id}
                      className="inline-flex h-8 max-w-full items-center gap-1 rounded-full border border-blue-200 bg-blue-50 pl-1 pr-1.5 text-xs font-medium text-blue-800"
                      title={displayPersonName(person)}
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[9px] font-semibold">
                        {initials(person.name)}
                      </span>
                      <span className="max-w-28 truncate">{displayPersonName(person)}</span>
                      <button
                        type="button"
                        onClick={() => void updateTaskAssignee(person.id, false)}
                        disabled={pending}
                        aria-label={`Убрать исполнителя ${displayPersonName(person)}`}
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-blue-500 hover:bg-blue-100 hover:text-blue-800 disabled:opacity-50"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </span>
                  ))}
                  <button
                    type="button"
                    aria-label="Исполнитель задачи"
                    aria-expanded={assigneePickerOpen}
                    onClick={() => {
                      setAssigneePickerOpen((open) => !open);
                      setAssigneeSearch("");
                      void loadInlineMembers();
                    }}
                    disabled={pending}
                    className={cn(
                      "flex h-8 items-center gap-1 rounded-full border border-dashed border-slate-300 px-2 font-medium text-slate-600 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50",
                      compact ? "text-[11px]" : "text-xs"
                    )}
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    {currentAssignees.length ? "Добавить" : "Назначить"}
                  </button>
                </div>
                {assigneePickerOpen ? (
                  <div
                    role="dialog"
                    aria-label="Выбор исполнителей"
                    className="absolute left-0 top-full z-40 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-2 shadow-xl"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="search"
                        autoFocus
                        value={assigneeSearch}
                        onChange={(event) => setAssigneeSearch(event.target.value)}
                        placeholder="Найти сотрудника…"
                        aria-label="Поиск исполнителя"
                        className="h-10 min-w-0 flex-1 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setAssigneePickerOpen(false);
                          setAssigneeSearch("");
                        }}
                        aria-label="Закрыть выбор исполнителей"
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                    <div className="mt-2 max-h-56 overflow-y-auto overscroll-contain">
                      {inlineMembersLoading && taskMembers.length === 0 ? (
                        <div className="flex h-16 items-center justify-center gap-2 text-sm text-slate-500">
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                          Загрузка…
                        </div>
                      ) : filteredTaskMembers.length ? (
                        filteredTaskMembers.map((member) => {
                          const checked = currentAssignees.some(
                            (person) => person.id === member.id
                          );
                          return (
                            <label
                              key={member.id}
                              className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={pending}
                                onChange={(event) =>
                                  void updateTaskAssignee(member.id, event.target.checked)
                                }
                                className="h-4 w-4 shrink-0 accent-blue-600"
                              />
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-700">
                                {initials(member.name)}
                              </span>
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-medium text-slate-900">
                                  {displayPersonName(member)}
                                </span>
                                {member.name ? (
                                  <span className="block truncate text-xs text-slate-400">
                                    {member.email}
                                  </span>
                                ) : null}
                              </span>
                            </label>
                          );
                        })
                      ) : (
                        <p className="px-2 py-4 text-center text-sm text-slate-500">
                          Никого не найдено
                        </p>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="mt-2 flex min-h-9 flex-wrap items-center gap-1.5">
                {currentAssignees.length ? (
                  currentAssignees.map((person) => (
                    <span
                      key={person.id}
                      className="inline-flex h-8 max-w-full items-center gap-1.5 rounded-full bg-slate-100 pl-1 pr-2 text-xs font-medium text-slate-800"
                      title={displayPersonName(person)}
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-[9px]">
                        {initials(person.name)}
                      </span>
                      <span className="max-w-28 truncate">{displayPersonName(person)}</span>
                    </span>
                  ))
                ) : (
                  <span className="text-sm font-medium text-slate-500">Не назначены</span>
                )}
              </div>
            )}
          </div>
          <div
            className={cn(
              compact ? "mt-4 border-t border-slate-200 pl-3 pt-4" : "pt-4 sm:pl-4 sm:pt-0"
            )}
          >
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <CalendarDays className="h-4 w-4" />
              Срок
            </div>
            {canWrite ? (
              <input
                type="datetime-local"
                aria-label="Срок задачи"
                value={dueDraft}
                disabled={pending}
                onChange={(event) => setDueDraft(event.target.value)}
                onBlur={() => void saveDueDraft()}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.currentTarget.blur();
                  if (event.key === "Escape") {
                    setDueDraft(dueInputValue(current.dueAt));
                    event.preventDefault();
                  }
                }}
                className="mt-2 h-9 w-full min-w-0 cursor-pointer rounded-md border-0 bg-transparent px-1 text-xs font-medium text-slate-900 outline-none hover:bg-slate-50 focus:ring-2 focus:ring-blue-100 disabled:opacity-50"
              />
            ) : (
              <div className="mt-2 flex min-h-9 items-center text-sm font-medium">
                {formatDue(current.dueAt)}
              </div>
            )}
          </div>
        </div>
        <div className="grid gap-2 border-b border-slate-200 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="flex min-w-0 items-center gap-2 text-slate-600">
            <UserRoundCheck className="h-4 w-4 shrink-0 text-slate-400" />
            <span className="shrink-0">Поставил:</span>
            {canAssign ? (
              <select
                aria-label="Кто поставил задачу"
                value={effectiveRequester?.id ?? ""}
                disabled={pending}
                onFocus={() => void loadInlineMembers()}
                onChange={(event) =>
                  void saveInlineTaskPatch(
                    { requestedById: event.target.value || null },
                    "requester"
                  )
                }
                className="h-9 min-w-0 max-w-full cursor-pointer rounded-md border-0 bg-transparent px-1 text-sm font-semibold text-slate-900 outline-none hover:bg-slate-50 focus:ring-2 focus:ring-blue-100 disabled:opacity-50"
              >
                <option value="">Не определён</option>
                {inlineMembersLoading ? <option disabled>Загрузка…</option> : null}
                {knownTaskMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {displayPersonName(member)}
                  </option>
                ))}
              </select>
            ) : (
              <strong className="truncate font-semibold text-slate-900">
                {effectiveRequester ? displayPersonName(effectiveRequester) : "Не определён"}
              </strong>
            )}
          </div>
          <span className="flex min-w-0 items-center gap-1.5 text-xs text-slate-400 sm:justify-end">
            <CircleUserRound className="h-3.5 w-3.5 shrink-0" />
            Добавил в систему:
            <span className="truncate">{displayPersonName(current.createdBy)}</span>
          </span>
        </div>

        {editOpen ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block border border-slate-200 bg-white p-4 shadow-sm">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Проект
              </span>
              <select
                aria-label="Проект задачи"
                value={editProjectId}
                onChange={(event) => setEditProjectId(event.target.value)}
                disabled={taskReferencesLoading}
                className="mt-2 h-11 w-full border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
              >
                <option value="">Без проекта</option>
                {editProjectId && !taskProjects.some((project) => project.id === editProjectId) ? (
                  <option value={editProjectId}>{current.project?.title || editProjectId}</option>
                ) : null}
                {taskProjects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex cursor-pointer items-start gap-3 border border-blue-200 bg-blue-50 p-4">
              <input
                type="checkbox"
                checked={editShared}
                onChange={(event) => setEditShared(event.target.checked)}
                className="mt-1 h-4 w-4 accent-blue-600"
              />
              <span>
                <span className="block text-sm font-semibold text-slate-950">Общая задача</span>
                <span className="mt-1 block text-xs leading-5 text-slate-600">
                  Доступна для работы всей команде. Исполнитель не требуется.
                </span>
              </span>
            </label>
          </div>
        ) : current.project ? (
          <div className="mt-4 text-sm text-slate-600">
            Проект: <span className="font-medium text-slate-900">{current.project.title}</span>
          </div>
        ) : null}

        {canWrite && current.status !== "AGENT_RUNNING" ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {["DONE", "CANCELLED"].includes(current.status) ? (
              <button
                type="button"
                onClick={() => openTransitionDialog("PLANNED")}
                disabled={pending}
                className="flex h-10 items-center gap-2 rounded-lg border border-blue-300 px-3 text-sm font-medium text-blue-700 disabled:opacity-50"
              >
                <RotateCcw className="h-4 w-4" />
                Открыть повторно
              </button>
            ) : (
              <>
                {transitionTargets[current.status].includes("DONE") ? (
                  <button
                    type="button"
                    onClick={() => openTransitionDialog("DONE")}
                    disabled={pending}
                    className="flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-3 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    <Check className="h-4 w-4" />
                    Завершить
                  </button>
                ) : null}
                {transitionTargets[current.status].includes("BLOCKED") ? (
                  <button
                    type="button"
                    onClick={() => openTransitionDialog("BLOCKED")}
                    disabled={pending}
                    className="flex h-10 items-center gap-2 rounded-lg border border-amber-300 px-3 text-sm font-medium text-amber-800 disabled:opacity-50"
                  >
                    <CircleSlash2 className="h-4 w-4" />
                    Заблокировать
                  </button>
                ) : null}
                {transitionTargets[current.status].includes("CANCELLED") ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm("Убрать задачу с доски? Её история сохранится.")) {
                        void transition("CANCELLED", "Убрано с доски пользователем.");
                      }
                    }}
                    disabled={pending}
                    className="flex h-10 items-center gap-2 rounded-lg border border-red-200 px-3 text-sm font-medium text-red-700 disabled:opacity-50"
                  >
                    <X className="h-4 w-4" />
                    Убрать
                  </button>
                ) : null}
              </>
            )}
          </div>
        ) : null}

        {error ? (
          <div
            role="alert"
            className="mt-4 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            <X className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        ) : null}

        {current.telegramSource ? (
          <section className="mt-5 rounded-xl border border-sky-200 bg-sky-50/50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <MessageSquareText className="h-5 w-5 text-sky-600" />
                <h3 className="text-sm font-semibold text-slate-900">Источник из Telegram</h3>
              </div>
              <Link
                href={`/admin/operations/inbox?selected=${encodeURIComponent(
                  current.telegramSource.inboxItemId
                )}`}
                className="text-xs font-medium text-sky-700 hover:underline"
              >
                Открыть сообщение
              </Link>
            </div>
            {current.telegramSource.isForwarded && current.telegramSource.forwardedFrom ? (
              <p className="mt-3 text-xs font-medium text-slate-500">
                Переслано от {current.telegramSource.forwardedFrom}
              </p>
            ) : null}
            {current.telegramSource.replyTo?.text ? (
              <div className="mt-3 rounded-lg border border-sky-100 bg-white/70 px-3 py-2">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Ответ на сообщение
                  {current.telegramSource.replyTo.sender
                    ? ` · ${current.telegramSource.replyTo.sender}`
                    : ""}
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-5 text-slate-600">
                  {current.telegramSource.replyTo.text}
                </p>
              </div>
            ) : null}
            {current.telegramSource.originalMessage ? (
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-800">
                {current.telegramSource.originalMessage}
              </p>
            ) : null}
            {!audioAttachments.length && current.telegramSource.transcription ? (
              <p className="mt-3 border-t border-sky-100 pt-3 text-sm leading-6 text-slate-600">
                {current.telegramSource.transcription}
              </p>
            ) : null}
          </section>
        ) : null}

        {audioAttachments.length ? (
          <section className="mt-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <Send className="h-5 w-5 shrink-0 text-sky-500" />
                <h3 className="truncate text-sm font-semibold">
                  Голосовые из Telegram · {audioAttachments.length}
                </h3>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {audioAttachments.map((attachment, index) => (
                <div key={attachment.id}>
                  <div className="mb-1 flex items-center justify-between gap-3 text-xs text-slate-500">
                    <span>Голосовое {index + 1}</span>
                    <span className="truncate">{attachment.fileName}</span>
                  </div>
                  <audio
                    className="h-10 w-full"
                    controls
                    preload="none"
                    src={
                      demoMode
                        ? undefined
                        : `/api/admin/operations/tasks/${current.id}/attachments/${attachment.id}/access`
                    }
                  >
                    Ваш браузер не поддерживает аудио.
                  </audio>
                  {attachment.transcription ? (
                    <details className="mt-2 border-t border-slate-100 pt-2">
                      <summary className="cursor-pointer text-xs font-semibold text-slate-700">
                        Транскрипция голосового {index + 1}
                      </summary>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                        {attachment.transcription}
                      </p>
                    </details>
                  ) : null}
                </div>
              ))}
            </div>
            {legacyTranscript ? (
              <div className="mt-3 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setTranscriptOpen((open) => !open)}
                  aria-expanded={transcriptOpen}
                  className="flex w-full items-center justify-between text-left text-sm font-semibold"
                >
                  Транскрипция
                  <ChevronDown
                    className={cn("h-4 w-4 transition-transform", transcriptOpen && "rotate-180")}
                  />
                </button>
                {transcriptOpen ? (
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                    {legacyTranscript}
                  </p>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : null}

        {imageAttachments.length || videoAttachments.length || documentAttachments.length ? (
          <section className="mt-5 border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-blue-600" />
              <h3 className="text-sm font-semibold text-slate-950">
                Вложения ·{" "}
                {imageAttachments.length + videoAttachments.length + documentAttachments.length}
              </h3>
            </div>

            {imageAttachments.length ? (
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {imageAttachments.map((attachment, index) => {
                  const accessUrl = demoMode
                    ? attachment.accessUrl
                    : `/api/admin/operations/tasks/${current.id}/attachments/${attachment.id}/access`;
                  return (
                    <button
                      key={attachment.id}
                      type="button"
                      onClick={() => setPreviewAttachment(attachment)}
                      className="group relative aspect-[4/3] overflow-hidden border border-slate-200 bg-slate-100 text-left focus-visible:outline-2 focus-visible:outline-blue-500"
                      aria-label={`Открыть изображение ${attachment.fileName ?? index + 1}`}
                    >
                      {accessUrl ? (
                        // Protected attachment URLs cannot be fetched by the Next image optimizer.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={accessUrl}
                          alt={attachment.fileName ?? `Вложение ${index + 1}`}
                          loading="lazy"
                          className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.02]"
                        />
                      ) : (
                        <span className="flex h-full items-center justify-center text-xs text-slate-500">
                          Фото недоступно в демо
                        </span>
                      )}
                      <span className="absolute inset-x-0 bottom-0 truncate bg-slate-950/70 px-2 py-1.5 text-[11px] text-white">
                        {attachment.fileName ?? `Фото ${index + 1}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null}

            {videoAttachments.length ? (
              <div className="mt-4 space-y-3">
                {videoAttachments.map((attachment) => {
                  const accessUrl = demoMode
                    ? attachment.accessUrl
                    : `/api/admin/operations/tasks/${current.id}/attachments/${attachment.id}/access`;
                  return (
                    <div key={attachment.id} className="border border-slate-200 bg-slate-50 p-3">
                      <div className="mb-2 flex items-center gap-2 text-xs text-slate-600">
                        <Video className="h-4 w-4" />
                        <span className="truncate">{attachment.fileName ?? "Видео"}</span>
                      </div>
                      {accessUrl ? (
                        <video
                          className="max-h-80 w-full bg-black"
                          controls
                          preload="none"
                          src={accessUrl}
                        >
                          Ваш браузер не поддерживает видео.
                        </video>
                      ) : null}
                      {attachment.transcription ? (
                        <details className="mt-2 border-t border-slate-200 pt-2">
                          <summary className="cursor-pointer text-xs font-semibold text-slate-700">
                            Транскрипция видеосообщения
                          </summary>
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                            {attachment.transcription}
                          </p>
                        </details>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}

            {documentAttachments.length ? (
              <div className="mt-4 divide-y divide-slate-100 border border-slate-200">
                {documentAttachments.map((attachment) => {
                  const accessUrl = demoMode
                    ? attachment.accessUrl
                    : `/api/admin/operations/tasks/${current.id}/attachments/${attachment.id}/access`;
                  const size = Number(attachment.sizeBytes);
                  const sizeLabel = Number.isFinite(size)
                    ? size < 1024 * 1024
                      ? `${Math.max(1, Math.round(size / 1024))} КБ`
                      : `${(size / (1024 * 1024)).toFixed(1)} МБ`
                    : null;
                  return (
                    <div key={attachment.id} className="flex min-w-0 items-center gap-3 px-3 py-3">
                      <FileText className="h-5 w-5 shrink-0 text-slate-500" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-slate-800">
                          {attachment.fileName ?? "Документ"}
                        </div>
                        <div className="mt-0.5 text-xs text-slate-500">
                          {[attachment.mimeType, sizeLabel].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                      {accessUrl ? (
                        <a
                          href={accessUrl}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Открыть ${attachment.fileName ?? "документ"}`}
                          className="flex h-9 w-9 shrink-0 items-center justify-center border border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-700"
                        >
                          <Download className="h-4 w-4" />
                        </a>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </section>
        ) : null}

        {!editOpen && current.nextAction ? (
          <section className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-blue-700">
              Следующее действие
            </div>
            <p className="mt-1 text-sm leading-6 text-slate-800">{current.nextAction}</p>
          </section>
        ) : current.blockerDescription ? (
          <section className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">
              Причина ожидания
            </div>
            <p className="mt-1 text-sm leading-6 text-slate-800">{current.blockerDescription}</p>
          </section>
        ) : null}

        {canReadKnowledge && (current.knowledgeLinks?.length || canLinkKnowledge) ? (
          <section className="mt-5 border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-blue-600" />
                <h3 className="text-sm font-semibold">Справочник и материалы задачи</h3>
              </div>
              {canLinkKnowledge ? (
                <button
                  type="button"
                  onClick={() => void openKnowledgePicker()}
                  className="flex h-9 items-center gap-1.5 rounded-lg border border-blue-200 px-3 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Прикрепить статью
                </button>
              ) : null}
            </div>
            {current.knowledgeLinks?.length ? (
              <div className="mt-3 space-y-2">
                {current.knowledgeLinks.map(({ article }) => (
                  <div
                    key={article.id}
                    className="flex items-center gap-2 rounded-lg border border-slate-200 p-1.5 transition hover:border-blue-300 hover:bg-blue-50/40"
                  >
                    <Link
                      href={
                        article.tags.includes("brand-guide") && article.brandKey
                          ? `/admin/operations/directory/${article.brandKey}`
                          : `/admin/operations/knowledge/${article.id}`
                      }
                      className="flex min-w-0 flex-1 items-center gap-3 px-1.5 py-1.5"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white">
                        <FileText className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        {article.tags.includes("brand-guide") ? (
                          <span
                            className={cn(
                              "mb-1 block text-[10px] font-bold uppercase tracking-wide",
                              article.tags.includes("formula-available")
                                ? "text-emerald-700"
                                : "text-amber-700"
                            )}
                          >
                            {article.tags.includes("formula-available")
                              ? "Формула бренда · проверить актуальность"
                              : "Формула бренда не подтверждена"}
                          </span>
                        ) : article.tags.includes("shipping-reference") ? (
                          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-blue-700">
                            Ориентиры доставки · проверить актуальность
                          </span>
                        ) : null}
                        <span className="block truncate text-sm font-medium">{article.title}</span>
                        <span className="mt-0.5 block text-xs text-slate-500">
                          {article.category}
                        </span>
                      </span>
                      <ExternalLink className="h-4 w-4 text-slate-400" />
                    </Link>
                    {canLinkKnowledge ? (
                      <button
                        type="button"
                        onClick={() => void unlinkKnowledge(article.id)}
                        disabled={pending}
                        aria-label={`Отвязать статью ${article.title}`}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      >
                        <Unlink className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">
                Прикрепите инструкцию, которая поможет выполнить задачу.
              </p>
            )}
          </section>
        ) : null}

        {!editOpen && current.definitionOfDone ? (
          <section className="mt-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Clipboard className="h-4 w-4 text-emerald-600" />
              Готово, когда
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{current.definitionOfDone}</p>
          </section>
        ) : null}

        <OpsTaskAutomation
          task={current}
          canRunAutomation={canRunAutomation && canWrite}
          automationsEnabled={automationsEnabled}
          canDecideApprovals={canDecideApprovals}
          demoMode={demoMode}
          onTaskChange={(updated) => {
            setCurrent(updated);
            onTaskChange?.(updated);
          }}
        />

        {progressUpdates.length ? (
          <section className="mt-5 border border-blue-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-blue-100 px-4 py-3">
              <Activity className="h-5 w-5 text-blue-600" />
              <h3 className="text-sm font-semibold">Прогресс</h3>
              <span className="text-xs text-slate-500">· {progressUpdates.length}</span>
            </div>
            <ol className="divide-y divide-slate-100">
              {progressUpdates.map((event) => (
                <li key={event.id} className="grid grid-cols-[auto_1fr] gap-3 px-4 py-3">
                  <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-[11px] font-semibold text-blue-700">
                    {initials(event.actor?.name)}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-medium text-slate-600">
                        {event.actor?.name || "Система"}
                      </span>
                      <time dateTime={event.createdAt} className="text-xs text-slate-400">
                        {new Intl.DateTimeFormat("ru-RU", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        }).format(new Date(event.createdAt))}
                      </time>
                    </div>
                    <p
                      className={cn(
                        "mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-800",
                        event.reverted && "text-slate-400 line-through"
                      )}
                    >
                      {event.update}
                    </p>
                    {event.reverted ? (
                      <span className="mt-1 inline-block text-[11px] font-medium text-amber-700">
                        Обновление отменено
                      </span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        <section className="mt-5 rounded-xl border border-slate-200 bg-white shadow-sm">
          <button
            type="button"
            onClick={() => setActivityOpen((open) => !open)}
            aria-expanded={activityOpen}
            className="flex w-full items-center gap-3 px-4 py-4 text-left"
          >
            <Activity className="h-5 w-5 text-teal-600" />
            <span className="flex-1 text-sm font-semibold">
              Активность{" "}
              <span className="font-normal text-slate-500">· {activity.length} событий</span>
            </span>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-slate-500 transition-transform",
                activityOpen && "rotate-180"
              )}
            />
          </button>
          {activityOpen ? (
            <div className="border-t border-slate-100 px-4 py-3">
              {activity.length ? (
                <ol className="space-y-4">
                  {activity.map((event) => (
                    <li key={event.id} className="flex gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-medium">
                        {initials(event.actor?.name)}
                      </span>
                      <div className="min-w-0 text-sm">
                        <p className="text-slate-700">
                          <span className="font-medium">{event.actor?.name || "Система"}</span>{" "}
                          {event.type === "CREATED"
                            ? "создал(а) задачу"
                            : event.type === "ATTACHMENT_ADDED"
                              ? "прикрепил(а) файл"
                              : "обновил(а) задачу"}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-400">
                          {new Intl.DateTimeFormat("ru-RU", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          }).format(new Date(event.createdAt))}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-slate-500">История появится после первого изменения.</p>
              )}
            </div>
          ) : null}
        </section>

        <section className="mt-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <MessageSquareText className="h-4 w-4 text-blue-600" />
            Комментарии
          </h3>
          {current.comments?.length ? (
            <ol className="mt-3 space-y-3">
              {current.comments.map((comment) => (
                <li key={comment.id} className="rounded-lg bg-slate-50 px-3 py-2.5">
                  <div className="flex items-center justify-between gap-3 text-xs text-slate-400">
                    <span className="font-medium text-slate-600">
                      {comment.author?.name || "Сотрудник"}
                    </span>
                    <time dateTime={comment.createdAt}>
                      {new Intl.DateTimeFormat("ru-RU", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      }).format(new Date(comment.createdAt))}
                    </time>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-5 text-slate-700">
                    {comment.text}
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-3 text-sm text-slate-500">Комментариев пока нет.</p>
          )}
          {canWrite ? (
            <div className="mt-3 flex gap-2">
              <input
                aria-label="Новый комментарий"
                value={commentText}
                onChange={(event) => setCommentText(event.target.value)}
                onKeyDown={(event) => {
                  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                    void addComment();
                  }
                }}
                placeholder="Добавить комментарий…"
                className="h-10 min-w-0 flex-1 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
              <button
                type="button"
                onClick={() => void addComment()}
                disabled={pending || !commentText.trim()}
                className="flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">Отправить</span>
              </button>
            </div>
          ) : null}
        </section>
      </div>

      {previewAttachment ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/90 p-3 sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label="Просмотр изображения"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPreviewAttachment(null);
          }}
        >
          <button
            type="button"
            onClick={() => setPreviewAttachment(null)}
            aria-label="Закрыть изображение"
            className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center bg-white/10 text-white hover:bg-white/20 sm:right-6 sm:top-6"
          >
            <X className="h-6 w-6" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={
              demoMode
                ? previewAttachment.accessUrl
                : `/api/admin/operations/tasks/${current.id}/attachments/${previewAttachment.id}/access`
            }
            alt={previewAttachment.fileName ?? "Вложение задачи"}
            className="max-h-[88vh] max-w-full object-contain"
          />
          <div className="absolute inset-x-16 bottom-3 truncate text-center text-xs text-white/80 sm:bottom-6">
            {previewAttachment.fileName}
          </div>
        </div>
      ) : null}

      {!compact && canWrite && current.status !== "AGENT_RUNNING" ? (
        <div className="sticky bottom-0 z-30 grid grid-cols-2 gap-3 border-t border-slate-200 bg-white/95 px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
          {["DONE", "CANCELLED"].includes(current.status) ? (
            <button
              type="button"
              onClick={() => openTransitionDialog("PLANNED")}
              className="col-span-2 flex h-12 items-center justify-center gap-2 rounded-lg bg-blue-600 text-sm font-semibold text-white"
            >
              <RotateCcw className="h-5 w-5" />
              Открыть повторно
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() =>
                  openTransitionDialog(
                    transitionTargets[current.status].includes("BLOCKED") ? "BLOCKED" : "CANCELLED"
                  )
                }
                className="h-12 rounded-lg border border-slate-400 text-sm font-medium text-slate-800"
              >
                {transitionTargets[current.status].includes("BLOCKED")
                  ? "Заблокировать"
                  : "Отменить"}
              </button>
              <button
                type="button"
                onClick={() =>
                  openTransitionDialog(
                    transitionTargets[current.status].includes("DONE")
                      ? "DONE"
                      : transitionTargets[current.status].includes("IN_PROGRESS")
                        ? "IN_PROGRESS"
                        : "PLANNED"
                  )
                }
                className="flex h-12 items-center justify-center gap-2 rounded-lg bg-blue-600 text-sm font-semibold text-white"
              >
                <Check className="h-5 w-5" />
                {transitionTargets[current.status].includes("DONE")
                  ? "Готово"
                  : transitionTargets[current.status].includes("IN_PROGRESS")
                    ? "В работу"
                    : "Запланировать"}
              </button>
            </>
          )}
        </div>
      ) : null}

      {transitionDialogStatus ? (
        <div
          className="fixed inset-0 z-[88] flex items-end bg-slate-950/50 p-0 backdrop-blur-[2px] sm:items-center sm:justify-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ops-task-transition-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !pending) {
              setTransitionDialogStatus(null);
            }
          }}
        >
          <div className="w-full rounded-t-2xl bg-white p-5 shadow-2xl sm:max-w-lg sm:rounded-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="ops-task-transition-title" className="text-lg font-bold text-slate-950">
                  Изменить статус
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  «{OPS_STATUS_LABELS[current.status]}» → «
                  {OPS_STATUS_LABELS[transitionDialogStatus]}»
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTransitionDialogStatus(null)}
                disabled={pending}
                aria-label="Закрыть"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              {transitionNeedsNextAction ? (
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">
                    Следующее действие <span className="text-red-600">*</span>
                  </span>
                  <textarea
                    value={transitionNextAction}
                    onChange={(event) => {
                      setTransitionNextAction(event.target.value);
                      setError(null);
                    }}
                    rows={3}
                    placeholder="Конкретный следующий шаг без выдуманных значений"
                    className="mt-2 w-full resize-y rounded-lg border border-slate-300 p-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </label>
              ) : null}

              {transitionIsWaiting ? (
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">
                    Причина ожидания или блокировки{" "}
                    <span className="font-normal text-slate-400">(необязательно)</span>
                  </span>
                  <textarea
                    value={transitionBlockerDescription}
                    onChange={(event) => {
                      setTransitionBlockerDescription(event.target.value);
                      setError(null);
                    }}
                    rows={3}
                    placeholder="Что именно мешает продолжить работу?"
                    className="mt-2 w-full resize-y rounded-lg border border-slate-300 p-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </label>
              ) : null}

              {transitionNeedsComment ? (
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">
                    {transitionIsReopening ? "Причина повторного открытия" : "Причина отмены"}{" "}
                    <span className="text-red-600">*</span>
                  </span>
                  <textarea
                    value={transitionComment}
                    onChange={(event) => {
                      setTransitionComment(event.target.value);
                      setError(null);
                    }}
                    rows={3}
                    placeholder="Комментарий сохранится в истории задачи"
                    className="mt-2 w-full resize-y rounded-lg border border-slate-300 p-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </label>
              ) : null}

              {!transitionNeedsNextAction && !transitionIsWaiting && !transitionNeedsComment ? (
                <p className="rounded-lg bg-slate-50 px-3 py-3 text-sm leading-6 text-slate-600">
                  Подтвердите изменение. Оно будет сохранено в истории задачи и журнале аудита.
                </p>
              ) : null}
            </div>

            {error ? (
              <div
                role="alert"
                className="mt-4 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                <X className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                {error}
              </div>
            ) : null}

            <div className="mt-5 flex justify-end gap-2 pb-[env(safe-area-inset-bottom)]">
              <button
                type="button"
                onClick={() => setTransitionDialogStatus(null)}
                disabled={pending}
                className="h-10 rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 disabled:opacity-50"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={() => void transition(transitionDialogStatus)}
                disabled={pending || !transitionFormValid}
                className="flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Check className="h-4 w-4" aria-hidden="true" />
                )}
                Подтвердить
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {knowledgePickerOpen ? (
        <div
          className="fixed inset-0 z-[80] flex items-end bg-slate-950/45 p-0 backdrop-blur-[2px] sm:items-center sm:justify-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ops-knowledge-picker-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setKnowledgePickerOpen(false);
          }}
        >
          <div className="w-full rounded-t-2xl bg-white p-5 shadow-2xl sm:max-w-lg sm:rounded-2xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 id="ops-knowledge-picker-title" className="text-lg font-bold text-slate-950">
                  Прикрепить статью
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Материал будет виден всем, у кого есть доступ к задаче и БАЗЕ.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setKnowledgePickerOpen(false)}
                aria-label="Закрыть"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {knowledgeLoading ? (
              <div className="mt-5 flex h-24 items-center justify-center text-sm text-slate-500">
                Загрузка БАЗЫ…
              </div>
            ) : (
              <label className="mt-5 block">
                <span className="text-sm font-medium text-slate-700">Статья</span>
                <select
                  value={selectedKnowledgeId}
                  onChange={(event) => setSelectedKnowledgeId(event.target.value)}
                  className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-500"
                >
                  <option value="">Выберите материал</option>
                  {knowledgeArticles
                    .filter(
                      (article) =>
                        article.status === "PUBLISHED" &&
                        !current.knowledgeLinks?.some((link) => link.article.id === article.id)
                    )
                    .map((article) => (
                      <option key={article.id} value={article.id}>
                        {article.title}
                      </option>
                    ))}
                </select>
              </label>
            )}
            <div className="mt-5 flex justify-end gap-2 pb-[env(safe-area-inset-bottom)]">
              <button
                type="button"
                onClick={() => setKnowledgePickerOpen(false)}
                className="h-10 rounded-lg border border-slate-300 px-4 text-sm font-medium"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={() => void linkKnowledge(selectedKnowledgeId)}
                disabled={!selectedKnowledgeId || pending}
                className="flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                <Link2 className="h-4 w-4" />
                Прикрепить
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}
