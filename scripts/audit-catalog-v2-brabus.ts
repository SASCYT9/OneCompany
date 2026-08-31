import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { buildBrabusSourceRecordDraft, normalizeBrabusSnapshotProduct, type BrabusSnapshotProduct } from "../src/lib/shopCatalogBrabusNormalization";
import { buildShopCatalogSourceRecordCoverage } from "../src/lib/shopCatalogSourceCoverage";

async function main() {
  const manifestPath = resolve("public", "catalog-fallback", "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as { stores?: Record<string, { file?: string; count?: number }> };
  const descriptor = manifest.stores?.brabus;
  if (!descriptor?.file || !descriptor.count) throw new Error("Brabus fallback shard is missing");
  const shardPath = resolve(dirname(manifestPath), descriptor.file);
  const raw = await readFile(shardPath, "utf8");
  const hash = createHash("sha256").update(raw).digest("hex").slice(0, 12);
  if (!descriptor.file.includes(`.${hash}.json`)) throw new Error("Brabus shard hash mismatch");
  const products = JSON.parse(raw) as BrabusSnapshotProduct[];
  if (products.length !== descriptor.count) throw new Error("Brabus shard count mismatch");
  const normalizations = products.map(normalizeBrabusSnapshotProduct);
  let rawLeaves = 0, provenanceEntries = 0, coverageRecords = 0;
  const issues = new Map<string, number>(), makes = new Map<string, number>();
  for (const product of products) {
    const draft = buildBrabusSourceRecordDraft({ product, sourceRevision: hash });
    const coverage = buildShopCatalogSourceRecordCoverage({ recordKey: draft.sourceRecord.recordKey, rawPayload: product, provenance: draft.provenance });
    rawLeaves += coverage.leafCount;
    provenanceEntries += draft.provenance.length;
    if (coverage.coveragePercent === 100 && coverage.activationReady) coverageRecords += 1;
    for (const issue of draft.normalization.issues) issues.set(issue, (issues.get(issue) ?? 0) + 1);
    for (const make of new Set(draft.normalization.applications.map((application) => application.make))) makes.set(make, (makes.get(make) ?? 0) + 1);
  }
  const report = {
    version: 1,
    immutableInput: { manifest: manifestPath, shard: shardPath, count: products.length, hash },
    verified: normalizations.filter((entry) => entry.verification === "VERIFIED").length,
    needsReview: normalizations.filter((entry) => entry.verification === "NEEDS_REVIEW").length,
    applications: normalizations.reduce((sum, entry) => sum + entry.applications.length, 0),
    exactChassisApplications: normalizations.reduce((sum, entry) => sum + entry.applications.filter((application) => application.generation).length, 0),
    engineRelevantProducts: normalizations.filter((entry) => entry.engineRelevant).length,
    losslessCoverage: { records: coverageRecords, rawLeaves, provenanceEntries },
    makes: Object.fromEntries([...makes].sort(([left], [right]) => left.localeCompare(right))),
    issues: Object.fromEntries([...issues].sort(([left], [right]) => left.localeCompare(right))),
    fingerprint: createHash("sha256").update(normalizations.map((entry) => `${entry.recordKey}:${JSON.stringify(entry.applications)}:${entry.verification}`).sort().join("\n")).digest("hex"),
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
