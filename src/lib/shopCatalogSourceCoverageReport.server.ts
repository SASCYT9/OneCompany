import "server-only";

import type { PrismaClient } from "@prisma/client";

import { buildShopCatalogSourceRecordCoverage } from "./shopCatalogSourceCoverage";

export const SHOP_CATALOG_SOURCE_COVERAGE_PAGE_LIMIT = 500;

export type ShopCatalogSourceCoverageRecordReport = {
  id: string;
  recordKey: string;
  sourceRevision: string;
  payloadHash: string;
  hasImmutablePayload: boolean;
  payloadAuditable: boolean;
  productId: string | null;
  variantId: string | null;
  currentBindingCount: number;
  mappedBindingCount: number;
  tombstoneBindingCount: number;
  openIssueCount: number;
  rawLeafCount: number;
  accountedLeafCount: number;
  missingLeafCount: number;
  invalidProvenanceCount: number;
  quarantinedLeafCount: number;
  coveragePercent: number;
  activationReady: boolean;
  blockers: string[];
  fingerprint: string | null;
};

export type ShopCatalogSourceCoveragePage = {
  version: 1;
  source: { id: string; key: string; displayName: string; kind: string; isActive: boolean };
  afterRecordId: string | null;
  nextRecordId: string | null;
  complete: boolean;
  records: ShopCatalogSourceCoverageRecordReport[];
  totals: {
    records: number;
    activationReady: number;
    immutablePayloads: number;
    auditablePayloads: number;
    rawLeaves: number;
    accountedLeaves: number;
    missingLeaves: number;
    invalidProvenance: number;
    openIssues: number;
    unmappedRecords: number;
  };
};

function boundedLimit(value: number | undefined) {
  const limit = value ?? 250;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > SHOP_CATALOG_SOURCE_COVERAGE_PAGE_LIMIT) {
    throw new TypeError(`limit must be between 1 and ${SHOP_CATALOG_SOURCE_COVERAGE_PAGE_LIMIT}`);
  }
  return limit;
}

export async function readShopCatalogSourceCoveragePage(
  client: PrismaClient,
  input: { sourceKey: string; afterRecordId?: string | null; limit?: number }
): Promise<ShopCatalogSourceCoveragePage | null> {
  const sourceKey = input.sourceKey.trim().toLowerCase();
  if (!sourceKey || sourceKey.length > 200) throw new TypeError("sourceKey is required");
  const limit = boundedLimit(input.limit);
  const source = await client.shopCatalogSource.findUnique({
    where: { key: sourceKey },
    select: { id: true, key: true, displayName: true, kind: true, isActive: true },
  });
  if (!source) return null;

  const rows = await client.shopCatalogSourceRecord.findMany({
    where: {
      sourceId: source.id,
      supersededBy: null,
      ...(input.afterRecordId ? { id: { gt: input.afterRecordId } } : {}),
    },
    orderBy: { id: "asc" },
    take: limit + 1,
    select: {
      id: true,
      recordKey: true,
      sourceRevision: true,
      rawPayload: true,
      blobRef: true,
      payloadHash: true,
      productId: true,
      variantId: true,
      bindings: {
        select: {
          action: true,
          canonicalEntityId: true,
          productId: true,
          variantId: true,
          currentFor: { select: { id: true } },
        },
      },
      fieldProvenance: {
        select: {
          fieldPath: true,
          ordinal: true,
          mappingStatus: true,
          canonicalEntityId: true,
          canonicalField: true,
          reason: true,
          _count: { select: { issues: true } },
        },
      },
      issues: { where: { status: "OPEN" }, select: { id: true } },
    },
  });
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const records = pageRows.map((row): ShopCatalogSourceCoverageRecordReport => {
    const hasImmutablePayload = row.rawPayload != null || Boolean(row.blobRef);
    const payloadAuditable = row.rawPayload != null;
    const coverage = payloadAuditable
      ? buildShopCatalogSourceRecordCoverage({
          recordKey: row.recordKey,
          rawPayload: row.rawPayload,
          provenance: row.fieldProvenance.map((entry) => ({
            ...entry,
            mappingStatus: entry.mappingStatus,
            issueCount: entry._count.issues,
          })),
        })
      : null;
    const currentBindings = row.bindings.filter((binding) => binding.currentFor != null);
    const mappedBindings = currentBindings.filter(
      (binding) =>
        binding.action === "MAP" &&
        Boolean(binding.canonicalEntityId || binding.productId || binding.variantId)
    );
    const tombstones = currentBindings.filter((binding) => binding.action === "TOMBSTONE");
    const bindingReady =
      Boolean(row.productId || row.variantId) || mappedBindings.length > 0 || tombstones.length > 0;
    const blockers: string[] = [];
    if (!hasImmutablePayload) blockers.push("missing_immutable_payload");
    if (!payloadAuditable) blockers.push("payload_not_inline_auditable");
    if (!bindingReady) blockers.push("missing_current_binding");
    if (coverage?.missing.length) blockers.push("unaccounted_raw_fields");
    if (coverage?.invalid.length) blockers.push("invalid_provenance");
    if (coverage?.quarantinedLeafCount) blockers.push("quarantined_fields");
    if (row.issues.length) blockers.push("open_issues");
    return {
      id: row.id,
      recordKey: row.recordKey,
      sourceRevision: row.sourceRevision,
      payloadHash: row.payloadHash,
      hasImmutablePayload,
      payloadAuditable,
      productId: row.productId,
      variantId: row.variantId,
      currentBindingCount: currentBindings.length,
      mappedBindingCount: mappedBindings.length,
      tombstoneBindingCount: tombstones.length,
      openIssueCount: row.issues.length,
      rawLeafCount: coverage?.leafCount ?? 0,
      accountedLeafCount: coverage?.accountedLeafCount ?? 0,
      missingLeafCount: coverage?.missing.length ?? 0,
      invalidProvenanceCount: coverage?.invalid.length ?? 0,
      quarantinedLeafCount: coverage?.quarantinedLeafCount ?? 0,
      coveragePercent: coverage?.coveragePercent ?? 0,
      activationReady: blockers.length === 0 && Boolean(coverage?.activationReady),
      blockers,
      fingerprint: coverage?.fingerprint ?? null,
    };
  });
  return {
    version: 1,
    source: { ...source, kind: source.kind },
    afterRecordId: input.afterRecordId ?? null,
    nextRecordId: hasMore ? records.at(-1)?.id ?? null : null,
    complete: !hasMore,
    records,
    totals: {
      records: records.length,
      activationReady: records.filter((record) => record.activationReady).length,
      immutablePayloads: records.filter((record) => record.hasImmutablePayload).length,
      auditablePayloads: records.filter((record) => record.payloadAuditable).length,
      rawLeaves: records.reduce((sum, record) => sum + record.rawLeafCount, 0),
      accountedLeaves: records.reduce((sum, record) => sum + record.accountedLeafCount, 0),
      missingLeaves: records.reduce((sum, record) => sum + record.missingLeafCount, 0),
      invalidProvenance: records.reduce((sum, record) => sum + record.invalidProvenanceCount, 0),
      openIssues: records.reduce((sum, record) => sum + record.openIssueCount, 0),
      unmappedRecords: records.filter((record) => record.blockers.includes("missing_current_binding")).length,
    },
  };
}
