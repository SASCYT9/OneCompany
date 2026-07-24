import { OpsTaskEventType, OpsKnowledgeStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { ADMIN_PERMISSIONS } from "@/lib/admin/adminPermissions";
import {
  assertCanWriteTask,
  assertOperationsPermission,
  requireOperationsAccess,
  writeOpsAudit,
} from "@/lib/operations/access";
import { OpsError, opsErrorResponse } from "@/lib/operations/errors";
import { assertOperationsEnabled } from "@/lib/operations/featureFlags";
import { runOpsIdempotentMutation } from "@/lib/operations/idempotency";
import {
  assertOpsMutationBoundary,
  requireIdempotencyKey,
  requireIfMatch,
  withEntityHeaders,
} from "@/lib/operations/request";
import { opsTaskDetailSelect, serializeOpsJson } from "@/lib/operations/selects";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string; articleId: string }>;
};

async function mutateKnowledgeLink(
  request: NextRequest,
  context: RouteContext,
  action: "attach" | "detach"
) {
  assertOperationsEnabled();
  assertOpsMutationBoundary(request);
  const access = await requireOperationsAccess(ADMIN_PERMISSIONS.OPS_TASKS_WRITE);
  assertOperationsPermission(access, ADMIN_PERMISSIONS.OPS_KNOWLEDGE_READ);
  const key = requireIdempotencyKey(request);
  const expectedVersion = requireIfMatch(request);
  const { id, articleId } = await context.params;

  const result = await runOpsIdempotentMutation({
    prisma,
    scope: `ops.task.knowledge.${action}:${id}:${articleId}`,
    key,
    payload: { expectedVersion },
    execute: async (tx) => {
      const current = await tx.opsTask.findUnique({
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
      if (!current) throw new OpsError("NOT_FOUND", 404, "Task not found");
      assertCanWriteTask(
        access,
        current,
        current.assignees.map((assignment) => assignment.adminUserId)
      );
      if (current.version !== expectedVersion) {
        throw new OpsError("VERSION_CONFLICT", 409, "Task changed since it was loaded", {
          currentVersion: current.version,
        });
      }

      const existing = await tx.opsTaskKnowledgeLink.findUnique({
        where: { taskId_articleId: { taskId: id, articleId } },
        select: { taskId: true },
      });

      if (action === "attach") {
        if (existing) {
          throw new OpsError("KNOWLEDGE_LINK_EXISTS", 409, "Article is already linked");
        }
        const article = await tx.opsKnowledgeArticle.findFirst({
          where: {
            id: articleId,
            archivedAt: null,
            status: OpsKnowledgeStatus.PUBLISHED,
            publishedRevision: { not: null },
          },
          select: { id: true },
        });
        if (!article) {
          throw new OpsError(
            "KNOWLEDGE_ARTICLE_NOT_FOUND",
            409,
            "Only a published knowledge article can be linked"
          );
        }
        await tx.opsTaskKnowledgeLink.create({ data: { taskId: id, articleId } });
      } else {
        if (!existing) {
          throw new OpsError("KNOWLEDGE_LINK_NOT_FOUND", 404, "Knowledge link was not found");
        }
        await tx.opsTaskKnowledgeLink.delete({
          where: { taskId_articleId: { taskId: id, articleId } },
        });
      }

      const changed = await tx.opsTask.updateMany({
        where: { id, version: expectedVersion },
        data: { version: { increment: 1 } },
      });
      if (changed.count !== 1) {
        throw new OpsError("VERSION_CONFLICT", 409, "Task changed since it was loaded");
      }
      await tx.opsTaskEvent.create({
        data: {
          taskId: id,
          type: OpsTaskEventType.UPDATED,
          actorId: access.id,
          idempotencyKey: key,
          payload: {
            change: action === "attach" ? "knowledge_linked" : "knowledge_unlinked",
            articleId,
            versionFrom: expectedVersion,
            versionTo: expectedVersion + 1,
          },
        },
      });
      const task = await tx.opsTask.findUniqueOrThrow({
        where: { id },
        select: opsTaskDetailSelect,
      });
      await writeOpsAudit(tx, access, {
        action: `task.knowledge.${action}`,
        entityType: "ops.task",
        entityId: id,
        metadata: {
          articleId,
          versionFrom: expectedVersion,
          versionTo: task.version,
        },
      });
      return {
        body: serializeOpsJson({ task }),
        statusCode: 200,
        resourceType: "ops.task",
        resourceId: id,
      };
    },
  });

  return withEntityHeaders(
    NextResponse.json(result.body, { status: result.statusCode }),
    result.body.task.version,
    result.replayed
  );
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    return await mutateKnowledgeLink(request, context, "attach");
  } catch (error) {
    return opsErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    return await mutateKnowledgeLink(request, context, "detach");
  } catch (error) {
    return opsErrorResponse(error);
  }
}
