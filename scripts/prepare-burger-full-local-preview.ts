/**
 * Replace the ignored local Burger fallback with the full, variant-complete
 * review candidate. Does not touch PostgreSQL or the production catalog.
 * Run: npx tsx scripts/prepare-burger-full-local-preview.ts YYYY-MM-DD --preview
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DEFAULT_CURRENCY_RATES } from "../src/lib/shopAdminSettings";
import { expandShopPrices } from "../src/lib/shopPriceConversion";

if (!process.argv.includes("--preview")) {
  throw new Error("Pass --preview to write the ignored local Burger fixture");
}
const date = process.argv[2];
if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) throw new Error("Pass YYYY-MM-DD");
const root = process.cwd();
const tmpDir = path.join(root, "tmp");
const fallbackDir = path.join(root, "public", "catalog-fallback");
const manifestPath = path.join(fallbackDir, "manifest.json");
const manifestBackupPath = path.join(tmpDir, "burger-local-preview-manifest-original.json");
const originalShardPath = path.join(tmpDir, "burger-local-preview-original.json");
const candidatePath = path.join(tmpDir, `burger-import-candidate-${date}.json`);
if (!fs.existsSync(candidatePath)) throw new Error(`Missing candidate file: ${candidatePath}`);
if (!fs.existsSync(originalShardPath)) throw new Error("Missing original Burger shard backup");
if (!fs.existsSync(manifestBackupPath)) fs.copyFileSync(manifestPath, manifestBackupPath);

const candidate = JSON.parse(fs.readFileSync(candidatePath, "utf8")) as {
  summary: Record<string, unknown>;
  products: Array<Record<string, any>>;
};
const original = JSON.parse(fs.readFileSync(originalShardPath, "utf8")) as Array<Record<string, any>>;
const originalBySlug = new Map(original.map((product) => [product.slug, product]));
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
  count: number;
  activeDatabaseCount: number;
  generatedAt: string;
  stores: Record<string, { file: string; count: number }>;
  slugToStore: Record<string, string>;
};
const currentBurger = manifest.stores.burger;
if (!currentBurger?.file) throw new Error("Burger shard missing from fallback manifest");

function money(usd: number) {
  return expandShopPrices({ usd, eur: 0, uah: 0 }, DEFAULT_CURRENCY_RATES);
}
const emptyLocalized = { ua: "", en: "" };
const emptyMoney = { eur: 0, usd: 0, uah: 0 };
const products = candidate.products.map((item) => {
  const slug = `burger-${item.slug}`;
  const previous = originalBySlug.get(slug);
  const defaultVariant = item.variants.find((variant: any) => variant.isDefault) ?? item.variants[0];
  const variants = item.variants.map((variant: any) => ({
    id: `burger-preview-${variant.sourceVariantId}`,
    title: variant.title,
    sku: variant.sku,
    optionValues: variant.optionValues,
    position: variant.position,
    isDefault: variant.isDefault,
    inventoryQty: variant.available ? 999 : 0,
    price: money(variant.priceUsd ?? 0),
    weightKg: variant.packageWeightKg,
    requiresShipping: variant.requiresShipping ?? item.requiresShipping ?? true,
    length: variant.packageDimensionsCm.length,
    width: variant.packageDimensionsCm.width,
    height: variant.packageDimensionsCm.height,
    image: variant.image,
  }));
  const image = defaultVariant?.image ?? item.image ?? previous?.image ?? "";
  const title = item.title ?? previous?.title ?? emptyLocalized;
  const shortDescription = item.seo
    ? { ua: item.seo.descriptionUa, en: item.seo.descriptionEn }
    : previous?.shortDescription ?? emptyLocalized;
  return {
    ...(previous ?? {}),
    id: previous?.id ?? `burger-preview-product-${item.sourceProductId}`,
    slug,
    sku: defaultVariant?.sku ?? `BURGER-${item.sourceProductId}`,
    scope: "auto",
    brand: item.brand,
    vendor: item.vendor,
    productType: item.productType,
    tags: item.tags,
    title,
    category: previous?.category ?? { ua: item.productType, en: item.productType },
    shortDescription,
    longDescription: { ua: item.descriptionUa ?? "", en: item.descriptionEn ?? "" },
    leadTime: previous?.leadTime ?? emptyLocalized,
    stock: item.available ? "inStock" : "preOrder",
    collection: previous?.collection ?? emptyLocalized,
    collections: previous?.collections ?? [],
    price: money(defaultVariant?.priceUsd ?? 0),
    europePrice: previous?.europePrice,
    b2bPrice: previous?.b2bPrice,
    compareAt: null,
    b2bCompareAt: null,
    weightKg: defaultVariant?.packageWeightKg ?? null,
    length: defaultVariant?.packageDimensionsCm?.length ?? null,
    width: defaultVariant?.packageDimensionsCm?.width ?? null,
    height: defaultVariant?.packageDimensionsCm?.height ?? null,
    image,
    gallery: item.gallery?.length ? item.gallery : [image].filter(Boolean),
    options: item.options,
    variants,
    requiresShipping: item.requiresShipping ?? true,
    manualQuoteRequired: item.manualQuoteRequired ?? false,
    internalOptionOnly: item.internalOptionOnly ?? false,
    highlights: previous?.highlights ?? [],
  };
});

const serialized = JSON.stringify(products);
const hash = crypto.createHash("sha256").update(serialized).digest("hex").slice(0, 12);
const shardName = `burger.${hash}.json`;
fs.writeFileSync(path.join(fallbackDir, shardName), serialized, "utf8");
manifest.stores.burger = { file: shardName, count: products.length };
manifest.count += products.length - currentBurger.count;
manifest.activeDatabaseCount = Math.min(manifest.activeDatabaseCount, manifest.count);
const burgerSlugs = new Set(products.map((product) => product.slug));
for (const [slug, store] of Object.entries(manifest.slugToStore)) {
  if (store === "burger" && !burgerSlugs.has(slug)) delete manifest.slugToStore[slug];
}
for (const slug of burgerSlugs) manifest.slugToStore[slug] = "burger";
manifest.generatedAt = new Date().toISOString();
fs.writeFileSync(manifestPath, JSON.stringify(manifest), "utf8");

console.log(JSON.stringify({
  localBurgerProducts: products.length,
  localBurgerVariants: products.reduce((count, product) => count + product.variants.length, 0),
  searchableBurgerProducts: candidate.products.filter((item) => !item.internalOptionOnly).length,
  productsWithCuratedSeoCopy: candidate.summary.productsWithCuratedCopy,
  variantsWithAutomaticPrice: candidate.products.reduce((count, item) =>
    count + item.variants.filter((variant: any) => Number.isFinite(variant.priceUsd)).length, 0),
  variantsMissingSupplierPrice: candidate.summary.variantsMissingSupplierPrice,
  productsRequiringManualQuote: candidate.summary.productsRequiringManualQuote,
  productsInternalOptionOnly: candidate.summary.productsInternalOptionOnly,
  digitalProductsWithoutPhysicalShipping: candidate.summary.digitalProductsWithoutPhysicalShipping,
  allVariantsSelectableInLocalPreview: true,
  productionDatabaseTouched: false,
  shard: shardName,
  manifestBackup: manifestBackupPath,
}, null, 2));
