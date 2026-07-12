import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { resolveShopStorefrontSegment } from "../src/lib/shopStorefrontRouting";
import type { ShopProduct } from "../src/lib/shopCatalog";

const INDEX_KEYS = [
  "adro",
  "brabus",
  "burger",
  "csf",
  "girodisc",
  "ipe",
  "ohlins",
  "racechip",
] as const;
type IndexKey = (typeof INDEX_KEYS)[number];

const snapshotPath = path.join(process.cwd(), "data", "shop-products.snapshot.json");
const outputDir = path.join(process.cwd(), "public", "catalog-index");

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
    variants: defaultVariant ? [defaultVariant] : undefined,
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

fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });

const manifest: Record<IndexKey, { file: string; count: number }> = {} as Record<
  IndexKey,
  { file: string; count: number }
>;

for (const key of INDEX_KEYS) {
  const json = JSON.stringify(groups[key]);
  const hash = crypto.createHash("sha256").update(json).digest("hex").slice(0, 12);
  const file = `${key}.${hash}.json`;
  fs.writeFileSync(path.join(outputDir, file), json, "utf8");
  manifest[key] = { file, count: groups[key].length };
  console.log(`[catalog-index] ${key}: ${groups[key].length} products, ${file}`);
}

fs.writeFileSync(
  path.join(outputDir, "manifest.json"),
  JSON.stringify({ generatedAt: new Date().toISOString(), indexes: manifest }),
  "utf8"
);

// The monolithic file is only an intermediate input for this generator.
// Removing it before `next build` prevents output tracing from copying the
// same ~46 MB payload into dozens of storefront functions.
fs.rmSync(snapshotPath, { force: true });
