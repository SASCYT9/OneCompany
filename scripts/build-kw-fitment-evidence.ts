import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";

import {
  buildKwVehicleMakeEvidence,
  normalizeKwShopifyProduct,
  type KwProductNormalization,
} from "../src/lib/shopCatalogKwNormalization";
import {
  buildKwPolicyEvidence,
  KW_POLICY_EVIDENCE_MAPPER_VERSION,
} from "../src/lib/shopCatalogKwPolicyEvidence";
import {
  parseShopifyProductJsonl,
  selectKwShopifyProducts,
  type ShopifySnapshotProduct,
} from "../src/lib/shopifyCatalogSnapshot";

type GenericProduct = {
  id: string;
  sku?: string | null;
  brand?: string | null;
};

function argument(name: string, fallback?: string) {
  const prefix = `--${name}=`;
  const value = process.argv
    .find((entry) => entry.startsWith(prefix))
    ?.slice(prefix.length)
    .trim();
  return value || fallback;
}

function digest(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

function stableLine(value: unknown) {
  return JSON.stringify(value);
}

async function main() {
  const snapshotPath = resolve(
      argument("snapshot", "backups/shopify/kw-suspensions/2026-09-02/products.jsonl")!
    ),
    manifestPath = resolve(argument("manifest", "public/catalog-fallback/manifest.json")!),
    outputPath = resolve(argument("output", "data/kw-fitment-evidence.jsonl")!),
    outputRelative = relative(resolve("data"), outputPath);
  if (!outputRelative || outputRelative.startsWith("..") || isAbsolute(outputRelative)) {
    throw new Error("--output must be inside data/");
  }

  const [snapshotRaw, manifestRaw] = await Promise.all([
    readFile(snapshotPath),
    readFile(manifestPath, "utf8"),
  ]);
  const sourceSnapshotSha256 = digest(snapshotRaw);
  const manifest = JSON.parse(manifestRaw) as {
    stores?: Record<string, { file?: string; count?: number }>;
  };
  const genericDescriptor = manifest.stores?.generic;
  if (!genericDescriptor?.file || !genericDescriptor.count) {
    throw new Error("Generic fallback shard is missing");
  }
  const genericRaw = await readFile(resolve(dirname(manifestPath), genericDescriptor.file));
  const genericShardSha256 = digest(genericRaw);
  if (!genericDescriptor.file.includes(`.${genericShardSha256.slice(0, 12)}.json`)) {
    throw new Error("Generic fallback shard hash mismatch");
  }
  const genericProducts = JSON.parse(genericRaw.toString("utf8")) as GenericProduct[];
  if (genericProducts.length !== genericDescriptor.count) {
    throw new Error("Generic fallback shard count mismatch");
  }

  const catalogProducts = genericProducts.filter(
    (product) => product.brand?.trim().toLowerCase() === "kw suspensions"
  );
  const genericBySku = new Map<string, GenericProduct>();
  for (const product of catalogProducts) {
    const sku = product.sku?.trim().toUpperCase();
    if (!sku || genericBySku.has(sku)) {
      throw new Error(`Missing or duplicate catalog KW SKU: ${sku ?? product.id}`);
    }
    genericBySku.set(sku, product);
  }

  const snapshotProducts = selectKwShopifyProducts(
    parseShopifyProductJsonl(snapshotRaw.toString("utf8"))
  );
  const compactProducts = snapshotProducts.map((product) => {
    const variant = product.variants[0];
    if (!variant?.id || typeof variant.sku !== "string" || !variant.sku.trim()) {
      throw new Error(`KW Shopify product has no first/default variant SKU: ${product.id}`);
    }
    return {
      id: product.id,
      vendor: product.vendor,
      title: product.title,
      productType: product.productType,
      tags: product.tags ?? [],
      variants: [{ id: variant.id, sku: variant.sku }],
      media: [],
      metafields: product.metafields
        .filter(
          (field) =>
            field.namespace === "custom" && (field.key === "brand" || field.key === "model")
        )
        .map((field) => ({
          id: field.id,
          namespace: field.namespace,
          key: field.key,
          value: field.value,
        })),
    } satisfies ShopifySnapshotProduct;
  });
  const makeEvidence = buildKwVehicleMakeEvidence(compactProducts);
  const snapshotBySku = new Map<string, ShopifySnapshotProduct>();
  for (const product of compactProducts) {
    const defaultVariant = product.variants[0];
    const sku =
      typeof defaultVariant?.sku === "string" ? defaultVariant.sku.trim().toUpperCase() : "";
    if (!sku || snapshotBySku.has(sku)) {
      throw new Error(`Missing or duplicate Shopify KW default SKU: ${sku || product.id}`);
    }
    snapshotBySku.set(sku, product);
  }
  if (snapshotBySku.size !== genericBySku.size) {
    throw new Error(
      `KW product count mismatch: Shopify=${snapshotBySku.size}, catalog=${genericBySku.size}`
    );
  }

  const records = [...genericBySku.entries()]
    .sort(([left], [right]) => left.localeCompare(right, "en"))
    .map(([sku, catalogProduct]) => {
      const shopifyProduct = snapshotBySku.get(sku);
      if (!shopifyProduct) throw new Error(`Missing Shopify fitment source for KW SKU ${sku}`);
      const normalization = normalizeKwShopifyProduct(shopifyProduct, makeEvidence);
      const evidence = buildKwPolicyEvidence({
        product: shopifyProduct,
        normalization,
        productId: catalogProduct.id,
      });
      return {
        recordType: "product" as const,
        productId: catalogProduct.id,
        sku,
        shopifyProductId: shopifyProduct.id,
        evidenceSourceRevision: evidence.sourceRecord.sourceRevision,
        sourceRevision: `kw-fitment-evidence-v1:${genericShardSha256}:${sourceSnapshotSha256}:${evidence.sourceRecord.sourceRevision}`,
        payloadHash: evidence.sourceRecord.payloadHash,
        evidenceHash: evidence.evidenceHash,
        evidence: evidence.sourceRecord.rawPayload,
        compatibilityPolicy: evidence.policy,
      };
    });
  const recordKeys = records.map(
    (record) =>
      `${record.productId}|${record.sku}|${record.shopifyProductId}|${record.sourceRevision}|${record.payloadHash}`
  );
  const fingerprint = digest(recordKeys.join("\n"));
  const policyClauses = records.flatMap((record) => record.compatibilityPolicy.clauses);
  const manifestRow = {
    recordType: "manifest",
    schemaVersion: 1,
    mapperVersion: KW_POLICY_EVIDENCE_MAPPER_VERSION,
    sourceSnapshotSha256,
    genericShardSha256,
    recordCount: records.length,
    fingerprint,
    summary: {
      productsWithVerifiedApplications: records.filter((record) =>
        record.compatibilityPolicy.clauses.some((clause) => clause.verification === "VERIFIED")
      ).length,
      productsWithInferredApplications: records.filter((record) =>
        record.compatibilityPolicy.clauses.some((clause) => clause.verification === "INFERRED")
      ).length,
      productsWithReviewApplications: records.filter((record) =>
        record.compatibilityPolicy.clauses.some((clause) => clause.verification === "NEEDS_REVIEW")
      ).length,
      totalClauses: policyClauses.length,
      verifiedClauses: policyClauses.filter((clause) => clause.verification === "VERIFIED").length,
      inferredClauses: policyClauses.filter((clause) => clause.verification === "INFERRED").length,
      reviewClauses: policyClauses.filter((clause) => clause.verification === "NEEDS_REVIEW")
        .length,
    },
  };

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(
    outputPath,
    [stableLine(manifestRow), ...records.map(stableLine)].join("\n") + "\n",
    "utf8"
  );
  process.stdout.write(`${JSON.stringify({ outputPath, ...manifestRow }, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
