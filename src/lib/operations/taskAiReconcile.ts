import "server-only";

import {
  OpsJobStage,
  OpsJobStatus,
  OpsTaskEventType,
  OpsTaskSourceType,
  Prisma,
  type OpsJob,
  type PrismaClient,
} from "@prisma/client";

import {
  createPrismaOpsAiBudget,
  extractOpsProposalWithAi,
  type OpsExtractedTask,
} from "@/lib/operations/ai";
import { ADMIN_PERMISSIONS, matchesAdminPermission } from "@/lib/admin/adminPermissions";
import {
  linkMatchingBrandGuides,
  opsBrandProperNameHintsForClient,
} from "@/lib/operations/brandGuides";

export const OPS_TASK_AI_RECONCILE_JOB = "task_ai_reconcile";

type TaskAiReconcileTrigger = "comment" | "admin_edit" | "telegram_update";

type TaskAiReconcilePayload = {
  taskId: string;
  sourceVersion: number;
  trigger: TaskAiReconcileTrigger;
  actorId: string;
  commentId?: string | null;
  inboxItemId?: string | null;
  directive?: string | null;
};

type OpsJobClient = Prisma.TransactionClient | PrismaClient;

function cleanDirective(value: unknown) {
  const text = String(value ?? "")
    .replace(/\u0000/g, "")
    .trim();
  return text ? text.slice(0, 10_000) : null;
}

function parseTaskAiReconcilePayload(job: OpsJob): TaskAiReconcilePayload {
  const input =
    job.payload && typeof job.payload === "object" ? (job.payload as Record<string, unknown>) : {};
  const taskId = String(input.taskId ?? job.taskId ?? "").trim();
  const sourceVersion = Number(input.sourceVersion);
  const actorId = String(input.actorId ?? "").trim();
  const trigger = String(input.trigger ?? "") as TaskAiReconcileTrigger;
  if (
    !taskId ||
    !actorId ||
    !Number.isInteger(sourceVersion) ||
    sourceVersion < 1 ||
    !["comment", "admin_edit", "telegram_update"].includes(trigger)
  ) {
    throw new Error("OPS_TASK_AI_RECONCILE_PAYLOAD_INVALID");
  }
  return {
    taskId,
    sourceVersion,
    actorId,
    trigger,
    commentId: input.commentId ? String(input.commentId) : null,
    inboxItemId: input.inboxItemId ? String(input.inboxItemId) : null,
    directive: cleanDirective(input.directive),
  };
}

export async function enqueueOpsTaskAiReconcile(input: {
  client: OpsJobClient;
  taskId: string;
  sourceVersion: number;
  trigger: TaskAiReconcileTrigger;
  actorId: string;
  idempotencyKey: string;
  commentId?: string | null;
  inboxItemId?: string | null;
  directive?: string | null;
}) {
  const payload = {
    taskId: input.taskId,
    sourceVersion: input.sourceVersion,
    trigger: input.trigger,
    actorId: input.actorId,
    commentId: input.commentId ?? null,
    inboxItemId: input.inboxItemId ?? null,
    directive: cleanDirective(input.directive),
  } satisfies TaskAiReconcilePayload;
  return input.client.opsJob.upsert({
    where: { idempotencyKey: input.idempotencyKey },
    create: {
      idempotencyKey: input.idempotencyKey,
      taskId: input.taskId,
      inboxItemId: input.inboxItemId ?? null,
      type: OPS_TASK_AI_RECONCILE_JOB,
      status: OpsJobStatus.QUEUED,
      stage: OpsJobStage.EXTRACT,
      payload: payload as Prisma.InputJsonValue,
      maxAttempts: 4,
    },
    update: {},
    select: { id: true, status: true },
  });
}

function typedTags(task: OpsExtractedTask, current: string[]) {
  const sources: Array<[string, string[]]> = [
    ["brand", task.brand_tags ?? []],
    ["product", task.product_tags ?? []],
    ["process", task.process_tags ?? []],
  ];
  const byPrefix = new Map<string, string[]>(
    sources.map(([prefix, values]) => [
      prefix,
      Array.from(
        new Set(
          values
            .map((value) =>
              String(value)
                .replace(/\u0000/g, "")
                .trim()
                .slice(0, 90)
            )
            .filter(Boolean)
            .map((value) => `${prefix}:${value}`)
        )
      ),
    ])
  );
  const preserved = current.filter((tag) => {
    const match = /^(brand|product|process):/iu.exec(tag);
    return !match || !(byPrefix.get(match[1].toLocaleLowerCase("en-US"))?.length ?? 0);
  });
  return Array.from(
    new Map(
      [...preserved, ...Array.from(byPrefix.values()).flat()].map((tag) => [
        tag.toLocaleLowerCase("en-US"),
        tag,
      ])
    ).values()
  ).slice(0, 50);
}

function proposedSafePatch(
  current: {
    title: string;
    description: string | null;
    nextAction: string | null;
    definitionOfDone: string | null;
    tags: string[];
  },
  proposal: OpsExtractedTask
) {
  const patch: {
    title?: string;
    description?: string;
    nextAction?: string;
    definitionOfDone?: string;
    tags?: string[];
  } = {};
  const title = proposal.title.trim();
  if (title && title !== current.title) patch.title = title;
  if (proposal.description?.trim() && proposal.description.trim() !== current.description) {
    patch.description = proposal.description.trim();
  }
  if (proposal.next_action?.trim() && proposal.next_action.trim() !== current.nextAction) {
    patch.nextAction = proposal.next_action.trim();
  }
  if (
    proposal.definition_of_done?.trim() &&
    proposal.definition_of_done.trim() !== current.definitionOfDone
  ) {
    patch.definitionOfDone = proposal.definition_of_done.trim();
  }
  const tags = typedTags(proposal, current.tags);
  if (JSON.stringify(tags) !== JSON.stringify(current.tags)) patch.tags = tags;
  return patch;
}

function changedFields(patch: Record<string, unknown>) {
  return Object.keys(patch).filter((key) => patch[key] !== undefined);
}

export async function executeOpsTaskAiReconcileJob(input: { client: PrismaClient; job: OpsJob }) {
  const payload = parseTaskAiReconcilePayload(input.job);
  const priorEvent = await input.client.opsTaskEvent.findFirst({
    where: {
      taskId: payload.taskId,
      idempotencyKey: `task-ai-reconcile:${input.job.id}`,
    },
    select: { id: true, payload: true },
  });
  if (priorEvent) {
    return {
      outcome: "succeeded" as const,
      result: {
        applied: true,
        replayed: true,
        eventId: priorEvent.id,
      },
    };
  }
  const task = await input.client.opsTask.findUnique({
    where: { id: payload.taskId },
    select: {
      id: true,
      number: true,
      version: true,
      archivedAt: true,
      title: true,
      description: true,
      tags: true,
      status: true,
      priority: true,
      dueAt: true,
      nextAction: true,
      definitionOfDone: true,
      assigneeId: true,
      assignees: { select: { adminUserId: true } },
      createdById: true,
      isShared: true,
      sourceType: true,
      sourceId: true,
      comments: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          text: true,
          correctsCommentId: true,
          createdAt: true,
          author: { select: { id: true, name: true } },
        },
      },
      attachments: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          attachment: {
            select: {
              id: true,
              fileName: true,
              mimeType: true,
              transcription: true,
              transcriptionLanguage: true,
              inboxItem: { select: { transcription: true } },
            },
          },
        },
      },
      events: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          type: true,
          payload: true,
          createdAt: true,
        },
      },
    },
  });
  if (!task || task.archivedAt) {
    return {
      outcome: "succeeded" as const,
      result: { skipped: "task_missing_or_archived" },
    };
  }
  const actor = await input.client.adminUser.findUnique({
    where: { id: payload.actorId },
    select: {
      id: true,
      name: true,
      email: true,
      isActive: true,
      roles: { select: { role: { select: { permissions: true } } } },
    },
  });
  if (!actor?.isActive) {
    return {
      outcome: "succeeded" as const,
      result: { skipped: "actor_inactive" },
    };
  }
  const actorPermissions = actor.roles.flatMap(({ role }) => role.permissions);
  const canWrite =
    matchesAdminPermission(actorPermissions, ADMIN_PERMISSIONS.OPS_TASKS_WRITE) &&
    (task.isShared ||
      task.createdById === actor.id ||
      task.assigneeId === actor.id ||
      task.assignees.some((assignment) => assignment.adminUserId === actor.id) ||
      matchesAdminPermission(actorPermissions, ADMIN_PERMISSIONS.OPS_TASKS_ASSIGN));
  if (!canWrite) {
    return {
      outcome: "succeeded" as const,
      result: { skipped: "actor_permission_revoked" },
    };
  }
  const triggerComment = payload.commentId
    ? task.comments.find((comment) => comment.id === payload.commentId)
    : null;
  const directive = cleanDirective(payload.directive ?? triggerComment?.text);
  if (!directive) {
    return {
      outcome: "succeeded" as const,
      result: { skipped: "directive_empty" },
    };
  }

  const [properNameHints, telegramSource] = await Promise.all([
    opsBrandProperNameHintsForClient(input.client),
    task.sourceType === OpsTaskSourceType.TELEGRAM && task.sourceId
      ? input.client.opsInboxProposal.findUnique({
          where: { id: task.sourceId },
          select: {
            inboxItem: {
              select: {
                id: true,
                originalMessage: true,
                transcription: true,
              },
            },
          },
        })
      : null,
  ]);
  const modelSourceVersion = task.version;
  const ai = await extractOpsProposalWithAi({
    text: directive,
    context: {
      operation: "task_reconcile",
      sourceVersion: modelSourceVersion,
      queuedSourceVersion: payload.sourceVersion,
      trigger: payload.trigger,
      currentTask: {
        number: task.number,
        title: task.title,
        description: task.description,
        tags: task.tags,
        status: task.status,
        priority: task.priority,
        dueAt: task.dueAt?.toISOString() ?? null,
        nextAction: task.nextAction,
        definitionOfDone: task.definitionOfDone,
      },
      evidence: {
        triggerCommentId: payload.commentId ?? null,
        comments: task.comments
          .slice()
          .reverse()
          .map((comment) => ({
            id: comment.id,
            author: comment.author.name,
            text: comment.text,
            correctsCommentId: comment.correctsCommentId,
            createdAt: comment.createdAt.toISOString(),
          })),
        attachments: task.attachments.map(({ attachment }) => ({
          id: attachment.id,
          fileName: attachment.fileName,
          mimeType: attachment.mimeType,
          transcription: attachment.transcription ?? attachment.inboxItem?.transcription ?? null,
          transcriptionLanguage: attachment.transcriptionLanguage,
        })),
        telegram: telegramSource?.inboxItem ?? null,
        recentEvents: task.events.map((event) => ({
          id: event.id,
          type: event.type,
          createdAt: event.createdAt.toISOString(),
        })),
      },
      properNameHints: properNameHints.slice(0, 600),
      allowedAutoApplyFields: [
        "title",
        "description",
        "nextAction",
        "definitionOfDone",
        "brand_tags",
        "product_tags",
        "process_tags",
      ],
      forbiddenChanges: [
        "assignee",
        "requester",
        "dueAt",
        "status",
        "priority",
        "payment",
        "purchase",
        "checkout",
        "external_message",
      ],
    },
    budget: createPrismaOpsAiBudget(input.client),
  });
  const proposal = ai.value.tasks.length === 1 ? ai.value.tasks[0] : null;
  if (!proposal || ai.value.requires_approval) {
    return {
      outcome: "succeeded" as const,
      result: {
        applied: false,
        reason: !proposal ? "single_proposal_required" : "approval_required",
        model: ai.model,
        confidence: ai.value.confidence,
        ambiguities: ai.value.ambiguities.slice(0, 10),
      },
    };
  }
  const patch = proposedSafePatch(task, proposal);
  const fields = changedFields(patch);
  if (!fields.length) {
    return {
      outcome: "succeeded" as const,
      result: {
        applied: false,
        reason: "no_safe_changes",
        model: ai.model,
        confidence: ai.value.confidence,
      },
    };
  }

  const applied = await input.client.$transaction(async (tx) => {
    const updated = await tx.opsTask.updateMany({
      where: {
        id: task.id,
        version: modelSourceVersion,
        archivedAt: null,
      },
      data: {
        ...patch,
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1) throw new Error("OPS_TASK_AI_RECONCILE_STALE_VERSION");
    const current = await tx.opsTask.findUniqueOrThrow({
      where: { id: task.id },
      select: {
        version: true,
        title: true,
        description: true,
        nextAction: true,
        tags: true,
      },
    });
    const guides = await linkMatchingBrandGuides(tx, {
      taskId: task.id,
      texts: [current.title, current.description, current.nextAction, ...current.tags],
    });
    const evidenceIds = [
      payload.commentId,
      payload.inboxItemId,
      ...task.attachments.map(({ attachment }) => attachment.id),
    ].filter((value): value is string => Boolean(value));
    const event = await tx.opsTaskEvent.create({
      data: {
        taskId: task.id,
        type: OpsTaskEventType.UPDATED,
        actorId: actor.id,
        sourceType: OpsTaskSourceType.AUTOMATION,
        sourceId: input.job.id,
        idempotencyKey: `task-ai-reconcile:${input.job.id}`,
        payload: {
          kind: "ai_reconcile",
          trigger: payload.trigger,
          changedFields: fields,
          sourceVersion: modelSourceVersion,
          version: current.version,
          model: ai.model,
          confidence: ai.value.confidence,
          evidenceIds,
          brandGuideKeys: guides.brandArticles.map((article) => article.brandKey),
        },
      },
      select: { id: true },
    });
    await tx.adminAuditLog.create({
      data: {
        actorId: actor.id,
        actorEmail: actor.email,
        actorName: actor.name,
        scope: "operations",
        action: "task.ai_reconcile.apply",
        entityType: "ops.task",
        entityId: task.id,
        metadata: {
          jobId: input.job.id,
          eventId: event.id,
          trigger: payload.trigger,
          changedFields: fields,
          sourceVersion: modelSourceVersion,
          version: current.version,
          model: ai.model,
          evidenceIds,
        },
      },
    });
    return { version: current.version, eventId: event.id };
  });
  return {
    outcome: "succeeded" as const,
    result: {
      applied: true,
      changedFields: fields,
      sourceVersion: modelSourceVersion,
      version: applied.version,
      eventId: applied.eventId,
      model: ai.model,
      confidence: ai.value.confidence,
    },
  };
}
