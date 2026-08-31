import "server-only";
import type { PrismaClient } from "@prisma/client";
import type { IpeNormalization } from "./shopCatalogIpeNormalization";
import { persistIpeCompatibilityInTransaction } from "./shopCatalogIpeCompatibility.server";
import { CATALOG_SOURCE_BACKFILL_PAGE_LIMIT, persistCatalogSourceRecordPageWithClient, type CatalogSourceBackfillPageResult, type CatalogSourceRecordDraft } from "./shopCatalogSourceBackfill.server";
export const IPE_BACKFILL_PAGE_LIMIT = CATALOG_SOURCE_BACKFILL_PAGE_LIMIT;
export function persistIpeSourceRecordPageWithClient(client: PrismaClient, input: { drafts: readonly CatalogSourceRecordDraft<IpeNormalization>[]; sourceKey?: string; sourceDisplayName?: string; reviewedById?: string }): Promise<CatalogSourceBackfillPageResult> {
  return persistCatalogSourceRecordPageWithClient(client, input, { label: "iPE", defaultSourceKey: "ipe-snapshot-v1", defaultDisplayName: "iPE immutable snapshot",
    decisionReason: "immutable iPE product identity plus default-variant identity; supplier SKU alone is non-unique", persistCompatibility: persistIpeCompatibilityInTransaction });
}
