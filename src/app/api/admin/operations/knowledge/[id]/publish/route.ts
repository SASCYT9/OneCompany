import { OpsKnowledgeStatus, Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { currentAdminHasPermission } from "@/lib/admin/adminAccess";
import { ADMIN_PERMISSIONS } from "@/lib/admin/adminPermissions";
import { requireOperationsAccess, writeOpsAudit } from "@/lib/operations/access";
import { OpsError, opsErrorResponse } from "@/lib/operations/errors";
import { assertOperationsEnabled } from "@/lib/operations/featureFlags";
import { runOpsIdempotentMutation } from "@/lib/operations/idempotency";
import { redactKnowledgeTaskMetadata } from "@/lib/operations/knowledge";
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
  revisions: { orderBy: { revision: "desc" as const }, take: 50 },
} satisfies Prisma.OpsKnowledgeArticleInclude;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertOperationsEnabled();
    assertOpsMutationBoundary(request);
    const access = await requireOperationsAccess(ADMIN_PERMISSIONS.OPS_KNOWLEDGE_PUBLISH);
    const canReadTasks = currentAdminHasPermission(access, ADMIN_PERMISSIONS.OPS_TASKS_READ);
    const key = requireIdempotencyKey(request);
    const expectedVersion = requireIfMatch(request);
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as { changeNote?: unknown };
    const changeNote = body.changeNote ? String(body.changeNote).trim().slice(0, 1_000) : null;

    const result = await runOpsIdempotentMutation({
      prisma,
      scope: `ops.knowledge.publish:${id}`,
      key,
      payload: { expectedVersion, changeNote },
      execute: async (tx) => {
        const current = await tx.opsKnowledgeArticle.findUnique({ where: { id } });
        if (!current) throw new OpsError("NOT_FOUND", 404, "Knowledge article not found");
        if (current.version !== expectedVersion) {
          throw new OpsError("VERSION_CONFLICT", 409, "Article changed since it was loaded", {
            currentVersion: current.version,
          });
        }
        const nextVersion = expectedVersion + 1;
        const now = new Date();
        const changed = await tx.opsKnowledgeArticle.updateMany({
          where: { id, version: expectedVersion },
          data: {
            status: OpsKnowledgeStatus.PUBLISHED,
            publishedById: access.id,
            publishedRevision: nextVersion,
            publishedAt: now,
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
            status: OpsKnowledgeStatus.PUBLISHED,
            title: current.title,
            excerpt: current.excerpt,
            contentMarkdown: current.contentMarkdown,
            locale: current.locale,
            category: current.category,
            brandKey: current.brandKey,
            tags: current.tags,
            changeNote,
            changedById: access.id,
          },
        });
        const article = await tx.opsKnowledgeArticle.findUniqueOrThrow({ where: { id }, include });
        await writeOpsAudit(tx, access, {
          action: "knowledge.publish",
          entityType: "ops.knowledge",
          entityId: id,
          metadata: {
            versionFrom: expectedVersion,
            publishedRevision: nextVersion,
          },
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
