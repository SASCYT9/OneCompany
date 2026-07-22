import { OpsKnowledgeStatus, Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { currentAdminHasPermission } from "@/lib/admin/adminAccess";
import { ADMIN_PERMISSIONS } from "@/lib/admin/adminPermissions";
import { requireOperationsAccess, writeOpsAudit } from "@/lib/operations/access";
import { OpsError, opsErrorResponse } from "@/lib/operations/errors";
import { assertOperationsEnabled } from "@/lib/operations/featureFlags";
import { runOpsIdempotentMutation } from "@/lib/operations/idempotency";
import {
  normalizeKnowledgeCreateInput,
  redactKnowledgeTaskMetadata,
} from "@/lib/operations/knowledge";
import {
  assertOpsMutationBoundary,
  requireIdempotencyKey,
  withEntityHeaders,
} from "@/lib/operations/request";
import { serializeOpsJson } from "@/lib/operations/selects";
import { prisma } from "@/lib/prisma";

const articleInclude = {
  author: { select: { id: true, name: true, email: true } },
  publishedBy: { select: { id: true, name: true, email: true } },
  project: { select: { id: true, externalId: true, title: true } },
  revisions: {
    where: { status: OpsKnowledgeStatus.PUBLISHED },
    orderBy: { revision: "desc" as const },
    take: 1,
  },
  _count: { select: { taskLinks: true, revisions: true } },
} satisfies Prisma.OpsKnowledgeArticleInclude;

function readerView<T extends { id: string; revisions: Array<Record<string, unknown>> }>(
  article: T,
  canEdit: boolean,
  canReadTasks: boolean
) {
  if (canEdit) return redactKnowledgeTaskMetadata(article, canReadTasks);
  const published = article.revisions[0];
  if (!published) return null;
  return redactKnowledgeTaskMetadata(
    {
      ...article,
      ...published,
      id: article.id,
      revisions: undefined,
      status: OpsKnowledgeStatus.PUBLISHED,
    },
    canReadTasks
  );
}

async function rankedKnowledgeIds(input: {
  search: string;
  locale: string;
  category?: string;
  excludeTag?: string;
  canEdit: boolean;
  limit: number;
}) {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id"
    FROM "OpsKnowledgeArticle"
    WHERE "archivedAt" IS NULL
      AND "locale" = ${input.locale}
      ${input.category ? Prisma.sql`AND "category" = ${input.category}` : Prisma.empty}
      ${input.excludeTag ? Prisma.sql`AND NOT (${input.excludeTag} = ANY("tags"))` : Prisma.empty}
      ${input.canEdit ? Prisma.empty : Prisma.sql`AND "publishedRevision" IS NOT NULL`}
      AND (
        to_tsvector('simple', "searchText") @@ websearch_to_tsquery('simple', ${input.search})
        OR similarity("searchText", ${input.search}) > 0.12
        OR "title" ILIKE ${`%${input.search}%`}
        OR "brandKey" ILIKE ${`%${input.search}%`}
      )
    ORDER BY
      ts_rank(
        to_tsvector('simple', "searchText"),
        websearch_to_tsquery('simple', ${input.search})
      ) DESC,
      similarity("searchText", ${input.search}) DESC,
      "updatedAt" DESC
    LIMIT ${input.limit}
  `);
  return rows.map((row) => row.id);
}

export async function GET(request: NextRequest) {
  try {
    assertOperationsEnabled();
    const access = await requireOperationsAccess(ADMIN_PERMISSIONS.OPS_KNOWLEDGE_READ);
    const canEdit = currentAdminHasPermission(access, ADMIN_PERMISSIONS.OPS_KNOWLEDGE_WRITE);
    const canReadTasks = currentAdminHasPermission(access, ADMIN_PERMISSIONS.OPS_TASKS_READ);
    const params = request.nextUrl.searchParams;
    const search = params.get("search")?.trim().slice(0, 200) ?? "";
    const category = params.get("category")?.trim() || undefined;
    const excludeTag = params.get("excludeTag")?.trim().slice(0, 80) || undefined;
    const locale = params.get("locale")?.trim() || "ru";
    const limit = Math.min(500, Math.max(1, Number(params.get("limit") ?? 50) || 50));
    const rankedIds = search
      ? await rankedKnowledgeIds({ search, locale, category, excludeTag, canEdit, limit })
      : null;
    if (rankedIds && rankedIds.length === 0) {
      return NextResponse.json({ articles: [] });
    }
    const where: Prisma.OpsKnowledgeArticleWhereInput = {
      archivedAt: null,
      locale,
      ...(canEdit ? {} : { publishedRevision: { not: null } }),
      ...(category ? { category } : {}),
      ...(excludeTag ? { NOT: { tags: { has: excludeTag } } } : {}),
      ...(rankedIds ? { id: { in: rankedIds } } : {}),
    };
    const articles = await prisma.opsKnowledgeArticle.findMany({
      where,
      orderBy: [{ category: "asc" }, { updatedAt: "desc" }],
      take: limit,
      include: articleInclude,
    });
    if (rankedIds) {
      const rank = new Map(rankedIds.map((id, index) => [id, index]));
      articles.sort(
        (left, right) =>
          (rank.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
          (rank.get(right.id) ?? Number.MAX_SAFE_INTEGER)
      );
    }
    return NextResponse.json({
      articles: serializeOpsJson(
        articles.map((article) => readerView(article, canEdit, canReadTasks)).filter(Boolean)
      ),
    });
  } catch (error) {
    return opsErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertOperationsEnabled();
    assertOpsMutationBoundary(request);
    const access = await requireOperationsAccess(ADMIN_PERMISSIONS.OPS_KNOWLEDGE_WRITE);
    const canReadTasks = currentAdminHasPermission(access, ADMIN_PERMISSIONS.OPS_TASKS_READ);
    const key = requireIdempotencyKey(request);
    const input = normalizeKnowledgeCreateInput(await request.json());
    if (input.projectId && !canReadTasks) {
      throw new Error("FORBIDDEN");
    }

    const result = await runOpsIdempotentMutation({
      prisma,
      scope: "ops.knowledge.create",
      key,
      payload: input,
      execute: async (tx) => {
        if (input.projectId) {
          const project = await tx.opsProject.findFirst({
            where: { id: input.projectId, archivedAt: null },
            select: { id: true },
          });
          if (!project) {
            throw new OpsError("PROJECT_NOT_FOUND", 409, "Linked project was not found");
          }
        }
        const article = await tx.opsKnowledgeArticle.create({
          data: {
            slug: input.slug,
            projectId: input.projectId,
            title: input.title,
            excerpt: input.excerpt,
            contentMarkdown: input.contentMarkdown,
            locale: input.locale,
            category: input.category,
            brandKey: input.brandKey,
            tags: input.tags,
            searchText: input.searchText,
            authorId: access.id,
            revisions: {
              create: {
                revision: 1,
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
            },
          },
          include: articleInclude,
        });
        await writeOpsAudit(tx, access, {
          action: "knowledge.create",
          entityType: "ops.knowledge",
          entityId: article.id,
          metadata: {
            slug: article.slug,
            category: article.category,
            status: article.status,
          },
        });
        return {
          body: serializeOpsJson({
            article: redactKnowledgeTaskMetadata(article, canReadTasks),
          }),
          statusCode: 201,
          resourceType: "ops.knowledge",
          resourceId: article.id,
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
