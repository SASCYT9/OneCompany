import "server-only";

import type { PrismaClient } from "@prisma/client";

import { persistSupplementalCompatibilityInTransaction } from "./shopCatalogSupplementalCompatibility.server";
import {
  CATALOG_SOURCE_BACKFILL_PAGE_LIMIT,
  persistCatalogSourceRecordPageWithClient,
  type CatalogSourceBackfillPageResult,
  type CatalogSourceRecordDraft,
} from "./shopCatalogSourceBackfill.server";
import {
  SHOP_CATALOG_SUPPLEMENTAL_SOURCES,
  type ShopCatalogSupplementalSource,
  type SupplementalCatalogNormalization,
} from "./shopCatalogSupplementalNormalization";

export const SUPPLEMENTAL_BACKFILL_PAGE_LIMIT = CATALOG_SOURCE_BACKFILL_PAGE_LIMIT;

function persister(source: ShopCatalogSupplementalSource) {
  const descriptor = SHOP_CATALOG_SUPPLEMENTAL_SOURCES[source];
  return (
    client: PrismaClient,
    input: {
      drafts: readonly CatalogSourceRecordDraft<SupplementalCatalogNormalization>[];
      sourceKey?: string;
      sourceDisplayName?: string;
      reviewedById?: string;
    }
  ): Promise<CatalogSourceBackfillPageResult> => {
    if (input.drafts.some((draft) => draft.normalization.source !== source)) {
      throw new TypeError(`${descriptor.brand} backfill received a draft from another source`);
    }
    return persistCatalogSourceRecordPageWithClient(client, input, {
      label: descriptor.brand,
      defaultSourceKey: descriptor.sourceKey,
      defaultDisplayName: descriptor.displayName,
      decisionReason:
        "exact immutable catalog product identity; compatibility awaits reviewed evidence",
      persistCompatibility: persistSupplementalCompatibilityInTransaction,
    });
  };
}

export const persistBootmod3SourceRecordPageWithClient = persister("bootmod3");
export const persistFiExhaustSupplementalSourceRecordPageWithClient = persister("fi-exhaust");
export const persistGSportSourceRecordPageWithClient = persister("g-sport");
export const persistKwSuspensionsSupplementalSourceRecordPageWithClient =
  persister("kw-suspensions");
