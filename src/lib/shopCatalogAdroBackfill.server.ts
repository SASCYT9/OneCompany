import "server-only";

import type { PrismaClient } from "@prisma/client";

import type { AdroNormalization } from "./shopCatalogAdroNormalization";
import { persistAdroCompatibilityInTransaction } from "./shopCatalogAdroCompatibility.server";
import {
  CATALOG_SOURCE_BACKFILL_PAGE_LIMIT,
  persistCatalogSourceRecordPageWithClient,
  type CatalogSourceBackfillPageResult,
  type CatalogSourceRecordDraft,
} from "./shopCatalogSourceBackfill.server";

export const ADRO_BACKFILL_PAGE_LIMIT = CATALOG_SOURCE_BACKFILL_PAGE_LIMIT;

export function persistAdroSourceRecordPageWithClient(
  client: PrismaClient,
  input: {
    drafts: readonly CatalogSourceRecordDraft<AdroNormalization>[];
    sourceKey?: string;
    sourceDisplayName?: string;
    reviewedById?: string;
  }
): Promise<CatalogSourceBackfillPageResult> {
  return persistCatalogSourceRecordPageWithClient(client, input, {
    label: "ADRO",
    defaultSourceKey: "adro-snapshot-v1",
    defaultDisplayName: "ADRO immutable snapshot",
    decisionReason: "exact immutable ADRO product and default-variant identity",
    persistCompatibility: persistAdroCompatibilityInTransaction,
  });
}
