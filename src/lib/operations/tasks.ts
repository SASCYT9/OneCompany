import {
  OpsBlockerType,
  OpsExecutorType,
  OpsPriority,
  OpsTaskSourceType,
  OpsTaskStatus,
} from "@prisma/client";
import { OpsError } from "@/lib/operations/errors";

export const OPS_DEFAULT_TASK_DUE_MS = 24 * 60 * 60 * 1000;

export function resolveOpsTaskDueAt(dueAt: Date | null, now: Date = new Date()) {
  return dueAt ?? new Date(now.getTime() + OPS_DEFAULT_TASK_DUE_MS);
}

const ACTIVE_WITH_NEXT_ACTION = new Set<OpsTaskStatus>([OpsTaskStatus.AGENT_RUNNING]);

const API_TRANSITIONS: Record<OpsTaskStatus, readonly OpsTaskStatus[]> = {
  INBOX: [
    OpsTaskStatus.PLANNED,
    OpsTaskStatus.IN_PROGRESS,
    OpsTaskStatus.WAITING_HUMAN,
    OpsTaskStatus.WAITING_EXTERNAL,
    OpsTaskStatus.NEEDS_APPROVAL,
    OpsTaskStatus.REVIEW,
    OpsTaskStatus.BLOCKED,
    OpsTaskStatus.DONE,
    OpsTaskStatus.CANCELLED,
  ],
  PLANNED: [
    OpsTaskStatus.INBOX,
    OpsTaskStatus.IN_PROGRESS,
    OpsTaskStatus.WAITING_HUMAN,
    OpsTaskStatus.WAITING_EXTERNAL,
    OpsTaskStatus.NEEDS_APPROVAL,
    OpsTaskStatus.REVIEW,
    OpsTaskStatus.BLOCKED,
    OpsTaskStatus.DONE,
    OpsTaskStatus.CANCELLED,
  ],
  IN_PROGRESS: [
    OpsTaskStatus.INBOX,
    OpsTaskStatus.PLANNED,
    OpsTaskStatus.WAITING_HUMAN,
    OpsTaskStatus.WAITING_EXTERNAL,
    OpsTaskStatus.NEEDS_APPROVAL,
    OpsTaskStatus.REVIEW,
    OpsTaskStatus.BLOCKED,
    OpsTaskStatus.DONE,
    OpsTaskStatus.CANCELLED,
  ],
  AGENT_RUNNING: [
    OpsTaskStatus.IN_PROGRESS,
    OpsTaskStatus.WAITING_HUMAN,
    OpsTaskStatus.WAITING_EXTERNAL,
    OpsTaskStatus.NEEDS_APPROVAL,
    OpsTaskStatus.REVIEW,
    OpsTaskStatus.BLOCKED,
    OpsTaskStatus.DONE,
    OpsTaskStatus.CANCELLED,
  ],
  WAITING_HUMAN: [
    OpsTaskStatus.INBOX,
    OpsTaskStatus.PLANNED,
    OpsTaskStatus.IN_PROGRESS,
    OpsTaskStatus.WAITING_EXTERNAL,
    OpsTaskStatus.NEEDS_APPROVAL,
    OpsTaskStatus.REVIEW,
    OpsTaskStatus.BLOCKED,
    OpsTaskStatus.DONE,
    OpsTaskStatus.CANCELLED,
  ],
  WAITING_EXTERNAL: [
    OpsTaskStatus.INBOX,
    OpsTaskStatus.PLANNED,
    OpsTaskStatus.IN_PROGRESS,
    OpsTaskStatus.WAITING_HUMAN,
    OpsTaskStatus.NEEDS_APPROVAL,
    OpsTaskStatus.REVIEW,
    OpsTaskStatus.BLOCKED,
    OpsTaskStatus.DONE,
    OpsTaskStatus.CANCELLED,
  ],
  NEEDS_APPROVAL: [
    OpsTaskStatus.INBOX,
    OpsTaskStatus.PLANNED,
    OpsTaskStatus.IN_PROGRESS,
    OpsTaskStatus.WAITING_HUMAN,
    OpsTaskStatus.WAITING_EXTERNAL,
    OpsTaskStatus.REVIEW,
    OpsTaskStatus.BLOCKED,
    OpsTaskStatus.DONE,
    OpsTaskStatus.CANCELLED,
  ],
  REVIEW: [
    OpsTaskStatus.INBOX,
    OpsTaskStatus.PLANNED,
    OpsTaskStatus.IN_PROGRESS,
    OpsTaskStatus.WAITING_HUMAN,
    OpsTaskStatus.WAITING_EXTERNAL,
    OpsTaskStatus.NEEDS_APPROVAL,
    OpsTaskStatus.BLOCKED,
    OpsTaskStatus.DONE,
    OpsTaskStatus.CANCELLED,
  ],
  BLOCKED: [
    OpsTaskStatus.INBOX,
    OpsTaskStatus.PLANNED,
    OpsTaskStatus.IN_PROGRESS,
    OpsTaskStatus.WAITING_HUMAN,
    OpsTaskStatus.WAITING_EXTERNAL,
    OpsTaskStatus.NEEDS_APPROVAL,
    OpsTaskStatus.REVIEW,
    OpsTaskStatus.DONE,
    OpsTaskStatus.CANCELLED,
  ],
  DONE: [],
  CANCELLED: [],
};

function optionalText(value: unknown, maxLength = 20_000) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  if (!normalized) return null;
  if (normalized.length > maxLength) {
    throw new OpsError("VALIDATION_ERROR", 400, `Text exceeds ${maxLength} characters`);
  }
  return normalized;
}

function requiredText(value: unknown, label: string, maxLength = 500) {
  const normalized = optionalText(value, maxLength);
  if (!normalized) {
    throw new OpsError("VALIDATION_ERROR", 400, `${label} is required`);
  }
  return normalized;
}

function enumValue<T extends Record<string, string>>(
  enumObject: T,
  value: unknown,
  fallback: T[keyof T]
) {
  const normalized = String(value ?? fallback)
    .trim()
    .toUpperCase();
  if (!Object.values(enumObject).includes(normalized as T[keyof T])) {
    throw new OpsError("VALIDATION_ERROR", 400, `Unsupported enum value: ${normalized}`);
  }
  return normalized as T[keyof T];
}

function dateValue(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    throw new OpsError("VALIDATION_ERROR", 400, "Invalid date");
  }
  return date;
}

export function normalizeOpsTaskTags(value: unknown) {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap((item) => {
    const tag = optionalText(item, 100);
    if (!tag) return [];
    const key = tag.toLocaleLowerCase("uk-UA");
    if (seen.has(key) || seen.size >= 20) return [];
    seen.add(key);
    return [tag];
  });
}

export type OpsTaskStateInput = {
  status: OpsTaskStatus;
  nextAction: string | null;
  blockerType: OpsBlockerType | null;
  blockerDescription: string | null;
};

export function assertTaskStateInvariant(input: OpsTaskStateInput) {
  if (ACTIVE_WITH_NEXT_ACTION.has(input.status) && !input.nextAction) {
    throw new OpsError("NEXT_ACTION_REQUIRED", 409, "An active task must have a clear next action");
  }
}

export function normalizeTaskCreateInput(body: unknown) {
  const input = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const status = enumValue(OpsTaskStatus, input.status, OpsTaskStatus.INBOX);
  if (status === OpsTaskStatus.AGENT_RUNNING) {
    throw new OpsError(
      "WORKER_STATUS_ONLY",
      409,
      "agent_running can only be set by an automation worker"
    );
  }
  const isShared = input.isShared === true;
  const normalized = {
    title: requiredText(input.title, "Task title"),
    description: optionalText(input.description),
    tags: normalizeOpsTaskTags(input.tags),
    status,
    priority: enumValue(OpsPriority, input.priority, OpsPriority.NORMAL),
    executorType: enumValue(OpsExecutorType, input.executorType, OpsExecutorType.HUMAN),
    projectId: optionalText(input.projectId, 100),
    shopOrderId: optionalText(input.shopOrderId, 100),
    parentTaskId: optionalText(input.parentTaskId, 100),
    assigneeId: isShared ? null : optionalText(input.assigneeId, 100),
    isShared,
    dueAt: dateValue(input.dueAt),
    nextAction: optionalText(input.nextAction, 2_000),
    definitionOfDone: optionalText(input.definitionOfDone, 5_000),
    blockerType: input.blockerType
      ? enumValue(OpsBlockerType, input.blockerType, OpsBlockerType.OTHER)
      : null,
    blockerDescription: optionalText(input.blockerDescription, 2_000),
    sourceType: enumValue(OpsTaskSourceType, input.sourceType, OpsTaskSourceType.ADMIN),
    sourceId: optionalText(input.sourceId, 200),
    sourceKey: optionalText(input.sourceKey, 300),
  };
  assertTaskStateInvariant(normalized);
  return normalized;
}

export function normalizeTaskPatchInput(body: unknown) {
  const input = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  if ("title" in input) result.title = requiredText(input.title, "Task title");
  if ("description" in input) result.description = optionalText(input.description);
  if ("tags" in input) result.tags = normalizeOpsTaskTags(input.tags);
  if ("priority" in input) {
    result.priority = enumValue(OpsPriority, input.priority, OpsPriority.NORMAL);
  }
  if ("executorType" in input) {
    result.executorType = enumValue(OpsExecutorType, input.executorType, OpsExecutorType.HUMAN);
  }
  for (const field of ["projectId", "shopOrderId", "parentTaskId", "assigneeId"] as const) {
    if (field in input) result[field] = optionalText(input[field], 100);
  }
  if ("isShared" in input) {
    if (typeof input.isShared !== "boolean") {
      throw new OpsError("VALIDATION_ERROR", 400, "Shared task flag must be boolean");
    }
    result.isShared = input.isShared;
    if (input.isShared) result.assigneeId = null;
  }
  if (result.assigneeId) result.isShared = false;
  if ("dueAt" in input) result.dueAt = dateValue(input.dueAt);
  if ("nextAction" in input) result.nextAction = optionalText(input.nextAction, 2_000);
  if ("definitionOfDone" in input) {
    result.definitionOfDone = optionalText(input.definitionOfDone, 5_000);
  }
  if ("blockerType" in input) {
    result.blockerType = input.blockerType
      ? enumValue(OpsBlockerType, input.blockerType, OpsBlockerType.OTHER)
      : null;
  }
  if ("blockerDescription" in input) {
    result.blockerDescription = optionalText(input.blockerDescription, 2_000);
  }
  if (!Object.keys(result).length) {
    throw new OpsError("VALIDATION_ERROR", 400, "No supported task fields were supplied");
  }
  return result;
}

export function normalizeTaskTransitionInput(body: unknown) {
  const input = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const status = enumValue(OpsTaskStatus, input.status, OpsTaskStatus.INBOX);
  if (status === OpsTaskStatus.AGENT_RUNNING) {
    throw new OpsError(
      "WORKER_STATUS_ONLY",
      409,
      "agent_running can only be set by an automation worker"
    );
  }
  return {
    status,
    nextAction: optionalText(input.nextAction, 2_000),
    blockerType: input.blockerType
      ? enumValue(OpsBlockerType, input.blockerType, OpsBlockerType.OTHER)
      : null,
    blockerDescription: optionalText(input.blockerDescription, 2_000),
    comment: optionalText(input.comment, 2_000),
    reopen: input.reopen === true,
  };
}

export function assertTaskTransition(
  from: OpsTaskStatus,
  to: OpsTaskStatus,
  options: { reopen: boolean; comment: string | null }
) {
  if (from === to) {
    throw new OpsError("INVALID_TRANSITION", 409, "Task already has this status");
  }
  if (from === OpsTaskStatus.DONE || from === OpsTaskStatus.CANCELLED) {
    if (!options.reopen || !options.comment) {
      throw new OpsError(
        "REOPEN_COMMENT_REQUIRED",
        409,
        "Completed or cancelled tasks require an explicit reopen action and comment"
      );
    }
    if (to !== OpsTaskStatus.PLANNED && to !== OpsTaskStatus.IN_PROGRESS) {
      throw new OpsError(
        "INVALID_TRANSITION",
        409,
        "A closed task can only be reopened as planned or in progress"
      );
    }
    return;
  }
  if (!API_TRANSITIONS[from].includes(to)) {
    throw new OpsError(
      "INVALID_TRANSITION",
      409,
      `Transition from ${from} to ${to} is not allowed`
    );
  }
}

export function isClosedTaskStatus(status: OpsTaskStatus) {
  return status === OpsTaskStatus.DONE || status === OpsTaskStatus.CANCELLED;
}
