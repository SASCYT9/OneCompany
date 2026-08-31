import "server-only";
import type { PrismaClient } from "@prisma/client";
import type { GirodiscNormalization } from "./shopCatalogGirodiscNormalization";
import { persistGirodiscCompatibilityInTransaction } from "./shopCatalogGirodiscCompatibility.server";
import { CATALOG_SOURCE_BACKFILL_PAGE_LIMIT, persistCatalogSourceRecordPageWithClient, type CatalogSourceBackfillPageResult, type CatalogSourceRecordDraft } from "./shopCatalogSourceBackfill.server";
export const GIRODISC_BACKFILL_PAGE_LIMIT = CATALOG_SOURCE_BACKFILL_PAGE_LIMIT;
export function persistGirodiscSourceRecordPageWithClient(client: PrismaClient, input: { drafts: readonly CatalogSourceRecordDraft<GirodiscNormalization>[]; sourceKey?: string; sourceDisplayName?: string; reviewedById?: string }): Promise<CatalogSourceBackfillPageResult> {
  return persistCatalogSourceRecordPageWithClient(client, input, { label: "GiroDisc", defaultSourceKey: "girodisc-snapshot-v1", defaultDisplayName: "GiroDisc immutable snapshot",
    decisionReason: "exact immutable GiroDisc product and default-variant identity", persistCompatibility: persistGirodiscCompatibilityInTransaction });
}
