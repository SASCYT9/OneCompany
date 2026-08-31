import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import {
  buildEventuriSourceRecordDraft,
  normalizeEventuriSnapshotProduct,
  type EventuriSnapshotProduct,
} from "../src/lib/shopCatalogEventuriNormalization";
import { buildShopCatalogSourceRecordCoverage } from "../src/lib/shopCatalogSourceCoverage";

async function main() {
  const manifestPath = resolve("public", "catalog-fallback", "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
    stores?: Record<string, { file?: string; count?: number }>;
  };
  const descriptor = manifest.stores?.generic;
  if (!descriptor?.file || !descriptor.count) throw new Error("Generic fallback shard is missing");
  const shardPath = resolve(dirname(manifestPath), descriptor.file);
  const raw = await readFile(shardPath, "utf8");
  const hash = createHash("sha256").update(raw).digest("hex").slice(0, 12);
  if (!descriptor.file.includes(`.${hash}.json`)) throw new Error("Generic shard hash mismatch");
  const allProducts = JSON.parse(raw) as EventuriSnapshotProduct[];
  if (allProducts.length !== descriptor.count) throw new Error("Generic shard count mismatch");
  const products = allProducts.filter((product) => product.brand?.trim().toLowerCase() === "eventuri");
  if (!products.length) throw new Error("Generic shard has no Eventuri records");
  const normalizations = products.map(normalizeEventuriSnapshotProduct);
  let rawLeaves = 0;
  let provenanceEntries = 0;
  let coverageRecords = 0;
  const issueCounts = new Map<string, number>();
  for (const product of products) {
    const draft = buildEventuriSourceRecordDraft({ product, sourceRevision: hash });
    const coverage = buildShopCatalogSourceRecordCoverage({
      recordKey: draft.sourceRecord.recordKey,
      rawPayload: product,
      provenance: draft.provenance,
    });
    rawLeaves += coverage.leafCount;
    provenanceEntries += draft.provenance.length;
    if (coverage.coveragePercent === 100 && coverage.activationReady) coverageRecords += 1;
    for (const issue of draft.normalization.issues) issueCounts.set(issue, (issueCounts.get(issue) ?? 0) + 1);
  }
  const report = {
    version: 1,
    immutableInput: { manifest: manifestPath, shard: shardPath, shardCount: allProducts.length, eventuriCount: products.length, hash },
    verified: normalizations.filter((entry) => entry.verification === "VERIFIED").length,
    needsReview: normalizations.filter((entry) => entry.verification === "NEEDS_REVIEW").length,
    modes: {
      universal: normalizations.filter((entry) => entry.mode === "UNIVERSAL").length,
      vehicleSpecific: normalizations.filter((entry) => entry.mode === "VEHICLE_SPECIFIC").length,
      parentResolutionRequired: normalizations.filter((entry) => entry.issues.includes("parent_product_identity_missing")).length,
      needsReview: normalizations.filter((entry) => entry.mode === "NEEDS_REVIEW").length,
    },
    applications: normalizations.reduce((sum, entry) => sum + entry.applications.length, 0),
    exactEngineApplications: normalizations.reduce(
      (sum, entry) => sum + entry.applications.filter((application) => application.engineCode).length,
      0
    ),
    engineNotRelevantProducts: normalizations.filter((entry) => !entry.engineRelevant).length,
    losslessCoverage: { records: coverageRecords, rawLeaves, provenanceEntries },
    issues: Object.fromEntries([...issueCounts].sort(([left], [right]) => left.localeCompare(right))),
    fingerprint: createHash("sha256")
      .update(normalizations.map((entry) => `${entry.recordKey}:${entry.mode}:${JSON.stringify(entry.applications)}:${entry.verification}`).sort().join("\n"))
      .digest("hex"),
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
