import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { buildAkrapovicSourceRecordDraft, normalizeAkrapovicSnapshotProduct, type AkrapovicSnapshotProduct } from "../src/lib/shopCatalogAkrapovicNormalization";
import { buildShopCatalogSourceRecordCoverage } from "../src/lib/shopCatalogSourceCoverage";

async function main() {
  const manifestPath = resolve("public", "catalog-fallback", "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as { stores?: Record<string, { file?: string; count?: number }> };
  const descriptor = manifest.stores?.akrapovic; if (!descriptor?.file || !descriptor.count) throw new Error("Akrapovic fallback shard is missing");
  const raw = await readFile(resolve(dirname(manifestPath), descriptor.file), "utf8"), hash = createHash("sha256").update(raw).digest("hex").slice(0, 12);
  if (!descriptor.file.includes(`.${hash}.json`)) throw new Error("Akrapovic shard hash mismatch");
  const products = JSON.parse(raw) as AkrapovicSnapshotProduct[]; if (products.length !== descriptor.count) throw new Error("Akrapovic shard count mismatch");
  const normalized = products.map(normalizeAkrapovicSnapshotProduct); let rawLeaves = 0, provenanceEntries = 0, coverageRecords = 0;
  const issues = new Map<string, number>(), modes = new Map<string, number>(), scopes = new Map<string, number>();
  for (const product of products) { const draft = buildAkrapovicSourceRecordDraft({ product, sourceRevision: hash });
    const coverage = buildShopCatalogSourceRecordCoverage({ recordKey: draft.sourceRecord.recordKey, rawPayload: product, provenance: draft.provenance });
    rawLeaves += coverage.leafCount; provenanceEntries += draft.provenance.length; if (coverage.coveragePercent === 100 && coverage.activationReady) coverageRecords += 1;
    modes.set(draft.normalization.mode, (modes.get(draft.normalization.mode) ?? 0) + 1); scopes.set(draft.normalization.scope, (scopes.get(draft.normalization.scope) ?? 0) + 1);
    for (const issue of draft.normalization.issues) issues.set(issue, (issues.get(issue) ?? 0) + 1); }
  const report = { version: 1, immutableInput: { manifest: manifestPath, shard: descriptor.file, count: products.length, hash },
    verified: normalized.filter((entry) => entry.verification === "VERIFIED").length, needsReview: normalized.filter((entry) => entry.verification === "NEEDS_REVIEW").length,
    applications: normalized.reduce((sum, entry) => sum + entry.applications.length, 0), exactChassisApplications: normalized.reduce((sum, entry) => sum + entry.applications.filter((app) => app.generation).length, 0),
    engineRelevantProducts: normalized.filter((entry) => entry.engineRelevant).length, modes: Object.fromEntries([...modes].sort()), scopes: Object.fromEntries([...scopes].sort()),
    losslessCoverage: { records: coverageRecords, rawLeaves, provenanceEntries }, issues: Object.fromEntries([...issues].sort()),
    fingerprint: createHash("sha256").update(normalized.map((entry) => `${entry.recordKey}:${entry.scope}:${JSON.stringify(entry.applications)}:${entry.mode}:${entry.verification}`).sort().join("\n")).digest("hex") };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
