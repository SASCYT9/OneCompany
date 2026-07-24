import { OpsKnowledgeStatus, Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { currentAdminHasPermission } from "@/lib/admin/adminAccess";
import { ADMIN_PERMISSIONS } from "@/lib/admin/adminPermissions";
import { requireOperationsAccess, writeOpsAudit } from "@/lib/operations/access";
import { OpsError, opsErrorResponse } from "@/lib/operations/errors";
import { assertOperationsEnabled } from "@/lib/operations/featureFlags";
import { runOpsIdempotentMutation } from "@/lib/operations/idempotency";
import {
  hasKnowledgeDraftChanges,
  normalizeKnowledgePatchInput,
  redactKnowledgeTaskMetadata,
} from "@/lib/operations/knowledge";
import {
  assertOpsMutationBoundary,
  requireIdempotencyKey,
  requireIfMatch,
  withEntityHeaders,
} from "@/lib/operations/request";
import { serializeOpsJson } from "@/lib/operations/selects";
import { prisma } from "@/lib/prisma";

const include = {
  author: { select: { id: true, name: true, email: true } },
  publishedBy: { select: { id: true, name: true, email: true } },
  project: { select: { id: true, externalId: true, title: true } },
  revisions: {
    orderBy: { revision: "desc" as const },
    take: 50,
    include: { changedBy: { select: { id: true, name: true, email: true } } },
  },
  taskLinks: {
    include: { task: { select: { id: true, externalId: true, title: true, status: true } } },
  },
} satisfies Prisma.OpsKnowledgeArticleInclude;

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertOperationsEnabled();
    const access = await requireOperationsAccess(ADMIN_PERMISSIONS.OPS_KNOWLEDGE_READ);
    const canEdit = currentAdminHasPermission(access, ADMIN_PERMISSIONS.OPS_KNOWLEDGE_WRITE);
    const canReadTasks = currentAdminHasPermission(access, ADMIN_PERMISSIONS.OPS_TASKS_READ);
    const { id } = await params;
    const article = await prisma.opsKnowledgeArticle.findUnique({ where: { id }, include });
    if (!article) throw new OpsError("NOT_FOUND", 404, "Knowledge article not found");

    if (!canEdit) {
      const published = article.revisions.find(
        (revision) => revision.revision === article.publishedRevision
      );
      if (!published) throw new OpsError("NOT_FOUND", 404, "Knowledge article not found");
      const view = redactKnowledgeTaskMetadata(
        {
          ...article,
          ...published,
          id: article.id,
          status: OpsKnowledgeStatus.PUBLISHED,
          revisions: undefined,
        },
        canReadTasks
      );
      return withEntityHeaders(
        NextResponse.json({ article: serializeOpsJson(view) }),
        published.revision
      );
    }

    return withEntityHeaders(
      NextResponse.json({
        article: serializeOpsJson(redactKnowledgeTaskMetadata(article, canReadTasks)),
      }),
      article.version
    );
  } catch (error) {
    return opsErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertOperationsEnabled();
    assertOpsMutationBoundary(request);
    const access = await requireOperationsAccess(ADMIN_PERMISSIONS.OPS_KNOWLEDGE_WRITE);
    const canReadTasks = currentAdminHasPermission(access, ADMIN_PERMISSIONS.OPS_TASKS_READ);
    const key = requireIdempotencyKey(request);
    const expectedVersion = requireIfMatch(request);
    const { id } = await params;
    const body = await request.json();
    if (body && typeof body === "object" && "projectId" in body && !canReadTasks) {
      throw new Error("FORBIDDEN");
    }

    const result = await runOpsIdempotentMutation({
      prisma,
      scope: `ops.knowledge.update:${id}`,
      key,
      payload: { expectedVersion, body },
      execute: async (tx) => {
        const current = await tx.opsKnowledgeArticle.findUnique({
          where: { id },
          select: {
            id: true,
            title: true,
            excerpt: true,
            contentMarkdown: true,
            locale: true,
            category: true,
            brandKey: true,
            projectId: true,
            tags: true,
            version: true,
          },
        });
        if (!current) throw new OpsError("NOT_FOUND", 404, "Knowledge article not found");
        if (current.version !== expectedVersion) {
          throw new OpsError("VERSION_CONFLICT", 409, "Article changed since it was loaded", {
            currentVersion: current.version,
          });
        }
        const input = normalizeKnowledgePatchInput(body, current);
        if (!hasKnowledgeDraftChanges(current, input)) {
          throw new OpsError("NO_CHANGES", 409, "No article changes were supplied");
        }
        if (input.projectId) {
          const project = await tx.opsProject.findFirst({
            where: { id: input.projectId, archivedAt: null },
            select: { id: true },
          });
          if (!project) {
            throw new OpsError("PROJECT_NOT_FOUND", 409, "Linked project was not found");
          }
        }
        const nextVersion = expectedVersion + 1;
        const changed = await tx.opsKnowledgeArticle.updateMany({
          where: { id, version: expectedVersion },
          data: {
            title: input.title,
            excerpt: input.excerpt,
            contentMarkdown: input.contentMarkdown,
            locale: input.locale,
            category: input.category,
            brandKey: input.brandKey,
            projectId: input.projectId,
            tags: input.tags,
            searchText: input.searchText,
            status: OpsKnowledgeStatus.DRAFT,
            version: nextVersion,
          },
        });
        if (changed.count !== 1) {
          throw new OpsError("VERSION_CONFLICT", 409, "Article changed since it was loaded");
        }
        await tx.opsKnowledgeRevision.create({
          data: {
            articleId: id,
            revision: nextVersion,
            status: OpsKnowledgeStatus.DRAFT,
            title: input.title,
            excerpt: input.excerpt,
            contentMarkdown: input.contentMarkdown,
            locale: input.locale,
            category: input.category,
            brandKey: input.brandKey,
            tags: input.tags,
            changeNote: input.changeNote,
            changedById: access.id,
          },
        });
        const article = await tx.opsKnowledgeArticle.findUniqueOrThrow({ where: { id }, include });
        await writeOpsAudit(tx, access, {
          action: "knowledge.update",
          entityType: "ops.knowledge",
          entityId: id,
          metadata: { versionFrom: expectedVersion, versionTo: nextVersion, status: "DRAFT" },
        });
        return {
          body: serializeOpsJson({
            article: redactKnowledgeTaskMetadata(article, canReadTasks),
          }),
          statusCode: 200,
          resourceType: "ops.knowledge",
          resourceId: id,
        };
      },
    });
    return withEntityHeaders(
      NextResponse.json(result.body, { status: result.statusCode }),
      result.body.article.version,
      result.replayed
    );
  } catch (error) {
    return opsErrorResponse(error);
  }
}
