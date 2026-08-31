import "server-only";

import type { PrismaClient } from "@prisma/client";

import type { BrabusNormalization } from "./shopCatalogBrabusNormalization";
import { persistBrabusCompatibilityInTransaction } from "./shopCatalogBrabusCompatibility.server";
import {
  CATALOG_SOURCE_BACKFILL_PAGE_LIMIT,
  persistCatalogSourceRecordPageWithClient,
  type CatalogSourceBackfillPageResult,
  type CatalogSourceRecordDraft,
} from "./shopCatalogSourceBackfill.server";

export const BRABUS_BACKFILL_PAGE_LIMIT = CATALOG_SOURCE_BACKFILL_PAGE_LIMIT;

export function persistBrabusSourceRecordPageWithClient(
  client: PrismaClient,
  input: {
    drafts: readonly CatalogSourceRecordDraft<BrabusNormalization>[];
    sourceKey?: string;
    sourceDisplayName?: string;
    reviewedById?: string;
  }
): Promise<CatalogSourceBackfillPageResult> {
  return persistCatalogSourceRecordPageWithClient(client, input, {
    label: "Brabus",
    defaultSourceKey: "brabus-snapshot-v1",
    defaultDisplayName: "Brabus immutable snapshot",
    decisionReason: "exact immutable Brabus product and default-variant identity",
    persistCompatibility: persistBrabusCompatibilityInTransaction,
  });
}
