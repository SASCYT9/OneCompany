import type { Prisma } from "@prisma/client";

import { prisma } from "./prisma";
import {
  buildShopCatalogProjection,
  SHOP_CATALOG_PROJECTION_LIMITS,
  type ShopCatalogProjectionSource,
} from "./shopCatalogProjection.server";
import type { ShopCatalogProjectionRebuildSource } from "./shopCatalogProjectionPersistence.server";

export const SHOP_CATALOG_REVISION_SNAPSHOT_SCHEMA_VERSION = 1 as const;

export type ShopCatalogRevisionSnapshot = {
  schemaVersion: typeof SHOP_CATALOG_REVISION_SNAPSHOT_SCHEMA_VERSION;
  /** Complete immutable canonical payload. The projection never replaces it. */
  canonical: unknown;
  /** Compact, rebuildable derivative required by the storefront projection. */
  projectionSource: ShopCatalogProjectionSource;
};

export type ShopCatalogProjectionRevisionRow = {
  productId: string;
  catalogVersion: bigint;
  revisionId: string | null;
  revisionVersion: bigint | null;
  contentHash: string | null;
  createdAt: Date | null;
  snapshot: Prisma.JsonValue | null;
};

export type ShopCatalogProjectionRevisionReader = {
  loadRows(input: {
    afterProductId: string | null;
    limit: number;
  }): Promise<readonly ShopCatalogProjectionRevisionRow[]>;
};

function objectValue(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * Reads the compact derivative from a lossless immutable revision, then
 * replaces identity/version/hash fields with authoritative ledger columns.
 */
export function projectionSourceFromRevision(
  row: ShopCatalogProjectionRevisionRow
): ShopCatalogProjectionSource {
  if (
    !row.revisionId ||
    row.revisionVersion === null ||
    !row.contentHash ||
    !row.createdAt ||
    row.snapshot === null
  ) {
    throw new Error(
      `Catalog product ${row.productId}@${row.catalogVersion} has no exact immutable revision`
    );
  }
  if (row.revisionVersion !== row.catalogVersion) {
    throw new Error(
      `Catalog product ${row.productId} points to revision ${row.revisionVersion}, expected ${row.catalogVersion}`
    );
  }
  const snapshot = objectValue(row.snapshot);
  if (snapshot?.schemaVersion !== SHOP_CATALOG_REVISION_SNAPSHOT_SCHEMA_VERSION) {
    throw new Error(`Catalog revision ${row.revisionId} has an unsupported snapshot schema`);
  }
  if (!("canonical" in snapshot)) {
    throw new Error(`Catalog revision ${row.revisionId} is missing its canonical payload`);
  }
  const derivative = objectValue(snapshot.projectionSource);
  if (!derivative) {
    throw new Error(`Catalog revision ${row.revisionId} is missing projectionSource`);
  }
  if (derivative.productId !== undefined && derivative.productId !== row.productId) {
    throw new Error(`Catalog revision ${row.revisionId} projectionSource productId mismatch`);
  }
  const source = {
    ...derivative,
    productId: row.productId,
    sourceVersion: row.catalogVersion.toString(),
    catalogVersion: row.catalogVersion.toString(),
    sourceUpdatedAt: row.createdAt.toISOString(),
    canonicalContentHash: row.contentHash,
  } as ShopCatalogProjectionSource;
  buildShopCatalogProjection(source);
  return Object.freeze(source);
}

export const prismaShopCatalogProjectionRevisionReader: ShopCatalogProjectionRevisionReader = {
  async loadRows({ afterProductId, limit }) {
    return prisma.$queryRaw<ShopCatalogProjectionRevisionRow[]>`
      SELECT
        product."id" AS "productId",
        product."catalogVersion" AS "catalogVersion",
        revision."id" AS "revisionId",
        revision."version" AS "revisionVersion",
        revision."contentHash" AS "contentHash",
        revision."createdAt" AS "createdAt",
        revision."snapshot" AS "snapshot"
      FROM "ShopProduct" product
      LEFT JOIN "ShopCatalogProductRevision" revision
        ON revision."productId" = product."id"
       AND revision."version" = product."catalogVersion"
      WHERE product."catalogVersion" > 0
        AND (${afterProductId}::text IS NULL OR product."id" > ${afterProductId})
      ORDER BY product."id" ASC
      LIMIT ${limit}
    `;
  },
};

export class RevisionBackedShopCatalogProjectionSource
  implements ShopCatalogProjectionRebuildSource
{
  constructor(
    private readonly reader: ShopCatalogProjectionRevisionReader = prismaShopCatalogProjectionRevisionReader
  ) {}

  async loadPage(input: { afterProductId: string | null; limit: number }) {
    if (
      !Number.isSafeInteger(input.limit) ||
      input.limit < 1 ||
      input.limit > SHOP_CATALOG_PROJECTION_LIMITS.batchSize
    ) {
      throw new TypeError(
        `limit must be between 1 and ${SHOP_CATALOG_PROJECTION_LIMITS.batchSize}`
      );
    }
    if (input.afterProductId !== null && !input.afterProductId.trim()) {
      throw new TypeError("afterProductId must be null or a non-empty product ID");
    }
    const rows = await this.reader.loadRows(input);
    if (rows.length > input.limit) {
      throw new Error("Revision reader returned more rows than requested");
    }
    const sources = rows.map(projectionSourceFromRevision);
    for (let index = 1; index < sources.length; index += 1) {
      if (sources[index - 1]!.productId.localeCompare(sources[index]!.productId, "en") >= 0) {
        throw new Error("Revision reader must return strictly increasing product IDs");
      }
    }
    return Object.freeze(sources);
  }
}
