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
  sourceRevision: string | null;
  payloadHash: string | null;
  payloadHashMatches: boolean | null;
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
  /** The immutable source revision that produced this payload, when known. */
  sourceRevision?: string | null;
  /** SHA-256 of the exact persisted raw payload, when known. */
  payloadHash?: string | null;
  provenance: readonly ShopCatalogCoverageProvenance[];
}): ShopCatalogSourceRecordCoverage {
  const leaves = flattenShopCatalogRawPayload(input.rawPayload);
  const leafKeys = new Set(leaves.map((leaf) => `${leaf.fieldPath}\u0000${leaf.ordinal}`));
  const provenance = new Map<string, ShopCatalogCoverageProvenance>();
  const missing: ShopCatalogSourceRecordCoverage["missing"] = [];
  const invalid: ShopCatalogSourceRecordCoverage["invalid"] = [];
  // A raw leaf may have exactly one provenance decision.  Do not let a Map
  // silently discard duplicate or orphaned decisions: either case means the
  // immutable evidence cannot be replayed losslessly.
  for (const entry of input.provenance) {
    const key = `${entry.fieldPath}\u0000${entry.ordinal}`;
    if (provenance.has(key)) {
      invalid.push({
        fieldPath: entry.fieldPath,
        ordinal: entry.ordinal,
        reason: "duplicate_provenance",
      });
      continue;
    }
    provenance.set(key, entry);
    if (!leafKeys.has(key)) {
      invalid.push({
        fieldPath: entry.fieldPath,
        ordinal: entry.ordinal,
        reason: "provenance_without_raw_leaf",
      });
    }
  }
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
        invalid.push({
          fieldPath: leaf.fieldPath,
          ordinal: leaf.ordinal,
          reason: "mapped_without_canonical_target",
        });
      }
    } else if (evidence.mappingStatus === "QUARANTINED") {
      quarantinedLeafCount += 1;
      if (!evidence.issueCount) {
        invalid.push({
          fieldPath: leaf.fieldPath,
          ordinal: leaf.ordinal,
          reason: "quarantined_without_issue",
        });
      }
    } else {
      ignoredLeafCount += 1;
      if (!evidence.reason?.trim()) {
        invalid.push({
          fieldPath: leaf.fieldPath,
          ordinal: leaf.ordinal,
          reason: "ignored_without_reason",
        });
      }
    }
  }
  const accountedLeafCount = leaves.length - missing.length;
  const coveragePercent = leaves.length
    ? Math.round((accountedLeafCount / leaves.length) * 10_000) / 100
    : 100;
  // Source rows carry a hash for the immutable envelope.  Include it and the
  // revision in the coverage fingerprint so a report cannot accidentally be
  // reused after the evidence envelope changes while the raw leaves happen to
  // remain the same.  The optional fields preserve the pure raw-coverage API
  // used by normalization tests; the persisted report always supplies them.
  const sourceRevision = input.sourceRevision?.trim() || null;
  const payloadHash = input.payloadHash?.trim().toLowerCase() || null;
  const serializedPayload = JSON.stringify(input.rawPayload);
  const computedPayloadHash =
    serializedPayload === undefined
      ? null
      : createHash("sha256").update(serializedPayload).digest("hex");
  const payloadHashMatches =
    payloadHash == null
      ? null
      : /^[a-f0-9]{64}$/iu.test(payloadHash) &&
        computedPayloadHash !== null &&
        computedPayloadHash === payloadHash;
  const fingerprint = createHash("sha256")
    .update(
      stableJson({
        recordKey: input.recordKey,
        sourceRevision,
        payloadHash,
        leaves: leaves.map(({ fieldPath, ordinal, valueHash }) => ({
          fieldPath,
          ordinal,
          valueHash,
        })),
      })
    )
    .digest("hex");
  return {
    recordKey: input.recordKey,
    sourceRevision,
    payloadHash,
    payloadHashMatches,
    leafCount: leaves.length,
    accountedLeafCount,
    mappedLeafCount,
    quarantinedLeafCount,
    ignoredLeafCount,
    missing,
    invalid,
    coveragePercent,
    activationReady: missing.length === 0 && invalid.length === 0 && payloadHashMatches !== false,
    fingerprint,
  };
}
