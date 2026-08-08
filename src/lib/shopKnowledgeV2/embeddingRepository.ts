import { Prisma, ShopKnowledgeStatus, type PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { bumpShopKnowledgeCatalogState } from "@/lib/shopKnowledgeV2/catalogState";
import {
  SHOP_KNOWLEDGE_EMBEDDING_FINALIZATION_BATCH_SIZE,
  SHOP_KNOWLEDGE_EMBEDDING_TRANSACTION_TIMEOUT_MS,
  type ShopKnowledgeChunkEmbeddingBacklog,
  type ShopKnowledgeChunkEmbeddingRepository,
  type ShopKnowledgeChunkEmbeddingScope,
  type ShopKnowledgeChunkEmbeddingStoreResult,
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

function productScopeClause(scope?: ShopKnowledgeChunkEmbeddingScope) {
  const productIds = scope?.productIds;
  const categoryGroups = scope?.categoryGroups;
  const clauses: Prisma.Sql[] = [];
  if (productIds !== undefined) {
    const uniqueIds = Array.from(new Set(productIds.map((value) => value.trim()).filter(Boolean)));
    clauses.push(
      uniqueIds.length > 0
        ? Prisma.sql`knowledge."productId" IN (${Prisma.join(uniqueIds)})`
        : Prisma.sql`FALSE`
    );
  }
  if (categoryGroups !== undefined) {
    const uniqueCategories = Array.from(
      new Set(categoryGroups.map((value) => value.trim()).filter(Boolean))
    );
    clauses.push(
      uniqueCategories.length > 0
        ? Prisma.sql`knowledge."categoryGroup" IN (${Prisma.join(uniqueCategories)})`
        : Prisma.sql`FALSE`
    );
  }
  return clauses.length > 0 ? Prisma.sql`AND (${Prisma.join(clauses, " AND ")})` : Prisma.empty;
}

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
    scope?: ShopKnowledgeChunkEmbeddingScope;
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
      ${productScopeClause(input.scope)}
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

  if (rows.length === 0) return 0;

  const preparedRows = rows.map((row) => {
    const status = targetKnowledgeStatus(row.targetStatus);
    return {
      row,
      status,
      readyAt: status === ShopKnowledgeStatus.BLOCKED ? null : input.finalizedAt,
      projection: readKnowledgeProjection(row.snapshot),
    };
  });
  const knowledgeIds = preparedRows.map(({ row }) => row.knowledgeId);
  const revisionWhere = preparedRows.map(({ row }) => ({
    knowledgeId: row.knowledgeId,
    revision: row.revision,
  }));

  await Promise.all([
    tx.shopVehicleApplication.updateMany({
      where: { knowledgeId: { in: knowledgeIds }, isActive: true },
      data: { isActive: false },
    }),
    tx.shopVariantKnowledge.updateMany({
      where: { knowledgeId: { in: knowledgeIds }, isActive: true },
      data: { isActive: false },
    }),
    tx.shopKnowledgeChunk.updateMany({
      where: { knowledgeId: { in: knowledgeIds }, isActive: true },
      data: { isActive: false },
    }),
    tx.shopProductAttributeValue.updateMany({
      where: { knowledgeId: { in: knowledgeIds }, isActive: true },
      data: { isActive: false },
    }),
    tx.shopKnowledgeEvidence.updateMany({
      where: { knowledgeId: { in: knowledgeIds }, isActive: true },
      data: { isActive: false },
    }),
  ]);
  await Promise.all([
    tx.shopVehicleApplication.updateMany({
      where: { OR: revisionWhere },
      data: { isActive: true },
    }),
    tx.shopKnowledgeChunk.updateMany({
      where: { OR: revisionWhere },
      data: { isActive: true },
    }),
    tx.shopProductAttributeValue.updateMany({
      where: { OR: revisionWhere },
      data: { isActive: true },
    }),
    tx.shopKnowledgeEvidence.updateMany({
      where: { OR: revisionWhere },
      data: { isActive: true },
    }),
    ...Object.values(ShopKnowledgeStatus).map((status) => {
      const statusRows = preparedRows.filter((candidate) => candidate.status === status);
      if (statusRows.length === 0) return Promise.resolve({ count: 0 });
      return tx.shopVariantKnowledge.updateMany({
        where: {
          OR: statusRows.map(({ row }) => ({
            knowledgeId: row.knowledgeId,
            revision: row.revision,
          })),
        },
        data: {
          isActive: true,
          status,
          readyAt: status === ShopKnowledgeStatus.BLOCKED ? null : input.finalizedAt,
        },
      });
    }),
  ]);

  const knowledgeUpdates = await Promise.all(
    preparedRows.map(({ row, status, readyAt, projection }) =>
      tx.shopProductKnowledge.updateMany({
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
      })
    )
  );
  if (knowledgeUpdates.reduce((sum, update) => sum + update.count, 0) !== preparedRows.length) {
    throw new Error("Knowledge revision changed during finalization");
  }

  const revisionUpdates = await Promise.all(
    Object.values(ShopKnowledgeStatus).map((status) => {
      const statusRows = preparedRows.filter((candidate) => candidate.status === status);
      if (statusRows.length === 0) return Promise.resolve({ count: 0 });
      return tx.shopKnowledgeRevision.updateMany({
        where: {
          status: ShopKnowledgeStatus.PROCESSING,
          OR: statusRows.map(({ row }) => ({
            knowledgeId: row.knowledgeId,
            revision: row.revision,
          })),
        },
        data: {
          status,
          activatedAt: input.finalizedAt,
        },
      });
    })
  );
  if (revisionUpdates.reduce((sum, update) => sum + update.count, 0) !== preparedRows.length) {
    throw new Error("Knowledge revision status changed during finalization");
  }

  await bumpShopKnowledgeCatalogState(tx, input.finalizedAt);
  return preparedRows.length;
}

class PrismaShopKnowledgeChunkEmbeddingRepository implements ShopKnowledgeChunkEmbeddingRepository {
  constructor(private readonly client: PrismaClient) {}

  async getEmbeddingBacklog(
    model: string,
    scope?: ShopKnowledgeChunkEmbeddingScope
  ): Promise<ShopKnowledgeChunkEmbeddingBacklog> {
    const [row] = await this.client.$queryRaw<
      Array<{
        chunks: bigint;
        products: bigint;
        knowledgeRecords: bigint;
        estimatedTokens: bigint;
      }>
    >`
      SELECT
        COUNT(*)::bigint AS "chunks",
        COUNT(DISTINCT chunk."productId")::bigint AS "products",
        COUNT(DISTINCT chunk."knowledgeId")::bigint AS "knowledgeRecords",
        COALESCE(
          SUM(COALESCE(chunk."tokenCount", CEIL(length(chunk."content")::numeric / 4))),
          0
        )::bigint AS "estimatedTokens"
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
        ${productScopeClause(scope)}
    `;
    return {
      chunks: Number(row?.chunks ?? 0),
      products: Number(row?.products ?? 0),
      knowledgeRecords: Number(row?.knowledgeRecords ?? 0),
      estimatedTokens: Number(row?.estimatedTokens ?? 0),
    };
  }

  async prepareEmbeddingLifecycle(
    model: string,
    now: Date,
    scope?: ShopKnowledgeChunkEmbeddingScope
  ): Promise<number> {
    void now;
    return this.client.$executeRaw`
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
        ${productScopeClause(scope)}
        )
    `;
  }

  async listPendingChunkEmbeddings(
    model: string,
    limit: number,
    scope?: ShopKnowledgeChunkEmbeddingScope
  ) {
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
        ${productScopeClause(scope)}
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

    const values = Prisma.join(
      input.writes.map((write) => {
        const vector = `[${write.values.join(",")}]`;
        return Prisma.sql`(
          ${write.chunkId}::text,
          ${write.knowledgeId}::text,
          ${write.revision}::integer,
          ${write.contentHash}::text,
          CAST(${vector} AS vector)
        )`;
      })
    );
    const embedded = await this.client.$executeRaw`
      UPDATE "ShopKnowledgeChunk" chunk
      SET
        "embedding" = incoming."embedding",
        "embeddingModel" = ${input.model},
        "embeddedAt" = ${input.embeddedAt},
        "updatedAt" = CURRENT_TIMESTAMP
      FROM (
        VALUES ${values}
      ) AS incoming("chunkId", "knowledgeId", "revision", "contentHash", "embedding")
      JOIN "ShopProductKnowledge" knowledge
        ON knowledge."id" = incoming."knowledgeId"
       AND knowledge."revision" = incoming."revision"
      JOIN "ShopKnowledgeRevision" revision
        ON revision."knowledgeId" = incoming."knowledgeId"
       AND revision."revision" = incoming."revision"
       AND revision."status" = 'PROCESSING'
      WHERE chunk."id" = incoming."chunkId"
        AND chunk."knowledgeId" = incoming."knowledgeId"
        AND chunk."revision" = incoming."revision"
        AND chunk."contentHash" = incoming."contentHash"
        AND (
          chunk."embedding" IS NULL
          OR chunk."embeddingModel" IS DISTINCT FROM ${input.model}
        )
    `;
    const knowledgeIds = Array.from(new Set(input.writes.map((write) => write.knowledgeId)));
    const finalizedKnowledge = await this.finalizeReadyKnowledge({
      model: input.model,
      finalizedAt: input.embeddedAt,
      limit: knowledgeIds.length,
      knowledgeIds,
    });
    return {
      embedded,
      skippedStale: input.writes.length - embedded,
      finalizedKnowledge,
    };
  }

  async finalizeReadyKnowledge(input: {
    model: string;
    finalizedAt: Date;
    limit?: number;
    knowledgeIds?: string[];
    scope?: ShopKnowledgeChunkEmbeddingScope;
  }): Promise<number> {
    const limit = Math.min(5_000, Math.max(1, input.limit ?? 1_000));
    const knowledgeIds = input.knowledgeIds
      ? Array.from(new Set(input.knowledgeIds.map((value) => value.trim()).filter(Boolean)))
      : undefined;
    let finalized = 0;

    if (knowledgeIds) {
      for (
        let cursor = 0;
        cursor < knowledgeIds.length && finalized < limit;
        cursor += SHOP_KNOWLEDGE_EMBEDDING_FINALIZATION_BATCH_SIZE
      ) {
        const batchKnowledgeIds = knowledgeIds.slice(
          cursor,
          cursor + SHOP_KNOWLEDGE_EMBEDDING_FINALIZATION_BATCH_SIZE
        );
        const batchLimit = Math.min(batchKnowledgeIds.length, limit - finalized);
        finalized += await this.client.$transaction(
          (tx) =>
            finalizeReadyKnowledgeInTransaction(tx, {
              model: input.model,
              finalizedAt: input.finalizedAt,
              limit: batchLimit,
              knowledgeIds: batchKnowledgeIds,
              scope: input.scope,
            }),
          {
            maxWait: 10_000,
            timeout: SHOP_KNOWLEDGE_EMBEDDING_TRANSACTION_TIMEOUT_MS,
          }
        );
      }
      return finalized;
    }

    while (finalized < limit) {
      const batchLimit = Math.min(
        SHOP_KNOWLEDGE_EMBEDDING_FINALIZATION_BATCH_SIZE,
        limit - finalized
      );
      const batchFinalized = await this.client.$transaction(
        (tx) =>
          finalizeReadyKnowledgeInTransaction(tx, {
            model: input.model,
            finalizedAt: input.finalizedAt,
            limit: batchLimit,
            scope: input.scope,
          }),
        {
          maxWait: 10_000,
          timeout: SHOP_KNOWLEDGE_EMBEDDING_TRANSACTION_TIMEOUT_MS,
        }
      );
      finalized += batchFinalized;
      if (batchFinalized < batchLimit) break;
    }

    return finalized;
  }
}

export function createPrismaShopKnowledgeChunkEmbeddingRepository(
  client: PrismaClient = prisma
): ShopKnowledgeChunkEmbeddingRepository {
  return new PrismaShopKnowledgeChunkEmbeddingRepository(client);
}
