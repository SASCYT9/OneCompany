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
  if (source === "kw-suspensions") {
    const evidencePath = resolve("data", "kw-fitment-evidence.jsonl");
    const evidenceLines = (await readFile(evidencePath, "utf8")).trim().split(/\r?\n/u);
    if (!evidenceLines.length || !evidenceLines[0]) throw new Error("KW fitment evidence is empty");
    const evidenceManifest = JSON.parse(evidenceLines[0]) as {
      recordType: string;
      schemaVersion: number;
      mapperVersion: string;
      sourceSnapshotSha256: string;
      genericShardSha256: string;
      recordCount: number;
      fingerprint: string;
    };
    if (evidenceManifest.recordType !== "manifest")
      throw new Error("KW evidence manifest is missing");
    if (
      evidenceManifest.schemaVersion !== 1 ||
      evidenceManifest.mapperVersion !== "kw-policy-evidence-v1"
    ) {
      throw new Error("Unsupported KW fitment evidence schema or mapper");
    }
    if (!/^[a-f0-9]{64}$/iu.test(evidenceManifest.sourceSnapshotSha256)) {
      throw new Error("KW evidence source snapshot hash is invalid");
    }
    const evidenceRecords = evidenceLines.slice(1).map((line) => JSON.parse(line)) as Array<{
      recordType: string;
      productId: string;
      sku: string;
      shopifyProductId: string;
      evidenceSourceRevision: string;
      sourceRevision: string;
      payloadHash: string;
      evidenceHash: string;
      evidence: unknown;
      compatibilityPolicy: unknown;
    }>;
    if (evidenceRecords.length !== evidenceManifest.recordCount) {
      throw new Error("KW evidence row count mismatch");
    }
    const shardSha256 = createHash("sha256").update(raw).digest("hex");
    if (evidenceManifest.genericShardSha256 !== shardSha256) {
      throw new Error("KW fitment evidence targets a different generic catalog shard");
    }
    const evidenceFingerprint = createHash("sha256")
      .update(
        evidenceRecords
          .map(
            (record) =>
              `${record.productId}|${record.sku}|${record.shopifyProductId}|${record.sourceRevision}|${record.payloadHash}`
          )
          .join("\n")
      )
      .digest("hex");
    if (evidenceManifest.fingerprint !== evidenceFingerprint) {
      throw new Error("KW fitment evidence manifest fingerprint mismatch");
    }
    const bySku = new Map<string, (typeof evidenceRecords)[number]>();
    const productIds = new Set<string>();
    for (const record of evidenceRecords) {
      const key = record.sku.trim().toUpperCase();
      if (
        record.recordType !== "product" ||
        !key ||
        bySku.has(key) ||
        productIds.has(record.productId)
      ) {
        throw new Error(
          `Duplicate or invalid KW fitment evidence identity: ${key || record.productId}`
        );
      }
      if (record.payloadHash !== record.evidenceHash) {
        throw new Error(`KW fitment evidence hash mismatch for ${record.sku}`);
      }
      const expectedRevision = `kw-fitment-evidence-v1:${evidenceManifest.genericShardSha256}:${evidenceManifest.sourceSnapshotSha256}:${record.evidenceSourceRevision}`;
      if (record.sourceRevision !== expectedRevision) {
        throw new Error(`KW source revision does not match its pinned inputs for ${record.sku}`);
      }
      bySku.set(key, record);
      productIds.add(record.productId);
    }
    const owned = products.filter((product) => product.brand?.trim().toLowerCase() === brand);
    if (owned.length !== bySku.size) {
      throw new Error(
        `KW evidence count ${bySku.size} does not match generic catalog ${owned.length}`
      );
    }
    return owned
      .map((product) => {
        const sku = String(product.sku ?? "")
          .trim()
          .toUpperCase();
        const evidenceRecord = bySku.get(sku);
        if (!evidenceRecord)
          throw new Error(`Missing KW fitment evidence for ${product.sku ?? product.id}`);
        if (evidenceRecord.productId !== product.id) {
          throw new Error(`KW SKU ${product.sku} maps to a different catalog product ID`);
        }
        return buildSupplementalCatalogSourceRecordDraft({
          product: {
            ...product,
            fitment: {
              schemaVersion: 1,
              productId: evidenceRecord.productId,
              sku: evidenceRecord.sku,
              shopifyProductId: evidenceRecord.shopifyProductId,
              genericShardSha256: evidenceManifest.genericShardSha256,
              sourceSnapshotSha256: evidenceManifest.sourceSnapshotSha256,
              evidenceSourceRevision: evidenceRecord.evidenceSourceRevision,
              sourceRevision: evidenceRecord.sourceRevision,
              payloadHash: evidenceRecord.payloadHash,
              evidence: evidenceRecord.evidence,
              policy: evidenceRecord.compatibilityPolicy,
            },
          },
          sourceRevision: evidenceRecord.sourceRevision,
          expectedSource: source,
        });
      })
      .sort((left, right) =>
        left.sourceRecord.recordKey.localeCompare(right.sourceRecord.recordKey)
      );
  }
  if (source === "revozport") {
    const evidencePath = resolve("data", "revozport-fitment-evidence.jsonl");
    const evidenceLines = (await readFile(evidencePath, "utf8")).trim().split(/\r?\n/u);
    if (!evidenceLines.length || !evidenceLines[0])
      throw new Error("Revozport fitment evidence is empty");
    const evidence = JSON.parse(evidenceLines[0]) as {
      recordType: string;
      schemaVersion: number;
      genericShardSha256: string;
      fingerprint: string;
      recordCount: number;
      officialCatalogFetchedAt?: string | null;
    };
    if (evidence.recordType !== "manifest")
      throw new Error("Revozport evidence manifest is missing");
    const evidenceRecords = evidenceLines.slice(1).map((line) => JSON.parse(line)) as Array<{
      productId: string;
      sku: string;
      sourceRecordKey: string;
      sourceRevision: string;
      payloadHash: string;
      fitment: unknown;
      fitmentAudit: unknown;
    }>;
    if (evidence.schemaVersion !== 1)
      throw new Error("Unsupported Revozport fitment evidence schema");
    if (evidenceRecords.length !== evidence.recordCount)
      throw new Error("Revozport evidence row count mismatch");
    const shardSha256 = createHash("sha256").update(raw).digest("hex");
    if (evidence.genericShardSha256 !== shardSha256) {
      throw new Error("Revozport fitment evidence targets a different generic catalog shard");
    }
    const evidenceFingerprint = createHash("sha256")
      .update(
        evidenceRecords
          .map(
            (record) =>
              `${record.productId}|${record.sku}|${record.sourceRevision}|${record.payloadHash}`
          )
          .join("\n")
      )
      .digest("hex");
    if (evidence.fingerprint !== evidenceFingerprint)
      throw new Error("Revozport fitment evidence fingerprint mismatch");
    const bySku = new Map<string, (typeof evidenceRecords)[number]>();
    for (const record of evidenceRecords) {
      const key = record.sku.trim().toUpperCase();
      if (!key || bySku.has(key))
        throw new Error(`Duplicate Revozport fitment evidence SKU: ${key}`);
      bySku.set(key, record);
    }
    const owned = products.filter((product) => product.brand?.trim().toLowerCase() === brand);
    if (owned.length !== bySku.size) {
      throw new Error(
        `Revozport evidence count ${bySku.size} does not match generic catalog ${owned.length}`
      );
    }
    const drafts = owned.map((product) => {
      const evidenceRecord = bySku.get(
        String(product.sku ?? "")
          .trim()
          .toUpperCase()
      );
      if (!evidenceRecord)
        throw new Error(`Missing Revozport fitment evidence for ${product.sku ?? product.id}`);
      if (evidenceRecord.productId !== product.id) {
        throw new Error(`Revozport SKU ${product.sku} maps to a different product ID`);
      }
      if (
        evidenceRecord.fitment.source?.sourceRevision !== evidenceRecord.sourceRevision ||
        evidenceRecord.fitment.source?.payloadHash !== evidenceRecord.payloadHash
      ) {
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
    return drafts.sort((left, right) =>
      left.sourceRecord.recordKey.localeCompare(right.sourceRecord.recordKey)
    );
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
