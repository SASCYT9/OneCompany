import "server-only";
import type { PrismaClient } from "@prisma/client";
import type { UrbanNormalization } from "./shopCatalogUrbanNormalization";
import { persistUrbanCompatibilityInTransaction } from "./shopCatalogUrbanCompatibility.server";
import { CATALOG_SOURCE_BACKFILL_PAGE_LIMIT, persistCatalogSourceRecordPageWithClient, type CatalogSourceBackfillPageResult, type CatalogSourceRecordDraft } from "./shopCatalogSourceBackfill.server";
export const URBAN_BACKFILL_PAGE_LIMIT = CATALOG_SOURCE_BACKFILL_PAGE_LIMIT;
export function persistUrbanSourceRecordPageWithClient(client: PrismaClient, input: { drafts: readonly CatalogSourceRecordDraft<UrbanNormalization>[]; sourceKey?: string; sourceDisplayName?: string; reviewedById?: string }): Promise<CatalogSourceBackfillPageResult> {
  return persistCatalogSourceRecordPageWithClient(client, input, { label: "Urban", defaultSourceKey: "urban-snapshot-v1", defaultDisplayName: "Urban immutable snapshot",
    decisionReason: "exact immutable Urban product and default-variant identity", persistCompatibility: persistUrbanCompatibilityInTransaction });
}
