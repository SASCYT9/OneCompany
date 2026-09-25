// Create a local-only Burger filter index from the current catalog fallback.
// This lets the deferred client filter search the full Burger shard in dev.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const fallbackDir = path.join(root, "public", "catalog-fallback");
const fallbackManifest = JSON.parse(fs.readFileSync(path.join(fallbackDir, "manifest.json"), "utf8"));
const burger = fallbackManifest.stores?.burger;
if (!burger?.file || !Number.isSafeInteger(burger.count)) {
  throw new Error("Burger fallback descriptor is missing");
}
const products = JSON.parse(fs.readFileSync(path.join(fallbackDir, burger.file), "utf8"));
if (products.length !== burger.count) throw new Error("Burger fallback count does not match manifest");

const empty = { ua: "", en: "" };
const emptyMoney = { eur: 0, usd: 0, uah: 0 };
const hiddenProducts = products.filter((product) =>
  (product.tags ?? []).some((tag) => String(tag).trim().toLowerCase() === "catalog:hidden")
);
const visibleProducts = products.filter((product) => !hiddenProducts.includes(product));
const projected = visibleProducts.map((product) => ({
  slug: product.slug,
  sku: product.sku,
  scope: product.scope,
  brand: product.brand,
  vendor: product.vendor,
  productType: product.productType,
  tags: product.tags ?? [],
  title: product.title ?? empty,
  category: product.category ?? empty,
  shortDescription: empty,
  longDescription: empty,
  leadTime: empty,
  stock: product.stock,
  collection: product.collection ?? empty,
  collections: product.collections,
  price: product.price ?? emptyMoney,
  europePrice: product.europePrice,
  compareAt: product.compareAt,
  image: product.image,
  gallery: product.image ? [product.image] : undefined,
  variants: (product.variants ?? []).map((variant) => ({
    id: variant.id,
    title: variant.title,
    sku: variant.sku,
    position: variant.position,
    optionValues: variant.optionValues,
    isDefault: variant.isDefault,
  })),
  highlights: [],
}));
const serialized = JSON.stringify(projected);
const hash = crypto.createHash("sha256").update(serialized).digest("hex").slice(0, 12);
const outputDir = path.join(root, "public", "catalog-index");
fs.mkdirSync(outputDir, { recursive: true });
const manifestPath = path.join(outputDir, "manifest.json");
const prior = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, "utf8")) : {};
const file = `burger.${hash}.json`;
fs.writeFileSync(path.join(outputDir, file), serialized, "utf8");
fs.writeFileSync(manifestPath, JSON.stringify({
  ...prior,
  generatedAt: new Date().toISOString(),
  indexes: { ...(prior.indexes ?? {}), burger: { file, count: projected.length } },
}, null, 2) + "\n");
console.log(JSON.stringify({
  sourceProducts: products.length,
  hiddenInternalProducts: hiddenProducts.length,
  searchableProducts: projected.length,
  file,
  manifest: manifestPath,
}, null, 2));
