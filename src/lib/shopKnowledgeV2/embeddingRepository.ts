import { Prisma, ShopKnowledgeStatus, type PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { bumpShopKnowledgeCatalogState } from "@/lib/shopKnowledgeV2/catalogState";
import type {
  ShopKnowledgeChunkEmbeddingBacklog,
  ShopKnowledgeChunkEmbeddingRepository,
  ShopKnowledgeChunkEmbeddingStoreResult,
} from "@/lib/shopKnowledgeV2/embeddings";
import { SHOP_KNOWLEDGE_V2_SCHEMA_VERSION } from "@/lib/shopKnowledgeV2/types";

type FinalizableKnowledgeRow = {
  knowledgeId: string;
  revision: number;
  targetStatus: string | null;
  snapshot: Prisma.JsonValue;
};

type KnowledgeProjection = {
  schemaVersion: number;
  completenessScore: number;
  qualityFlags: string[];
  sourceUpdatedAt: string;
  vehicleType: string;
  makes: string[];
  models: string[];
  chassisCodes: string[];
  yearRanges: Prisma.InputJsonValue;
  engines: string[];
  bodyStyles: string[];
  markets: string[];
  categoryGroup: string;
  powerGainHp: number | null;
  torqueGainNm: number | null;
  material: string | null;
  opfGpf: string | null;
  installationType: string | null;
  fitmentStatus: string;
  fitmentSource: string;
  applications: Prisma.InputJsonValue;
  facts: Prisma.InputJsonValue;
  searchText: string;
  contentHash: string;
};

function readKnowledgeProjection(snapshot: Prisma.JsonValue): KnowledgeProjection {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    throw new Error("Knowledge revision snapshot is malformed");
  }
  const projection = (snapshot as Record<string, unknown>).knowledgeProjection;
  if (!projection || typeof projection !== "object" || Array.isArray(projection)) {
    throw new Error("Knowledge revision projection is missing");
  }
  return projection as KnowledgeProjection;
}

function targetKnowledgeStatus(value: string | null): ShopKnowledgeStatus {
  if (value === ShopKnowledgeStatus.READY) return ShopKnowledgeStatus.READY;
  if (value === ShopKnowledgeStatus.BLOCKED) return ShopKnowledgeStatus.BLOCKED;
  return ShopKnowledgeStatus.NEEDS_REVIEW;
}

function knowledgeIdFilter(knowledgeIds: string[] | undefined) {
  return knowledgeIds?.length
    ? Prisma.sql`AND knowledge."id" IN (${Prisma.join(Array.from(new Set(knowledgeIds)))})`
    : Prisma.empty;
}

async function finalizeReadyKnowledgeInTransaction(
  tx: Prisma.TransactionClient,
  input: {
    model: string;
    finalizedAt: Date;
    limit: number;
    knowledgeIds?: string[];
  }
): Promise<number> {
  const rows = await tx.$queryRaw<FinalizableKnowledgeRow[]>`
    SELECT
      knowledge."id" AS "knowledgeId",
      knowledge."revision" AS "revision",
      COALESCE(
        revision."snapshot"->>'targetStatus',
        revision."snapshot"->>'status'
      ) AS "targetStatus",
      revision."snapshot" AS "snapshot"
    FROM "ShopProductKnowledge" knowledge
    JOIN "ShopKnowledgeRevision" revision
      ON revision."knowledgeId" = knowledge."id"
     AND revision."revision" = knowledge."revision"
    WHERE knowledge."schemaVersion" = ${SHOP_KNOWLEDGE_V2_SCHEMA_VERSION}
      AND revision."status" = 'PROCESSING'
      AND knowledge."revision" = revision."revision"
      AND revision."snapshot"->>'categoryGroup' IS DISTINCT FROM 'other'
      AND (
        SELECT COUNT(*) FROM "ShopVehicleApplication" application
        WHERE application."knowledgeId" = knowledge."id"
          AND application."revision" = revision."revision"
      ) = COALESCE((revision."snapshot"->'expectedCounts'->>'applications')::integer, 0)
      AND (
        SELECT COUNT(*) FROM "ShopVariantKnowledge" variant
        WHERE variant."knowledgeId" = knowledge."id"
          AND variant."revision" = revision."revision"
      ) = COALESCE((revision."snapshot"->'expectedCounts'->>'variants')::integer, 0)
      AND (
        SELECT COUNT(*) FROM "ShopKnowledgeChunk" chunk
        WHERE chunk."knowledgeId" = knowledge."id"
          AND chunk."revision" = revision."revision"
      ) = COALESCE((revision."snapshot"->'expectedCounts'->>'chunks')::integer, 0)
      AND (
        SELECT COUNT(*) FROM "ShopProductAttributeValue" attribute
        WHERE attribute."knowledgeId" = knowledge."id"
          AND attribute."revision" = revision."revision"
      ) = COALESCE((revision."snapshot"->'expectedCounts'->>'attributes')::integer, 0)
      AND (
        SELECT COUNT(*) FROM "ShopKnowledgeEvidence" evidence
        WHERE evidence."knowledgeId" = knowledge."id"
          AND evidence."revision" = revision."revision"
      ) = COALESCE((revision."snapshot"->'expectedCounts'->>'evidence')::integer, 0)
      ${knowledgeIdFilter(input.knowledgeIds)}
      AND NOT EXISTS (
        SELECT 1
        FROM "ShopKnowledgeChunk" chunk
        WHERE chunk."knowledgeId" = knowledge."id"
          AND chunk."revision" = knowledge."revision"
          AND (
            chunk."embedding" IS NULL
            OR chunk."embeddingModel" IS DISTINCT FROM ${input.model}
          )
      )
    ORDER BY knowledge."updatedAt" ASC, knowledge."id" ASC
    LIMIT ${input.limit}
    FOR UPDATE OF knowledge, revision SKIP LOCKED
  `;

  let finalized = 0;
  for (const row of rows) {
    const status = targetKnowledgeStatus(row.targetStatus);
    const readyAt = status === ShopKnowledgeStatus.BLOCKED ? null : input.finalizedAt;
    const projection = readKnowledgeProjection(row.snapshot);
    await Promise.all([
      tx.shopVehicleApplication.updateMany({
        where: { knowledgeId: row.knowledgeId, isActive: true },
        data: { isActive: false },
      }),
      tx.shopVariantKnowledge.updateMany({
        where: { knowledgeId: row.knowledgeId, isActive: true },
        data: { isActive: false },
      }),
      tx.shopKnowledgeChunk.updateMany({
        where: { knowledgeId: row.knowledgeId, isActive: true },
        data: { isActive: false },
      }),
      tx.shopProductAttributeValue.updateMany({
        where: { knowledgeId: row.knowledgeId, isActive: true },
        data: { isActive: false },
      }),
      tx.shopKnowledgeEvidence.updateMany({
        where: { knowledgeId: row.knowledgeId, isActive: true },
        data: { isActive: false },
      }),
    ]);
    await Promise.all([
      tx.shopVehicleApplication.updateMany({
        where: { knowledgeId: row.knowledgeId, revision: row.revision },
        data: { isActive: true },
      }),
      tx.shopVariantKnowledge.updateMany({
        where: { knowledgeId: row.knowledgeId, revision: row.revision },
        data: { isActive: true, status, readyAt },
      }),
      tx.shopKnowledgeChunk.updateMany({
        where: { knowledgeId: row.knowledgeId, revision: row.revision },
        data: { isActive: true },
      }),
      tx.shopProductAttributeValue.updateMany({
        where: { knowledgeId: row.knowledgeId, revision: row.revision },
        data: { isActive: true },
      }),
      tx.shopKnowledgeEvidence.updateMany({
        where: { knowledgeId: row.knowledgeId, revision: row.revision },
        data: { isActive: true },
      }),
    ]);
    const updated = await tx.shopProductKnowledge.updateMany({
      where: {
        id: row.knowledgeId,
        revision: row.revision,
      },
      data: {
        activeRevision: row.revision,
        status,
        schemaVersion: projection.schemaVersion,
        completenessScore: projection.completenessScore,
        qualityFlags: projection.qualityFlags,
        sourceUpdatedAt: new Date(projection.sourceUpdatedAt),
        statusChangedAt: input.finalizedAt,
        readyAt,
        failedAt: null,
        failureReason: null,
        vehicleType: projection.vehicleType,
        makes: projection.makes,
        models: projection.models,
        chassisCodes: projection.chassisCodes,
        yearRanges: projection.yearRanges,
        engines: projection.engines,
        bodyStyles: projection.bodyStyles,
        markets: projection.markets,
        categoryGroup: projection.categoryGroup,
        powerGainHp: projection.powerGainHp,
        torqueGainNm: projection.torqueGainNm,
        material: projection.material,
        opfGpf: projection.opfGpf,
        installationType: projection.installationType,
        fitmentStatus: projection.fitmentStatus,
        fitmentSource: projection.fitmentSource,
        applications: projection.applications,
        facts: projection.facts,
        searchText: projection.searchText,
        contentHash: projection.contentHash,
        embeddingModel: input.model,
      },
    });
    if (updated.count === 0) continue;

    await Promise.all([
      tx.shopKnowledgeRevision.updateMany({
        where: {
          knowledgeId: row.knowledgeId,
          revision: row.revision,
          status: ShopKnowledgeStatus.PROCESSING,
        },
        data: {
          status,
          activatedAt: input.finalizedAt,
        },
      }),
    ]);
    finalized += 1;
  }
  if (finalized > 0) {
    await bumpShopKnowledgeCatalogState(tx, input.finalizedAt);
  }
  return finalized;
}

class PrismaShopKnowledgeChunkEmbeddingRepository implements ShopKnowledgeChunkEmbeddingRepository {
  constructor(private readonly client: PrismaClient) {}

  async getEmbeddingBacklog(model: string): Promise<ShopKnowledgeChunkEmbeddingBacklog> {
    const [row] = await this.client.$queryRaw<
      Array<{ chunks: bigint; products: bigint; knowledgeRecords: bigint }>
    >`
      SELECT
        COUNT(*)::bigint AS "chunks",
        COUNT(DISTINCT chunk."productId")::bigint AS "products",
        COUNT(DISTINCT chunk."knowledgeId")::bigint AS "knowledgeRecords"
      FROM "ShopKnowledgeChunk" chunk
      JOIN "ShopProductKnowledge" knowledge
        ON knowledge."id" = chunk."knowledgeId"
      JOIN "ShopKnowledgeRevision" revision
        ON revision."knowledgeId" = chunk."knowledgeId"
       AND revision."revision" = chunk."revision"
      WHERE knowledge."schemaVersion" = ${SHOP_KNOWLEDGE_V2_SCHEMA_VERSION}
        AND knowledge."revision" = chunk."revision"
        AND (
          chunk."embedding" IS NULL
          OR chunk."embeddingModel" IS DISTINCT FROM ${model}
        )
    `;
    return {
      chunks: Number(row?.chunks ?? 0),
      products: Number(row?.products ?? 0),
      knowledgeRecords: Number(row?.knowledgeRecords ?? 0),
    };
  }

  async prepareEmbeddingLifecycle(model: string, now: Date): Promise<number> {
    void now;
    return this.client.$transaction(async (tx) => {
      const prepared = await tx.$executeRaw`
        UPDATE "ShopKnowledgeRevision" revision
        SET
          "status" = 'PROCESSING',
          "activatedAt" = NULL
        FROM "ShopProductKnowledge" knowledge
        WHERE revision."knowledgeId" = knowledge."id"
          AND revision."revision" = knowledge."revision"
          AND knowledge."schemaVersion" = ${SHOP_KNOWLEDGE_V2_SCHEMA_VERSION}
          AND revision."status" IN ('READY', 'NEEDS_REVIEW', 'BLOCKED')
          AND EXISTS (
            SELECT 1
            FROM "ShopKnowledgeChunk" chunk
            WHERE chunk."knowledgeId" = knowledge."id"
              AND chunk."revision" = knowledge."revision"
              AND (
                chunk."embedding" IS NULL
                OR chunk."embeddingModel" IS DISTINCT FROM ${model}
              )
          )
      `;
      return prepared;
    });
  }

  async listPendingChunkEmbeddings(model: string, limit: number) {
    return this.client.$queryRaw<
      Array<{
        id: string;
        knowledgeId: string;
        productId: string;
        revision: number;
        contentHash: string;
        content: string;
      }>
    >`
      SELECT
        chunk."id",
        chunk."knowledgeId",
        chunk."productId",
        chunk."revision",
        chunk."contentHash",
        chunk."content"
      FROM "ShopKnowledgeChunk" chunk
      JOIN "ShopProductKnowledge" knowledge
        ON knowledge."id" = chunk."knowledgeId"
      JOIN "ShopKnowledgeRevision" revision
        ON revision."knowledgeId" = chunk."knowledgeId"
       AND revision."revision" = chunk."revision"
      WHERE knowledge."schemaVersion" = ${SHOP_KNOWLEDGE_V2_SCHEMA_VERSION}
        AND knowledge."revision" = chunk."revision"
        AND revision."status" = 'PROCESSING'
        AND (
          chunk."embedding" IS NULL
          OR chunk."embeddingModel" IS DISTINCT FROM ${model}
        )
      ORDER BY chunk."productId" ASC, chunk."ordinal" ASC, chunk."id" ASC
      LIMIT ${limit}
    `;
  }

  async storeChunkEmbeddings(input: {
    model: string;
    embeddedAt: Date;
    writes: Array<{
      chunkId: string;
      knowledgeId: string;
      revision: number;
      contentHash: string;
      values: number[];
    }>;
  }): Promise<ShopKnowledgeChunkEmbeddingStoreResult> {
    if (input.writes.length === 0) {
      return { embedded: 0, skippedStale: 0, finalizedKnowledge: 0 };
    }

    return this.client.$transaction(
      async (tx) => {
        let embedded = 0;
        for (const write of input.writes) {
          const vector = `[${write.values.join(",")}]`;
          embedded += await tx.$executeRaw`
            UPDATE "ShopKnowledgeChunk" chunk
            SET
              "embedding" = CAST(${vector} AS vector),
              "embeddingModel" = ${input.model},
              "embeddedAt" = ${input.embeddedAt},
              "updatedAt" = CURRENT_TIMESTAMP
            FROM "ShopProductKnowledge" knowledge
            WHERE chunk."id" = ${write.chunkId}
              AND chunk."knowledgeId" = ${write.knowledgeId}
              AND chunk."revision" = ${write.revision}
              AND chunk."contentHash" = ${write.contentHash}
              AND chunk."isActive" = true
              AND knowledge."id" = chunk."knowledgeId"
              AND knowledge."revision" = chunk."revision"
              AND EXISTS (
                SELECT 1 FROM "ShopKnowledgeRevision" revision
                WHERE revision."knowledgeId" = knowledge."id"
                  AND revision."revision" = chunk."revision"
                  AND revision."status" = 'PROCESSING'
              )
              AND (
                chunk."embedding" IS NULL
                OR chunk."embeddingModel" IS DISTINCT FROM ${input.model}
              )
          `;
        }
        const finalizedKnowledge = await finalizeReadyKnowledgeInTransaction(tx, {
          model: input.model,
          finalizedAt: input.embeddedAt,
          limit: Math.max(1, input.writes.length),
          knowledgeIds: input.writes.map((write) => write.knowledgeId),
        });
        return {
          embedded,
          skippedStale: input.writes.length - embedded,
          finalizedKnowledge,
        };
      },
      {
        maxWait: 10_000,
        timeout: 60_000,
      }
    );
  }

  async finalizeReadyKnowledge(input: {
    model: string;
    finalizedAt: Date;
    limit?: number;
    knowledgeIds?: string[];
  }): Promise<number> {
    return this.client.$transaction(
      (tx) =>
        finalizeReadyKnowledgeInTransaction(tx, {
          model: input.model,
          finalizedAt: input.finalizedAt,
          limit: Math.min(5_000, Math.max(1, input.limit ?? 1_000)),
          knowledgeIds: input.knowledgeIds,
        }),
      {
        maxWait: 10_000,
        timeout: 60_000,
      }
    );
  }
}

export function createPrismaShopKnowledgeChunkEmbeddingRepository(
  client: PrismaClient = prisma
): ShopKnowledgeChunkEmbeddingRepository {
  return new PrismaShopKnowledgeChunkEmbeddingRepository(client);
}
