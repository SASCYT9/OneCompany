import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import {
  buildSupplementalCatalogSourceRecordDraft,
  SHOP_CATALOG_SUPPLEMENTAL_SOURCES,
  type ShopCatalogSupplementalSource,
  type SupplementalSnapshotProduct,
} from "../src/lib/shopCatalogSupplementalNormalization";

export async function loadSupplementalCatalogDrafts(source: ShopCatalogSupplementalSource) {
  const manifestPath = resolve("public", "catalog-fallback", "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
    stores?: Record<string, { file?: string; count?: number }>;
  };
  const descriptor = manifest.stores?.generic;
  if (!descriptor?.file || !descriptor.count) throw new Error("Generic fallback shard is missing");
  const shardPath = resolve(dirname(manifestPath), descriptor.file);
  const raw = await readFile(shardPath, "utf8");
  const revision = createHash("sha256").update(raw).digest("hex").slice(0, 12);
  if (!descriptor.file.includes(`.${revision}.json`))
    throw new Error("Generic shard hash mismatch");
  const products = JSON.parse(raw) as SupplementalSnapshotProduct[];
  if (products.length !== descriptor.count) throw new Error("Generic shard count mismatch");
  const brand = SHOP_CATALOG_SUPPLEMENTAL_SOURCES[source].brand.toLowerCase();
  if (source === "revozport") {
    const evidencePath = resolve("data", "revozport-fitment-evidence.json");
    const evidence = JSON.parse(await readFile(evidencePath, "utf8")) as {
      schemaVersion: number;
      genericShardSha256: string;
      fingerprint: string;
      officialCatalogFetchedAt?: string | null;
      records: Array<{
        productId: string;
        sku: string;
        sourceRecordKey: string;
        sourceRevision: string;
        payloadHash: string;
        fitment: unknown;
        fitmentAudit: unknown;
      }>;
    };
    if (evidence.schemaVersion !== 1) throw new Error("Unsupported Revozport fitment evidence schema");
    const shardSha256 = createHash("sha256").update(raw).digest("hex");
    if (evidence.genericShardSha256 !== shardSha256) {
      throw new Error("Revozport fitment evidence targets a different generic catalog shard");
    }
    const evidenceFingerprint = createHash("sha256")
      .update(evidence.records.map((record) => `${record.productId}|${record.sku}|${record.sourceRevision}|${record.payloadHash}`).join("\n"))
      .digest("hex");
    if (evidence.fingerprint !== evidenceFingerprint) throw new Error("Revozport fitment evidence fingerprint mismatch");
    const bySku = new Map<string, (typeof evidence.records)[number]>();
    for (const record of evidence.records) {
      const key = record.sku.trim().toUpperCase();
      if (!key || bySku.has(key)) throw new Error(`Duplicate Revozport fitment evidence SKU: ${key}`);
      bySku.set(key, record);
    }
    const owned = products.filter((product) => product.brand?.trim().toLowerCase() === brand);
    if (owned.length !== bySku.size) {
      throw new Error(`Revozport evidence count ${bySku.size} does not match generic catalog ${owned.length}`);
    }
    const drafts = owned.map((product) => {
      const evidenceRecord = bySku.get(String(product.sku ?? "").trim().toUpperCase());
      if (!evidenceRecord) throw new Error(`Missing Revozport fitment evidence for ${product.sku ?? product.id}`);
      if (evidenceRecord.productId !== product.id) {
        throw new Error(`Revozport SKU ${product.sku} maps to a different product ID`);
      }
      if (evidenceRecord.fitment.source?.sourceRevision !== evidenceRecord.sourceRevision ||
        evidenceRecord.fitment.source?.payloadHash !== evidenceRecord.payloadHash) {
        throw new Error(`Revozport source revision or payload hash mismatch for ${product.sku}`);
      }
      return buildSupplementalCatalogSourceRecordDraft({
        product: {
          ...product,
          fitment: evidenceRecord.fitment,
          fitmentAudit: evidenceRecord.fitmentAudit,
        },
        sourceRevision: evidenceRecord.sourceRevision,
        expectedSource: source,
      });
    });
    return drafts.sort((left, right) => left.sourceRecord.recordKey.localeCompare(right.sourceRecord.recordKey));
  }
  return products
    .filter((product) => product.brand?.trim().toLowerCase() === brand)
    .map((product) =>
      buildSupplementalCatalogSourceRecordDraft({
        product,
        sourceRevision: revision,
        expectedSource: source,
      })
    )
    .sort((left, right) => left.sourceRecord.recordKey.localeCompare(right.sourceRecord.recordKey));
}

export function supplementalSourceArgument(value: string | undefined) {
  const source = value?.trim().toLowerCase() as ShopCatalogSupplementalSource | undefined;
  if (!source || !Object.hasOwn(SHOP_CATALOG_SUPPLEMENTAL_SOURCES, source)) {
    throw new TypeError(
      `--source must be one of ${Object.keys(SHOP_CATALOG_SUPPLEMENTAL_SOURCES).join(", ")}`
    );
  }
  return source;
}
