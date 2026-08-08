import "server-only";

import {
  Prisma,
  ShopKnowledgeStatus,
  ShopKnowledgeVerificationStatus,
  type PrismaClient,
} from "@prisma/client";

import { bumpShopKnowledgeCatalogState } from "@/lib/shopKnowledgeV2/catalogState";
import {
  assertShopKnowledgeV2OtherQuarantineCommitSafe,
  SHOP_KNOWLEDGE_V2_OTHER_QUARANTINE_REASON,
  SHOP_KNOWLEDGE_V2_QUARANTINED_SCHEMA_VERSION,
} from "@/lib/shopKnowledgeV2/quarantineContract";
import { SHOP_KNOWLEDGE_V2_SCHEMA_VERSION } from "@/lib/shopKnowledgeV2/types";

export {
  assertShopKnowledgeV2OtherQuarantineCommitSafe,
  SHOP_KNOWLEDGE_V2_OTHER_QUARANTINE_REASON,
  SHOP_KNOWLEDGE_V2_QUARANTINED_SCHEMA_VERSION,
} from "@/lib/shopKnowledgeV2/quarantineContract";

type QuarantineCandidateRow = {
  knowledgeId: string;
  productId: string;
  revision: number;
  status: string;
  slug: string;
  sku: string | null;
  isPublished: boolean;
  productStatus: string;
  hasSkuIdentity: boolean;
};

export type ShopKnowledgeV2OtherQuarantineCounts = {
  knowledge: number;
  withSkuIdentity: number;
  withoutSkuIdentity: number;
  chunks: number;
  activeChunks: number;
  applications: number;
  activeApplications: number;
  variants: number;
  activeVariants: number;
  attributes: number;
  activeAttributes: number;
  evidence: number;
  activeEvidence: number;
  reviewTasks: number;
  openReviewTasks: number;
  openIndexQualityReviewTasks: number;
  inReviewIndexQualityReviewTasks: number;
};

export type ShopKnowledgeV2OtherQuarantinePreview = {
  counts: ShopKnowledgeV2OtherQuarantineCounts;
  statuses: Record<string, number>;
  samples: Array<{
    productId: string;
    slug: string;
    sku: string | null;
    revision: number;
    status: string;
    isPublished: boolean;
    productStatus: string;
    hasSkuIdentity: boolean;
  }>;
};

export type ShopKnowledgeV2OtherQuarantineResult = {
  mode: "commit";
  quarantined: number;
  deactivated: {
    chunks: number;
    applications: number;
    variants: number;
    attributes: number;
    evidence: number;
  };
  resolvedAutomaticReviewTasks: number;
  catalogFingerprint: string | null;
};

type QuarantineReadClient = PrismaClient | Prisma.TransactionClient;

async function listCandidates(client: QuarantineReadClient, lockRows: boolean) {
  const lockClause = lockRows ? Prisma.sql`FOR UPDATE OF knowledge, revision` : Prisma.empty;
  return client.$queryRaw<QuarantineCandidateRow[]>(Prisma.sql`
    SELECT
      knowledge."id" AS "knowledgeId",
      knowledge."productId" AS "productId",
      knowledge."revision" AS "revision",
      revision."status"::text AS "status",
      product."slug" AS "slug",
      product."sku" AS "sku",
      product."isPublished" AS "isPublished",
      product."status"::text AS "productStatus",
      (
        NULLIF(BTRIM(COALESCE(product."sku", '')), '') IS NOT NULL
        OR EXISTS (
          SELECT 1
          FROM "ShopProductVariant" variant
          WHERE variant."productId" = product."id"
            AND NULLIF(BTRIM(COALESCE(variant."sku", '')), '') IS NOT NULL
        )
      ) AS "hasSkuIdentity"
    FROM "ShopProductKnowledge" knowledge
    JOIN "ShopKnowledgeRevision" revision
      ON revision."knowledgeId" = knowledge."id"
     AND revision."revision" = knowledge."revision"
    JOIN "ShopProduct" product ON product."id" = knowledge."productId"
    WHERE knowledge."schemaVersion" = ${SHOP_KNOWLEDGE_V2_SCHEMA_VERSION}
      AND COALESCE(
        NULLIF(revision."snapshot"->>'categoryGroup', ''),
        knowledge."categoryGroup",
        'other'
      ) = 'other'
    ORDER BY knowledge."productId" ASC
    ${lockClause}
  `);
}

function emptyCounts(): ShopKnowledgeV2OtherQuarantineCounts {
  return {
    knowledge: 0,
    withSkuIdentity: 0,
    withoutSkuIdentity: 0,
    chunks: 0,
    activeChunks: 0,
    applications: 0,
    activeApplications: 0,
    variants: 0,
    activeVariants: 0,
    attributes: 0,
    activeAttributes: 0,
    evidence: 0,
    activeEvidence: 0,
    reviewTasks: 0,
    openReviewTasks: 0,
    openIndexQualityReviewTasks: 0,
    inReviewIndexQualityReviewTasks: 0,
  };
}

async function collectCounts(
  client: QuarantineReadClient,
  candidates: QuarantineCandidateRow[]
): Promise<ShopKnowledgeV2OtherQuarantineCounts> {
  if (candidates.length === 0) return emptyCounts();
  const knowledgeIds = candidates.map((candidate) => candidate.knowledgeId);
  const counts = emptyCounts();
  counts.knowledge = candidates.length;
  counts.withSkuIdentity = candidates.filter((candidate) => candidate.hasSkuIdentity).length;
  counts.withoutSkuIdentity = counts.knowledge - counts.withSkuIdentity;
  counts.chunks = await client.shopKnowledgeChunk.count({
    where: { knowledgeId: { in: knowledgeIds } },
  });
  counts.activeChunks = await client.shopKnowledgeChunk.count({
    where: { knowledgeId: { in: knowledgeIds }, isActive: true },
  });
  counts.applications = await client.shopVehicleApplication.count({
    where: { knowledgeId: { in: knowledgeIds } },
  });
  counts.activeApplications = await client.shopVehicleApplication.count({
    where: { knowledgeId: { in: knowledgeIds }, isActive: true },
  });
  counts.variants = await client.shopVariantKnowledge.count({
    where: { knowledgeId: { in: knowledgeIds } },
  });
  counts.activeVariants = await client.shopVariantKnowledge.count({
    where: { knowledgeId: { in: knowledgeIds }, isActive: true },
  });
  counts.attributes = await client.shopProductAttributeValue.count({
    where: { knowledgeId: { in: knowledgeIds } },
  });
  counts.activeAttributes = await client.shopProductAttributeValue.count({
    where: { knowledgeId: { in: knowledgeIds }, isActive: true },
  });
  counts.evidence = await client.shopKnowledgeEvidence.count({
    where: { knowledgeId: { in: knowledgeIds } },
  });
  counts.activeEvidence = await client.shopKnowledgeEvidence.count({
    where: { knowledgeId: { in: knowledgeIds }, isActive: true },
  });
  counts.reviewTasks = await client.shopKnowledgeReviewTask.count({
    where: { knowledgeId: { in: knowledgeIds } },
  });
  counts.openReviewTasks = await client.shopKnowledgeReviewTask.count({
    where: {
      knowledgeId: { in: knowledgeIds },
      status: { in: ["OPEN", "IN_REVIEW"] },
    },
  });
  counts.openIndexQualityReviewTasks = await client.shopKnowledgeReviewTask.count({
    where: {
      knowledgeId: { in: knowledgeIds },
      taskType: "INDEX_QUALITY",
      status: "OPEN",
    },
  });
  counts.inReviewIndexQualityReviewTasks = await client.shopKnowledgeReviewTask.count({
    where: {
      knowledgeId: { in: knowledgeIds },
      taskType: "INDEX_QUALITY",
      status: "IN_REVIEW",
    },
  });
  return counts;
}

export async function collectShopKnowledgeV2OtherQuarantinePreview(
  client: PrismaClient,
  sampleLimit = 20
): Promise<ShopKnowledgeV2OtherQuarantinePreview> {
  if (!Number.isInteger(sampleLimit) || sampleLimit < 0 || sampleLimit > 100) {
    throw new Error("Knowledge V2 quarantine sampleLimit must be between 0 and 100");
  }
  const candidates = await listCandidates(client, false);
  const statuses: Record<string, number> = {};
  for (const candidate of candidates) {
    statuses[candidate.status] = (statuses[candidate.status] ?? 0) + 1;
  }
  return {
    counts: await collectCounts(client, candidates),
    statuses,
    samples: candidates.slice(0, sampleLimit).map((candidate) => ({
      productId: candidate.productId,
      slug: candidate.slug,
      sku: candidate.sku,
      revision: candidate.revision,
      status: candidate.status,
      isPublished: candidate.isPublished,
      productStatus: candidate.productStatus,
      hasSkuIdentity: candidate.hasSkuIdentity,
    })),
  };
}

export async function quarantineShopKnowledgeV2OtherRecords(
  client: PrismaClient,
  input: {
    expectedCount: number;
    maxRecords?: number;
    now?: Date;
  }
): Promise<ShopKnowledgeV2OtherQuarantineResult> {
  const now = input.now ?? new Date();
  const maxRecords = input.maxRecords ?? 1_000;
  return client.$transaction(
    async (tx) => {
      const candidates = await listCandidates(tx, true);
      assertShopKnowledgeV2OtherQuarantineCommitSafe({
        candidateCount: candidates.length,
        expectedCount: input.expectedCount,
        maxRecords,
      });
      if (candidates.length === 0) {
        return {
          mode: "commit" as const,
          quarantined: 0,
          deactivated: { chunks: 0, applications: 0, variants: 0, attributes: 0, evidence: 0 },
          resolvedAutomaticReviewTasks: 0,
          catalogFingerprint: null,
        };
      }

      const knowledgeIds = candidates.map((candidate) => candidate.knowledgeId);
      const knowledgeIdList = Prisma.join(knowledgeIds);
      const deactivatedChunks = await tx.shopKnowledgeChunk.updateMany({
        where: { knowledgeId: { in: knowledgeIds }, isActive: true },
        data: { isActive: false },
      });
      const deactivatedApplications = await tx.shopVehicleApplication.updateMany({
        where: { knowledgeId: { in: knowledgeIds }, isActive: true },
        data: { isActive: false },
      });
      const deactivatedVariants = await tx.shopVariantKnowledge.updateMany({
        where: { knowledgeId: { in: knowledgeIds }, isActive: true },
        data: { isActive: false },
      });
      const deactivatedAttributes = await tx.shopProductAttributeValue.updateMany({
        where: { knowledgeId: { in: knowledgeIds }, isActive: true },
        data: { isActive: false },
      });
      const deactivatedEvidence = await tx.shopKnowledgeEvidence.updateMany({
        where: { knowledgeId: { in: knowledgeIds }, isActive: true },
        data: { isActive: false },
      });
      const resolvedAutomaticReviewTasks = await tx.shopKnowledgeReviewTask.updateMany({
        where: {
          knowledgeId: { in: knowledgeIds },
          taskType: "INDEX_QUALITY",
          status: "OPEN",
        },
        data: {
          status: "RESOLVED",
          resolvedAt: now,
          resolution: {
            type: "excluded_from_v2",
            categoryGroup: "other",
            exactSkuIdentityOnly: true,
          },
        },
      });

      const updatedRevisions = await tx.$executeRaw(Prisma.sql`
        UPDATE "ShopKnowledgeRevision" revision
        SET
          "schemaVersion" = ${SHOP_KNOWLEDGE_V2_QUARANTINED_SCHEMA_VERSION},
          "status" = ${ShopKnowledgeStatus.BLOCKED}::"ShopKnowledgeStatus",
          "reason" = ${SHOP_KNOWLEDGE_V2_OTHER_QUARANTINE_REASON},
          "activatedAt" = NULL
        FROM "ShopProductKnowledge" knowledge
        WHERE revision."knowledgeId" = knowledge."id"
          AND revision."revision" = knowledge."revision"
          AND knowledge."id" IN (${knowledgeIdList})
          AND knowledge."schemaVersion" = ${SHOP_KNOWLEDGE_V2_SCHEMA_VERSION}
          AND COALESCE(
            NULLIF(revision."snapshot"->>'categoryGroup', ''),
            knowledge."categoryGroup",
            'other'
          ) = 'other'
      `);

      await tx.$executeRaw(Prisma.sql`
        UPDATE "ShopVariantKnowledge" variant
        SET
          "schemaVersion" = ${SHOP_KNOWLEDGE_V2_QUARANTINED_SCHEMA_VERSION},
          "status" = ${ShopKnowledgeStatus.BLOCKED}::"ShopKnowledgeStatus",
          "isActive" = false,
          "readyAt" = NULL,
          "updatedAt" = ${now}
        FROM "ShopProductKnowledge" knowledge
        WHERE variant."knowledgeId" = knowledge."id"
          AND variant."revision" = knowledge."revision"
          AND knowledge."id" IN (${knowledgeIdList})
      `);
      await tx.$executeRaw(Prisma.sql`
        UPDATE "ShopVehicleApplication" application
        SET
          "verificationStatus" = ${ShopKnowledgeVerificationStatus.BLOCKED}::"ShopKnowledgeVerificationStatus",
          "isActive" = false,
          "updatedAt" = ${now}
        FROM "ShopProductKnowledge" knowledge
        WHERE application."knowledgeId" = knowledge."id"
          AND application."revision" = knowledge."revision"
          AND knowledge."id" IN (${knowledgeIdList})
      `);
      await tx.$executeRaw(Prisma.sql`
        UPDATE "ShopProductAttributeValue" attribute
        SET
          "verificationStatus" = ${ShopKnowledgeVerificationStatus.BLOCKED}::"ShopKnowledgeVerificationStatus",
          "isActive" = false,
          "updatedAt" = ${now}
        FROM "ShopProductKnowledge" knowledge
        WHERE attribute."knowledgeId" = knowledge."id"
          AND attribute."revision" = knowledge."revision"
          AND knowledge."id" IN (${knowledgeIdList})
      `);

      const updatedKnowledge = await tx.$executeRaw(Prisma.sql`
        UPDATE "ShopProductKnowledge" knowledge
        SET
          "schemaVersion" = ${SHOP_KNOWLEDGE_V2_QUARANTINED_SCHEMA_VERSION},
          "activeRevision" = 0,
          "status" = ${ShopKnowledgeStatus.BLOCKED}::"ShopKnowledgeStatus",
          "completenessScore" = 0,
          "qualityFlags" = ARRAY(
            SELECT DISTINCT flag
            FROM unnest(
              COALESCE(knowledge."qualityFlags", ARRAY[]::text[])
              || ARRAY['category_other', 'excluded_from_v2:category_other']::text[]
            ) AS flag
            ORDER BY flag
          ),
          "statusChangedAt" = ${now},
          "readyAt" = NULL,
          "failedAt" = NULL,
          "failureReason" = ${SHOP_KNOWLEDGE_V2_OTHER_QUARANTINE_REASON},
          "vehicleType" = 'unknown',
          "makes" = ARRAY[]::text[],
          "models" = ARRAY[]::text[],
          "chassisCodes" = ARRAY[]::text[],
          "yearRanges" = '[]'::jsonb,
          "engines" = ARRAY[]::text[],
          "bodyStyles" = ARRAY[]::text[],
          "markets" = ARRAY[]::text[],
          "powerGainHp" = NULL,
          "torqueGainNm" = NULL,
          "material" = NULL,
          "opfGpf" = NULL,
          "installationType" = NULL,
          "fitmentStatus" = 'needs_review',
          "fitmentSource" = 'automatic',
          "applications" = '[]'::jsonb,
          "facts" = '{}'::jsonb,
          "embeddingModel" = NULL,
          "embedding" = NULL,
          "indexedAt" = ${now},
          "updatedAt" = ${now}
        WHERE knowledge."id" IN (${knowledgeIdList})
          AND knowledge."schemaVersion" = ${SHOP_KNOWLEDGE_V2_SCHEMA_VERSION}
      `);

      if (updatedRevisions !== candidates.length || updatedKnowledge !== candidates.length) {
        throw new Error(
          `Knowledge V2 quarantine CAS failed: candidates=${candidates.length}, revisions=${updatedRevisions}, knowledge=${updatedKnowledge}`
        );
      }
      const catalogFingerprint = await bumpShopKnowledgeCatalogState(tx, now);
      return {
        mode: "commit" as const,
        quarantined: candidates.length,
        deactivated: {
          chunks: deactivatedChunks.count,
          applications: deactivatedApplications.count,
          variants: deactivatedVariants.count,
          attributes: deactivatedAttributes.count,
          evidence: deactivatedEvidence.count,
        },
        resolvedAutomaticReviewTasks: resolvedAutomaticReviewTasks.count,
        catalogFingerprint,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 10_000,
      timeout: 60_000,
    }
  );
}
