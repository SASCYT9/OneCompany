import { NextRequest, NextResponse } from "next/server";

import { ADMIN_PERMISSIONS } from "@/lib/admin/adminPermissions";
import { assertCanWriteTask, requireOperationsAccess } from "@/lib/operations/access";
import { createPrismaOpsAiBudget, extractOpsProposalWithAi, OpsAiError } from "@/lib/operations/ai";
import { opsBrandProperNameHintsForClient } from "@/lib/operations/brandGuides";
import { OpsError, opsErrorResponse } from "@/lib/operations/errors";
import { assertOperationsEnabled } from "@/lib/operations/featureFlags";
import { assertOpsMutationBoundary, requireIdempotencyKey } from "@/lib/operations/request";
import { prisma } from "@/lib/prisma";

function boundedText(value: unknown, max: number, required = false) {
  const text = String(value ?? "")
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, max);
  if (required && !text) throw new OpsError("VALIDATION_ERROR", 400, "Task title is required");
  return text || null;
}

function taskTags(task: {
  brand_tags?: string[];
  product_tags?: string[];
  process_tags?: string[];
}) {
  const groups = [
    ["brand", task.brand_tags ?? []],
    ["product", task.product_tags ?? []],
    ["process", task.process_tags ?? []],
  ] as const;
  const seen = new Set<string>();
  return groups.flatMap(([prefix, values]) =>
    values.flatMap((value) => {
      const clean = value
        .replace(/\u0000/g, "")
        .trim()
        .slice(0, 90);
      const key = `${prefix}:${clean}`.toLocaleLowerCase("en-US");
      if (!clean || seen.has(key)) return [];
      seen.add(key);
      return [`${prefix}:${clean}`];
    })
  );
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertOperationsEnabled();
    assertOpsMutationBoundary(request);
    requireIdempotencyKey(request);
    const access = await requireOperationsAccess(ADMIN_PERMISSIONS.OPS_TASKS_WRITE);
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const draft = {
      title: boundedText(body.title, 500, true)!,
      description: boundedText(body.description, 5_000),
      nextAction: boundedText(body.nextAction, 2_000),
      definitionOfDone: boundedText(body.definitionOfDone, 2_000),
    };
    const task = await prisma.opsTask.findUnique({
      where: { id },
      select: {
        id: true,
        number: true,
        assigneeId: true,
        assignees: { select: { adminUserId: true } },
        createdById: true,
        isShared: true,
        version: true,
        comments: {
          take: 20,
          orderBy: { createdAt: "desc" },
          select: {
            text: true,
            createdAt: true,
            author: { select: { name: true } },
          },
        },
        attachments: {
          take: 10,
          orderBy: { createdAt: "asc" },
          select: {
            attachment: {
              select: {
                transcription: true,
                fileName: true,
              },
            },
          },
        },
      },
    });
    if (!task) throw new OpsError("NOT_FOUND", 404, "Task not found");
    assertCanWriteTask(
      access,
      task,
      task.assignees.map((assignment) => assignment.adminUserId)
    );

    const originalTranscripts = task.attachments
      .flatMap(({ attachment }) =>
        attachment.transcription
          ? [
              {
                fileName: attachment.fileName,
                transcript: attachment.transcription.slice(0, 12_000),
              },
            ]
          : []
      )
      .slice(0, 10);
    const response = await extractOpsProposalWithAi({
      text: [
        `Авторская правка задачи #${task.number}:`,
        `Название: ${draft.title}`,
        draft.description ? `Описание: ${draft.description}` : null,
        draft.nextAction ? `Текущее следующее действие: ${draft.nextAction}` : null,
        draft.definitionOfDone ? `Текущий критерий завершения: ${draft.definitionOfDone}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
      context: {
        mode: "task_draft_refinement",
        policy:
          "The admin-edited title and description are authoritative corrections. Preserve their proper-name spelling even when an older transcript conflicts. Return exactly one task. Improve only factual derived fields; do not invent facts.",
        knownProperNames: await opsBrandProperNameHintsForClient(prisma),
        recentComments: task.comments
          .slice()
          .reverse()
          .map((comment) => ({
            author: comment.author.name,
            text: comment.text,
            createdAt: comment.createdAt.toISOString(),
          })),
        originalTranscripts,
      },
      budget: createPrismaOpsAiBudget(prisma),
    });
    const suggestion = response.value.tasks[0];
    if (!suggestion) {
      throw new OpsError(
        "AI_DRAFT_UNAVAILABLE",
        422,
        "Gemini could not prepare a factual task suggestion"
      );
    }
    return NextResponse.json({
      suggestion: {
        title: suggestion.title,
        description: suggestion.description,
        nextAction: suggestion.next_action,
        definitionOfDone: suggestion.definition_of_done,
        tags: taskTags(suggestion),
        confidence: response.value.confidence,
        ambiguities: response.value.ambiguities,
        requiresApproval: response.value.requires_approval,
        model: response.model,
        sourceVersion: task.version,
      },
    });
  } catch (error) {
    if (error instanceof OpsAiError) {
      const status =
        error.code === "AI_BUDGET_EXHAUSTED" ? 429 : error.code === "AI_NOT_CONFIGURED" ? 503 : 502;
      return opsErrorResponse(new OpsError(error.code, status, error.message));
    }
    return opsErrorResponse(error);
  }
}
