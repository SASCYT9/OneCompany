import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import {
  buildAdroSourceRecordDraft,
  normalizeAdroSnapshotProduct,
  type AdroSnapshotProduct,
} from "../src/lib/shopCatalogAdroNormalization";
import { buildShopCatalogSourceRecordCoverage } from "../src/lib/shopCatalogSourceCoverage";

async function main() {
  const manifestPath = resolve("public", "catalog-fallback", "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
    stores?: Record<string, { file?: string; count?: number }>;
  };
  const descriptor = manifest.stores?.adro;
  if (!descriptor?.file || !Number.isSafeInteger(descriptor.count)) {
    throw new Error("Catalog fallback manifest has no valid ADRO shard");
  }
  const shardPath = resolve(dirname(manifestPath), descriptor.file);
  const raw = await readFile(shardPath, "utf8");
  const expectedHash = /\.([a-f0-9]{12})\.json$/i.exec(descriptor.file)?.[1];
  const actualHash = createHash("sha256").update(raw).digest("hex").slice(0, 12);
  if (expectedHash && expectedHash !== actualHash) throw new Error("ADRO shard hash mismatch");
  const products = JSON.parse(raw) as AdroSnapshotProduct[];
  if (!Array.isArray(products) || products.length !== descriptor.count) {
    throw new Error("ADRO shard count does not match manifest");
  }

  const normalizations = products.map(normalizeAdroSnapshotProduct);
  let rawLeaves = 0;
  let provenanceEntries = 0;
  let activationReady = 0;
  const issueCounts = new Map<string, number>();
  const makeCounts = new Map<string, number>();
  for (const product of products) {
    const draft = buildAdroSourceRecordDraft({ product, sourceRevision: actualHash });
    const coverage = buildShopCatalogSourceRecordCoverage({
      recordKey: draft.sourceRecord.recordKey,
      rawPayload: product,
      provenance: draft.provenance,
    });
    rawLeaves += coverage.leafCount;
    provenanceEntries += draft.provenance.length;
    if (coverage.activationReady && coverage.coveragePercent === 100) activationReady += 1;
    for (const issue of draft.normalization.issues) {
      issueCounts.set(issue, (issueCounts.get(issue) ?? 0) + 1);
    }
    for (const make of new Set(draft.normalization.applications.map((entry) => entry.make))) {
      makeCounts.set(make, (makeCounts.get(make) ?? 0) + 1);
    }
  }
  const report = {
    version: 1,
    immutableInput: { manifest: manifestPath, shard: shardPath, count: products.length, hash: actualHash },
    verified: normalizations.filter((entry) => entry.verification === "VERIFIED").length,
    needsReview: normalizations.filter((entry) => entry.verification === "NEEDS_REVIEW").length,
    applications: normalizations.reduce((sum, entry) => sum + entry.applications.length, 0),
    multiApplicationProducts: normalizations.filter((entry) => entry.applications.length > 1).length,
    generationExactApplications: normalizations.reduce(
      (sum, entry) => sum + entry.applications.filter((application) => application.generation).length,
      0
    ),
    yearExactApplications: normalizations.reduce(
      (sum, entry) => sum + entry.applications.filter((application) => application.yearFrom).length,
      0
    ),
    losslessCoverage: { records: activationReady, rawLeaves, provenanceEntries },
    issues: Object.fromEntries([...issueCounts].sort(([left], [right]) => left.localeCompare(right))),
    makes: Object.fromEntries([...makeCounts].sort(([left], [right]) => left.localeCompare(right))),
    fingerprint: createHash("sha256")
      .update(normalizations.map((entry) => `${entry.recordKey}:${JSON.stringify(entry.applications)}:${entry.verification}`).sort().join("\n"))
      .digest("hex"),
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
