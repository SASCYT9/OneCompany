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
