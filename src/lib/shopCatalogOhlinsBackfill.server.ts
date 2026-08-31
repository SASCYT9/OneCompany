import "server-only";
import type { PrismaClient } from "@prisma/client";
import type { OhlinsNormalization } from "./shopCatalogOhlinsNormalization";
import { persistOhlinsCompatibilityInTransaction } from "./shopCatalogOhlinsCompatibility.server";
import { CATALOG_SOURCE_BACKFILL_PAGE_LIMIT, persistCatalogSourceRecordPageWithClient, type CatalogSourceBackfillPageResult, type CatalogSourceRecordDraft } from "./shopCatalogSourceBackfill.server";
export const OHLINS_BACKFILL_PAGE_LIMIT = CATALOG_SOURCE_BACKFILL_PAGE_LIMIT;
export function persistOhlinsSourceRecordPageWithClient(client: PrismaClient, input: { drafts: readonly CatalogSourceRecordDraft<OhlinsNormalization>[]; sourceKey?: string; sourceDisplayName?: string; reviewedById?: string }): Promise<CatalogSourceBackfillPageResult> {
  return persistCatalogSourceRecordPageWithClient(client, input, { label: "Ohlins", defaultSourceKey: "ohlins-snapshot-v1", defaultDisplayName: "Ohlins immutable snapshot",
    decisionReason: "exact immutable Ohlins product and default-variant identity", persistCompatibility: persistOhlinsCompatibilityInTransaction });
}
