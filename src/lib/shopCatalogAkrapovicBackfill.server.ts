import "server-only";
import type { PrismaClient } from "@prisma/client";
import type { AkrapovicNormalization } from "./shopCatalogAkrapovicNormalization";
import { persistAkrapovicCompatibilityInTransaction } from "./shopCatalogAkrapovicCompatibility.server";
import { CATALOG_SOURCE_BACKFILL_PAGE_LIMIT, persistCatalogSourceRecordPageWithClient, type CatalogSourceBackfillPageResult, type CatalogSourceRecordDraft } from "./shopCatalogSourceBackfill.server";
export const AKRAPOVIC_BACKFILL_PAGE_LIMIT = CATALOG_SOURCE_BACKFILL_PAGE_LIMIT;
export function persistAkrapovicSourceRecordPageWithClient(client: PrismaClient, input: { drafts: readonly CatalogSourceRecordDraft<AkrapovicNormalization>[]; sourceKey?: string; sourceDisplayName?: string; reviewedById?: string }): Promise<CatalogSourceBackfillPageResult> {
  return persistCatalogSourceRecordPageWithClient(client, input, { label: "Akrapovic", defaultSourceKey: "akrapovic-snapshot-v1", defaultDisplayName: "Akrapovic immutable snapshot",
    decisionReason: "exact immutable Akrapovic product and default-variant identity", persistCompatibility: persistAkrapovicCompatibilityInTransaction });
}
