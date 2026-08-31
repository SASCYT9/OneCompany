import "server-only";
import type { PrismaClient } from "@prisma/client";
import type { Do88Normalization } from "./shopCatalogDo88Normalization";
import { persistDo88CompatibilityInTransaction } from "./shopCatalogDo88Compatibility.server";
import { CATALOG_SOURCE_BACKFILL_PAGE_LIMIT, persistCatalogSourceRecordPageWithClient, type CatalogSourceBackfillPageResult, type CatalogSourceRecordDraft } from "./shopCatalogSourceBackfill.server";
export const DO88_BACKFILL_PAGE_LIMIT = CATALOG_SOURCE_BACKFILL_PAGE_LIMIT;
export function persistDo88SourceRecordPageWithClient(client: PrismaClient, input: { drafts: readonly CatalogSourceRecordDraft<Do88Normalization>[]; sourceKey?: string; sourceDisplayName?: string; reviewedById?: string }): Promise<CatalogSourceBackfillPageResult> {
  return persistCatalogSourceRecordPageWithClient(client, input, { label: "do88", defaultSourceKey: "do88-snapshot-v1", defaultDisplayName: "do88 immutable snapshot",
    decisionReason: "exact immutable do88 product and default-variant identity", persistCompatibility: persistDo88CompatibilityInTransaction });
}
