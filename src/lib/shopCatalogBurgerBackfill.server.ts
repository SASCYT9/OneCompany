import "server-only";
import type { PrismaClient } from "@prisma/client";
import type { BurgerNormalization } from "./shopCatalogBurgerNormalization";
import { persistBurgerCompatibilityInTransaction } from "./shopCatalogBurgerCompatibility.server";
import { CATALOG_SOURCE_BACKFILL_PAGE_LIMIT, persistCatalogSourceRecordPageWithClient, type CatalogSourceBackfillPageResult, type CatalogSourceRecordDraft } from "./shopCatalogSourceBackfill.server";
export const BURGER_BACKFILL_PAGE_LIMIT = CATALOG_SOURCE_BACKFILL_PAGE_LIMIT;
export function persistBurgerSourceRecordPageWithClient(client: PrismaClient, input: { drafts: readonly CatalogSourceRecordDraft<BurgerNormalization>[]; sourceKey?: string; sourceDisplayName?: string; reviewedById?: string }): Promise<CatalogSourceBackfillPageResult> {
  return persistCatalogSourceRecordPageWithClient(client, input, { label: "Burger", defaultSourceKey: "burger-snapshot-v1", defaultDisplayName: "Burger immutable snapshot", decisionReason: "exact immutable Burger product and slug identity; SKU is non-unique", persistCompatibility: persistBurgerCompatibilityInTransaction }); }
