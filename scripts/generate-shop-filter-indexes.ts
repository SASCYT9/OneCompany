import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { resolveShopStorefrontSegment } from "../src/lib/shopStorefrontRouting";
import type { ShopProduct } from "../src/lib/shopCatalog";
import {
  CATALOG_FILTER_INDEX_KEYS,
  readCatalogBuildArtifactKey,
  resolveCatalogBuildCacheDir,
  restoreCatalogBuildArtifactIndexes,
  saveCatalogBuildArtifact,
} from "./lib/catalog-build-artifact";

const INDEX_KEYS = CATALOG_FILTER_INDEX_KEYS;
type IndexKey = (typeof INDEX_KEYS)[number];

const snapshotPath = path.join(process.cwd(), "data", "shop-products.snapshot.json");
const outputDir = path.join(process.cwd(), "public", "catalog-index");

function replaceDirectoryAtomically(stagedDirectory: string, targetDirectory: string) {
  const staged = path.resolve(stagedDirectory);
  const target = path.resolve(targetDirectory);
  if (path.dirname(staged) !== path.dirname(target) || staged === target) {
    throw new Error("Staged and target index directories must be distinct siblings");
  }
  if (!fs.statSync(staged).isDirectory()) throw new Error("Staged index path is not a directory");
  const backup = `${target}.backup-${process.pid}-${Date.now()}`;
  const hadTarget = fs.existsSync(target);
  try {
    if (hadTarget) fs.renameSync(target, backup);
    fs.renameSync(staged, target);
    if (hadTarget) fs.rmSync(backup, { recursive: true, force: true });
  } catch (error) {
    if (!fs.existsSync(target) && hadTarget && fs.existsSync(backup)) fs.renameSync(backup, target);
    throw error;
  }
}

const artifactKey = readCatalogBuildArtifactKey();
if (artifactKey) {
  const restored = restoreCatalogBuildArtifactIndexes({
    cacheDir: resolveCatalogBuildCacheDir({ configuredDir: process.env.CATALOG_BUILD_CACHE_DIR }),
    key: artifactKey,
    outputDir,
  });
  if (restored) {
    console.log(`[catalog-index] restored artifact ${artifactKey}; skipping index generation`);
    fs.rmSync(snapshotPath, { force: true });
    process.exit(0);
  }
  console.log(`[catalog-index] no valid index artifact for ${artifactKey}; generating indexes`);
}

function projectProduct(product: ShopProduct, key: IndexKey): ShopProduct {
  const empty = { ua: "", en: "" };
  const emptyMoney = { eur: 0, usd: 0, uah: 0 };
  if (key === "racechip") {
    const en = product.title?.en ?? "";
    const ua = product.title?.ua ?? "";
    return {
      slug: product.slug,
      sku: "",
      scope: product.scope,
      brand: product.brand,
      productType: product.productType,
      tags: (product.tags ?? []).filter((tag) => tag.startsWith("car_")),
      title: ua && ua !== en ? { ua, en } : { ua: "", en },
      category: empty,
      shortDescription: empty,
      longDescription: empty,
      leadTime: empty,
      stock: product.stock,
      collection: empty,
      price: product.price ?? emptyMoney,
      europePrice: product.europePrice,
      compareAt: product.compareAt,
      image: product.image,
      highlights: [],
    };
  }

  const defaultVariant =
    product.variants?.find((variant) => variant.isDefault) ?? product.variants?.[0];
  const variants = key === "burger"
    ? product.variants?.map((variant) => ({
        id: variant.id,
        title: variant.title,
        sku: variant.sku,
        position: variant.position,
        optionValues: variant.optionValues,
        isDefault: variant.isDefault,
      }))
    : defaultVariant ? [defaultVariant] : undefined;
  const firstImage = product.gallery?.[0] ?? product.image ?? "";
  return {
    slug: product.slug,
    sku: product.sku,
    scope: product.scope,
    brand: product.brand,
    vendor: product.vendor,
    productType: product.productType,
    tags: product.tags,
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
    gallery: firstImage ? [firstImage] : undefined,
    variants,
    highlights: [],
  };
}

if (!fs.existsSync(snapshotPath)) {
  throw new Error(`Missing product snapshot: ${snapshotPath}`);
}

const products = JSON.parse(fs.readFileSync(snapshotPath, "utf8")) as ShopProduct[];
const groups = Object.fromEntries(INDEX_KEYS.map((key) => [key, []])) as Record<
  IndexKey,
  ShopProduct[]
>;

for (const product of products) {
  const segment = resolveShopStorefrontSegment(product);
  if (segment && INDEX_KEYS.includes(segment as IndexKey)) {
    const key = segment as IndexKey;
    groups[key].push(projectProduct(product, key));
  }
}

let stagedOutputDir: string | null = fs.mkdtempSync(
  path.join(path.dirname(outputDir), ".catalog-index-staged-")
);
fs.mkdirSync(stagedOutputDir, { recursive: true });

const manifest: Record<IndexKey, { file: string; count: number }> = {} as Record<
  IndexKey,
  { file: string; count: number }
>;

for (const key of INDEX_KEYS) {
  const json = JSON.stringify(groups[key]);
  const hash = crypto.createHash("sha256").update(json).digest("hex").slice(0, 12);
  const file = `${key}.${hash}.json`;
  fs.writeFileSync(path.join(stagedOutputDir, file), json, "utf8");
  manifest[key] = { file, count: groups[key].length };
  console.log(`[catalog-index] ${key}: ${groups[key].length} products, ${file}`);
}

fs.writeFileSync(
  path.join(stagedOutputDir, "manifest.json"),
  JSON.stringify({ generatedAt: new Date().toISOString(), indexes: manifest }),
  "utf8"
);

replaceDirectoryAtomically(stagedOutputDir, outputDir);
stagedOutputDir = null;

if (artifactKey) {
  const fallbackManifestPath = path.join(
    process.cwd(),
    "public",
    "catalog-fallback",
    "manifest.json"
  );
  const fallbackManifest = JSON.parse(fs.readFileSync(fallbackManifestPath, "utf8")) as {
    count?: number;
    activeDatabaseCount?: number;
  };
  if (
    !Number.isSafeInteger(fallbackManifest.count) ||
    !Number.isSafeInteger(fallbackManifest.activeDatabaseCount) ||
    fallbackManifest.count !== products.length
  ) {
    throw new Error("Catalog fallback manifest does not match filter-index input");
  }
  saveCatalogBuildArtifact({
    cacheDir: resolveCatalogBuildCacheDir({ configuredDir: process.env.CATALOG_BUILD_CACHE_DIR }),
    key: artifactKey,
    paths: {
      productsOutput: snapshotPath,
      settingsOutput: path.join(process.cwd(), "data", "shop-settings.snapshot.json"),
      fallbackOutputDir: path.join(process.cwd(), "public", "catalog-fallback"),
      indexOutputDir: outputDir,
    },
    productCount: fallbackManifest.count,
    activeDatabaseCount: fallbackManifest.activeDatabaseCount,
  });
  console.log(`[catalog-index] cached complete catalog artifact ${artifactKey}`);
}

// The monolithic file is only an intermediate input for this generator.
// Removing it before `next build` prevents output tracing from copying the
// same ~46 MB payload into dozens of storefront functions.
fs.rmSync(snapshotPath, { force: true });

if (stagedOutputDir) fs.rmSync(stagedOutputDir, { recursive: true, force: true });
