import { OpsKnowledgeStatus, Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { currentAdminHasPermission } from "@/lib/admin/adminAccess";
import { ADMIN_PERMISSIONS } from "@/lib/admin/adminPermissions";
import { requireOperationsAccess, writeOpsAudit } from "@/lib/operations/access";
import { OpsError, opsErrorResponse } from "@/lib/operations/errors";
import { assertOperationsEnabled } from "@/lib/operations/featureFlags";
import { runOpsIdempotentMutation } from "@/lib/operations/idempotency";
import { buildKnowledgeSearchText, redactKnowledgeTaskMetadata } from "@/lib/operations/knowledge";
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; revision: string }> }
) {
  try {
    assertOperationsEnabled();
    assertOpsMutationBoundary(request);
    const access = await requireOperationsAccess(ADMIN_PERMISSIONS.OPS_KNOWLEDGE_WRITE);
    const canReadTasks = currentAdminHasPermission(access, ADMIN_PERMISSIONS.OPS_TASKS_READ);
    const key = requireIdempotencyKey(request);
    const expectedVersion = requireIfMatch(request);
    const { id, revision: rawRevision } = await params;
    const revision = Number(rawRevision);
    if (!Number.isInteger(revision) || revision < 1) {
      throw new OpsError("VALIDATION_ERROR", 400, "Revision must be a positive integer");
    }

    const result = await runOpsIdempotentMutation({
      prisma,
      scope: `ops.knowledge.restore:${id}:${revision}`,
      key,
      payload: { expectedVersion, revision },
      execute: async (tx) => {
        const [current, source] = await Promise.all([
          tx.opsKnowledgeArticle.findUnique({ where: { id } }),
          tx.opsKnowledgeRevision.findUnique({
            where: { articleId_revision: { articleId: id, revision } },
          }),
        ]);
        if (!current || current.archivedAt) {
          throw new OpsError("NOT_FOUND", 404, "Knowledge article not found");
        }
        if (!source) throw new OpsError("NOT_FOUND", 404, "Knowledge revision not found");
        if (current.version !== expectedVersion) {
          throw new OpsError("VERSION_CONFLICT", 409, "Article changed since it was loaded", {
            currentVersion: current.version,
          });
        }

        const nextVersion = expectedVersion + 1;
        const searchText = buildKnowledgeSearchText(source);
        const changed = await tx.opsKnowledgeArticle.updateMany({
          where: { id, version: expectedVersion },
          data: {
            title: source.title,
            excerpt: source.excerpt,
            contentMarkdown: source.contentMarkdown,
            locale: source.locale,
            category: source.category,
            brandKey: source.brandKey,
            tags: source.tags,
            searchText,
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
            title: source.title,
            excerpt: source.excerpt,
            contentMarkdown: source.contentMarkdown,
            locale: source.locale,
            category: source.category,
            brandKey: source.brandKey,
            tags: source.tags,
            changeNote: `Восстановлена версия ${revision}`,
            changedById: access.id,
          },
        });
        await writeOpsAudit(tx, access, {
          action: "knowledge.revision.restore",
          entityType: "ops.knowledge",
          entityId: id,
          metadata: { restoredRevision: revision, versionTo: nextVersion },
        });
        const article = await tx.opsKnowledgeArticle.findUniqueOrThrow({ where: { id }, include });
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
