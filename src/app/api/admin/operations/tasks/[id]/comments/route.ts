import { OpsTaskEventType } from "@prisma/client";
import { after, NextRequest, NextResponse } from "next/server";
import { ADMIN_PERMISSIONS } from "@/lib/admin/adminPermissions";
import {
  assertCanWriteTask,
  requireOperationsAccess,
  writeOpsAudit,
} from "@/lib/operations/access";
import { OpsError, opsErrorResponse } from "@/lib/operations/errors";
import { assertOperationsEnabled } from "@/lib/operations/featureFlags";
import { runOpsIdempotentMutation } from "@/lib/operations/idempotency";
import { drainOpsJobs } from "@/lib/operations/jobs";
import {
  assertOpsMutationBoundary,
  requireIdempotencyKey,
  withEntityHeaders,
} from "@/lib/operations/request";
import {
  enqueueOpsTaskAiReconcile,
  OPS_TASK_AI_RECONCILE_JOB,
} from "@/lib/operations/taskAiReconcile";
import { createOpsJobStageExecutor } from "@/lib/operations/telegramJobs";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertOperationsEnabled();
    assertOpsMutationBoundary(request);
    const access = await requireOperationsAccess(ADMIN_PERMISSIONS.OPS_TASKS_WRITE);
    const key = requireIdempotencyKey(request);
    const { id } = await params;
    const body = (await request.json()) as { text?: unknown; correctsCommentId?: unknown };
    const text = String(body.text ?? "").trim();
    if (!text || text.length > 10_000) {
      throw new OpsError("VALIDATION_ERROR", 400, "Comment must contain 1–10000 characters");
    }
    const correctsCommentId = body.correctsCommentId ? String(body.correctsCommentId).trim() : null;

    const result = await runOpsIdempotentMutation({
      prisma,
      scope: `ops.task.comment:${id}`,
      key,
      payload: { text, correctsCommentId },
      execute: async (tx) => {
        const task = await tx.opsTask.findUnique({
          where: { id },
          select: {
            id: true,
            version: true,
            assigneeId: true,
            assignees: { select: { adminUserId: true } },
            createdById: true,
            isShared: true,
          },
        });
        if (!task) throw new OpsError("NOT_FOUND", 404, "Task not found");
        assertCanWriteTask(access, task);
        if (correctsCommentId) {
          const corrected = await tx.opsComment.findFirst({
            where: { id: correctsCommentId, taskId: id },
            select: { id: true },
          });
          if (!corrected) {
            throw new OpsError("COMMENT_NOT_FOUND", 404, "Corrected comment not found");
          }
        }
        const comment = await tx.opsComment.create({
          data: { taskId: id, authorId: access.id, text, correctsCommentId },
          include: { author: { select: { id: true, name: true, email: true } } },
        });
        await tx.opsTaskEvent.create({
          data: {
            taskId: id,
            type: OpsTaskEventType.COMMENTED,
            actorId: access.id,
            idempotencyKey: key,
            payload: { commentId: comment.id, correctsCommentId },
          },
        });
        await writeOpsAudit(tx, access, {
          action: "task.comment.create",
          entityType: "ops.task",
          entityId: id,
          metadata: { commentId: comment.id, correctsCommentId },
        });
        await enqueueOpsTaskAiReconcile({
          client: tx,
          taskId: id,
          sourceVersion: task.version,
          trigger: "comment",
          actorId: access.id,
          commentId: comment.id,
          directive: text,
          idempotencyKey: `task-ai-reconcile:comment:${comment.id}`,
        });
        return {
          body: { comment },
          statusCode: 201,
          resourceType: "ops.comment",
          resourceId: comment.id,
        };
      },
    });
    after(async () => {
      await drainOpsJobs({
        client: prisma,
        execute: createOpsJobStageExecutor({ client: prisma }),
        maxJobs: 1,
        timeBudgetMs: 12_000,
        types: [OPS_TASK_AI_RECONCILE_JOB],
      }).catch((error) => {
        console.error("[operations.task.comment.after] AI reconcile kick failed", error);
      });
    });
    return withEntityHeaders(
      NextResponse.json(result.body, { status: result.statusCode }),
      undefined,
      result.replayed
    );
  } catch (error) {
    return opsErrorResponse(error);
  }
}
