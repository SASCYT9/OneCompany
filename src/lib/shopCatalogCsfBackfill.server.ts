import "server-only";
import type { PrismaClient } from "@prisma/client";
import type { CsfNormalization } from "./shopCatalogCsfNormalization";
import { persistCsfCompatibilityInTransaction } from "./shopCatalogCsfCompatibility.server";
import { CATALOG_SOURCE_BACKFILL_PAGE_LIMIT, persistCatalogSourceRecordPageWithClient, type CatalogSourceBackfillPageResult, type CatalogSourceRecordDraft } from "./shopCatalogSourceBackfill.server";
export const CSF_BACKFILL_PAGE_LIMIT = CATALOG_SOURCE_BACKFILL_PAGE_LIMIT;
export function persistCsfSourceRecordPageWithClient(client: PrismaClient, input: { drafts: readonly CatalogSourceRecordDraft<CsfNormalization>[]; sourceKey?: string; sourceDisplayName?: string; reviewedById?: string }): Promise<CatalogSourceBackfillPageResult> {
  return persistCatalogSourceRecordPageWithClient(client, input, { label: "CSF", defaultSourceKey: "csf-snapshot-v1", defaultDisplayName: "CSF immutable snapshot",
    decisionReason: "exact immutable CSF product and default-variant identity", persistCompatibility: persistCsfCompatibilityInTransaction });
}
