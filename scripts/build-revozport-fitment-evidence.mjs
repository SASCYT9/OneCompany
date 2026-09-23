import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";

function argument(name, fallback) {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) ?? fallback;
}

const previewPath = resolve(argument("preview", ".tmp/revozport-catalog-preview.json"));
const manifestPath = resolve(argument("manifest", "public/catalog-fallback/manifest.json"));
const outputPath = resolve(argument("output", "data/revozport-fitment-evidence.jsonl"));
const outputRelative = relative(resolve("data"), outputPath);
if (!outputRelative || outputRelative.startsWith("..") || isAbsolute(outputRelative)) {
  throw new Error("--output must be inside data/");
}

const [previewText, manifestText] = await Promise.all([
  readFile(previewPath, "utf8"),
  readFile(manifestPath, "utf8"),
]);
const preview = JSON.parse(previewText);
const manifest = JSON.parse(manifestText);
const genericStore = manifest.stores?.generic;
if (!genericStore?.file || !genericStore.count) throw new Error("Catalog generic shard is missing");
const shardPath = resolve(dirname(manifestPath), genericStore.file);
const shardText = await readFile(shardPath, "utf8");
const shardHash = createHash("sha256").update(shardText).digest("hex").slice(0, 12);
if (!genericStore.file.includes(`.${shardHash}.json`)) throw new Error("Catalog generic shard hash mismatch");
const shard = JSON.parse(shardText);
if (shard.length !== genericStore.count) throw new Error("Catalog generic shard count mismatch");

const previewBySku = new Map();
for (const product of preview.products ?? []) {
  const sku = String(product.sku ?? "").trim().toUpperCase();
  if (!sku) continue;
  if (previewBySku.has(sku)) throw new Error(`Duplicate Revozport preview SKU: ${sku}`);
  previewBySku.set(sku, product);
}

const published = shard.filter((product) => product.brand?.trim().toLowerCase() === "revozport");
const records = [];
for (const product of published) {
  const sku = String(product.sku ?? "").trim().toUpperCase();
  const source = previewBySku.get(sku);
  if (!source) throw new Error(`Published Revozport SKU is missing from fitment preview: ${sku}`);
  const fitmentMeta = source.metafields?.find(
    (field) => field.namespace === "onecompany" && field.key === "supplier_fitment"
  );
  const auditMeta = source.metafields?.find(
    (field) => field.namespace === "revozport_source" && field.key === "fitment_audit"
  );
  if (!fitmentMeta?.value || !auditMeta?.value) throw new Error(`Fitment evidence is incomplete for ${sku}`);
  const fitment = JSON.parse(fitmentMeta.value);
  const fitmentAudit = JSON.parse(auditMeta.value);
  if (fitment.version !== 2 || !fitment.source?.sourceRevision || !fitment.source?.payloadHash) {
    throw new Error(`Versioned V2 fitment provenance is incomplete for ${sku}`);
  }
  records.push({
    productId: product.id,
    sku,
    scope: product.scope === "moto" ? "moto" : "auto",
    sourceRecordKey: fitment.source.sourceRecordKey,
    sourceRevision: fitment.source.sourceRevision,
    payloadHash: fitment.source.payloadHash,
    fitment,
    fitmentAudit: fitmentAudit.map((row) => ({
      row: row.row,
      make: row.make,
      rawGenerationModel: row.rawGenerationModel,
      productName: row.productName,
      sourceYear: row.sourceYear,
      officialUrl: row.officialUrl,
      officialMatchStatus: row.officialMatchStatus,
      officialHandle: row.officialHandle,
      officialTitle: row.officialTitle,
      resolution: row.resolution,
    })),
  });
}

records.sort((left, right) => left.productId.localeCompare(right.productId));
const officialCatalogFetches = [...new Set(
  records.map((record) => record.fitment.source.sourceUpdatedAt).filter(Boolean)
)];
if (officialCatalogFetches.length > 1) throw new Error("Fitment rows span multiple official-catalog revisions");
const evidenceManifest = {
  recordType: "manifest",
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  catalogManifestVersion: manifest.version,
  catalogGeneratedAt: manifest.generatedAt,
  genericShard: genericStore.file,
  genericShardSha256: createHash("sha256").update(shardText).digest("hex"),
  fitmentPreviewSha256: createHash("sha256").update(previewText).digest("hex"),
  officialCatalogFetchedAt: officialCatalogFetches[0] ?? null,
  recordCount: records.length,
  summary: {
    catalogProducts: published.length,
    mappedProducts: records.length,
    productsWithoutClauses: records.filter((record) => record.fitment.policy.clauses.length === 0).length,
    clauses: records.reduce((sum, record) => sum + record.fitment.policy.clauses.length, 0),
    verifiedClauses: records.reduce(
      (sum, record) => sum + record.fitment.policy.clauses.filter((clause) => clause.verification === "VERIFIED").length,
      0
    ),
    reviewClauses: records.reduce(
      (sum, record) => sum + record.fitment.policy.clauses.filter((clause) => clause.verification === "NEEDS_REVIEW").length,
      0
    ),
    unresolvedRows: records.reduce(
      (sum, record) => sum + record.fitmentAudit.filter(
        (row) => !["official_sku_url_confirmed", "corrected_from_official_sku_and_page"].includes(row.resolution)
      ).length,
      0
    ),
  },
};
evidenceManifest.fingerprint = createHash("sha256")
  .update(records.map((record) => `${record.productId}|${record.sku}|${record.sourceRevision}|${record.payloadHash}`).join("\n"))
  .digest("hex");

await mkdir(dirname(outputPath), { recursive: true });
const contents = [JSON.stringify(evidenceManifest), ...records.map((record) => JSON.stringify(record))].join("\n");
await writeFile(outputPath, `${contents}\n`, "utf8");
console.log(JSON.stringify({ output: outputPath, ...evidenceManifest.summary, fingerprint: evidenceManifest.fingerprint }, null, 2));
