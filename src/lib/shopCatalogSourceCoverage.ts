import { createHash } from "node:crypto";

export type ShopCatalogRawLeaf = {
  fieldPath: string;
  ordinal: number;
  value: unknown;
  valueHash: string;
};

export type ShopCatalogCoverageProvenance = {
  fieldPath: string;
  ordinal: number;
  mappingStatus: "MAPPED" | "QUARANTINED" | "IGNORED_WITH_REASON";
  canonicalEntityId?: string | null;
  canonicalField?: string | null;
  reason?: string | null;
  issueCount?: number;
};

export type ShopCatalogSourceRecordCoverage = {
  recordKey: string;
  leafCount: number;
  accountedLeafCount: number;
  mappedLeafCount: number;
  quarantinedLeafCount: number;
  ignoredLeafCount: number;
  missing: Array<{ fieldPath: string; ordinal: number }>;
  invalid: Array<{ fieldPath: string; ordinal: number; reason: string }>;
  coveragePercent: number;
  activationReady: boolean;
  fingerprint: string;
};

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
    .join(",")}}`;
}

export function flattenShopCatalogRawPayload(payload: unknown): ShopCatalogRawLeaf[] {
  const occurrences = new Map<string, number>();
  const leaves: ShopCatalogRawLeaf[] = [];
  function appendLeaf(value: unknown, path: string) {
    const fieldPath = path || "$";
    const ordinal = occurrences.get(fieldPath) ?? 0;
    occurrences.set(fieldPath, ordinal + 1);
    leaves.push({
      fieldPath,
      ordinal,
      value,
      valueHash: createHash("sha256").update(stableJson(value)).digest("hex"),
    });
  }
  function visit(value: unknown, path: string) {
    if (Array.isArray(value)) {
      if (value.length === 0) appendLeaf([], path);
      else for (const entry of value) visit(entry, path);
      return;
    }
    if (value && typeof value === "object") {
      const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
        a.localeCompare(b)
      );
      if (entries.length === 0) appendLeaf({}, path);
      else for (const [key, entry] of entries) visit(entry, path ? `${path}.${key}` : key);
      return;
    }
    appendLeaf(value, path);
  }
  visit(payload, "");
  return leaves;
}

export function buildShopCatalogSourceRecordCoverage(input: {
  recordKey: string;
  rawPayload: unknown;
  provenance: readonly ShopCatalogCoverageProvenance[];
}): ShopCatalogSourceRecordCoverage {
  const leaves = flattenShopCatalogRawPayload(input.rawPayload);
  const provenance = new Map(
    input.provenance.map((entry) => [`${entry.fieldPath}\u0000${entry.ordinal}`, entry])
  );
  const missing: ShopCatalogSourceRecordCoverage["missing"] = [];
  const invalid: ShopCatalogSourceRecordCoverage["invalid"] = [];
  let mappedLeafCount = 0;
  let quarantinedLeafCount = 0;
  let ignoredLeafCount = 0;
  for (const leaf of leaves) {
    const evidence = provenance.get(`${leaf.fieldPath}\u0000${leaf.ordinal}`);
    if (!evidence) {
      missing.push({ fieldPath: leaf.fieldPath, ordinal: leaf.ordinal });
      continue;
    }
    if (evidence.mappingStatus === "MAPPED") {
      mappedLeafCount += 1;
      if (!evidence.canonicalEntityId?.trim() || !evidence.canonicalField?.trim()) {
        invalid.push({ fieldPath: leaf.fieldPath, ordinal: leaf.ordinal, reason: "mapped_without_canonical_target" });
      }
    } else if (evidence.mappingStatus === "QUARANTINED") {
      quarantinedLeafCount += 1;
      if (!evidence.issueCount) {
        invalid.push({ fieldPath: leaf.fieldPath, ordinal: leaf.ordinal, reason: "quarantined_without_issue" });
      }
    } else {
      ignoredLeafCount += 1;
      if (!evidence.reason?.trim()) {
        invalid.push({ fieldPath: leaf.fieldPath, ordinal: leaf.ordinal, reason: "ignored_without_reason" });
      }
    }
  }
  const accountedLeafCount = leaves.length - missing.length;
  const coveragePercent = leaves.length
    ? Math.round((accountedLeafCount / leaves.length) * 10_000) / 100
    : 100;
  const fingerprint = createHash("sha256")
    .update(stableJson({ recordKey: input.recordKey, leaves: leaves.map(({ fieldPath, ordinal, valueHash }) => ({ fieldPath, ordinal, valueHash })) }))
    .digest("hex");
  return {
    recordKey: input.recordKey,
    leafCount: leaves.length,
    accountedLeafCount,
    mappedLeafCount,
    quarantinedLeafCount,
    ignoredLeafCount,
    missing,
    invalid,
    coveragePercent,
    activationReady: missing.length === 0 && invalid.length === 0,
    fingerprint,
  };
}
