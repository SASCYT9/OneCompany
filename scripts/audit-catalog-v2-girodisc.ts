import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { buildGirodiscSourceRecordDraft, normalizeGirodiscSnapshotProduct, type GirodiscSnapshotProduct } from "../src/lib/shopCatalogGirodiscNormalization";
import { buildShopCatalogSourceRecordCoverage } from "../src/lib/shopCatalogSourceCoverage";
async function main() { const manifestPath = resolve("public", "catalog-fallback", "manifest.json"), manifest = JSON.parse(await readFile(manifestPath, "utf8")) as { stores?: Record<string, { file?: string; count?: number }> };
  const descriptor = manifest.stores?.girodisc; if (!descriptor?.file || !descriptor.count) throw new Error("GiroDisc fallback shard is missing"); const raw = await readFile(resolve(dirname(manifestPath), descriptor.file), "utf8"), hash = createHash("sha256").update(raw).digest("hex").slice(0, 12);
  if (!descriptor.file.includes(`.${hash}.json`)) throw new Error("GiroDisc shard hash mismatch"); const products = JSON.parse(raw) as GirodiscSnapshotProduct[]; if (products.length !== descriptor.count) throw new Error("GiroDisc shard count mismatch");
  const normalized = products.map(normalizeGirodiscSnapshotProduct), issues = new Map<string, number>(); let rawLeaves = 0, provenanceEntries = 0, coverageRecords = 0;
  for (const product of products) { const draft = buildGirodiscSourceRecordDraft({ product, sourceRevision: hash }), coverage = buildShopCatalogSourceRecordCoverage({ recordKey: draft.sourceRecord.recordKey, rawPayload: product, provenance: draft.provenance }); rawLeaves += coverage.leafCount; provenanceEntries += draft.provenance.length;
    if (coverage.coveragePercent === 100 && coverage.activationReady) coverageRecords += 1; for (const issue of draft.normalization.issues) issues.set(issue, (issues.get(issue) ?? 0) + 1); }
  const report = { version: 1, immutableInput: { manifest: manifestPath, shard: descriptor.file, count: products.length, hash }, verified: normalized.filter((entry) => entry.verification === "VERIFIED").length, needsReview: normalized.filter((entry) => entry.verification === "NEEDS_REVIEW").length,
    applications: normalized.reduce((sum, entry) => sum + entry.applications.length, 0), exactChassisApplications: normalized.reduce((sum, entry) => sum + entry.applications.filter((app) => app.generation).length, 0),
    losslessCoverage: { records: coverageRecords, rawLeaves, provenanceEntries }, issues: Object.fromEntries([...issues].sort()), fingerprint: createHash("sha256").update(normalized.map((entry) => `${entry.recordKey}:${JSON.stringify(entry.applications)}:${entry.verification}`).sort().join("\n")).digest("hex") };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`); }
main().catch((error) => { console.error(error); process.exitCode = 1; });
