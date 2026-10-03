import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { extractProductFitment } from "../src/lib/crossShopFitment";
import type { ShopProduct } from "../src/lib/shopCatalog";

async function main() {
const envPath = process.argv.find((arg) => arg.startsWith("--env-path="))?.slice(11);
if (!envPath) throw new Error("Explicit --env-path required; this script is read-only");
const env = parse(readFileSync(envPath));
const url = env.DIRECT_URL || env.DATABASE_URL;
if (!url) throw new Error("Database URL missing");
const prisma = new PrismaClient({ datasources: { db: { url } } });
try {
  const products = await prisma.shopProduct.findMany({
    where: { OR: [{ sku: { in: ["URB-DEC-26009343-V1", "URB-SPO-25353093-V1"] } }, { slug: "ipe-bmw-x5m-x6m-f95-f96-exhaust-system" }] },
    include: { metafields: true, variants: true, collections: { include: { collection: true } } },
  });
  for (const row of products) {
    const product = { id: row.id, slug: row.slug, sku: row.sku, brand: row.brand || row.vendor || "", vendor: row.vendor, tags: row.tags, scope: row.scope, title: { en: row.titleEn, ua: row.titleUa }, collection: { en: row.collectionEn || "", ua: row.collectionUa || "" }, category: { en: row.categoryEn || "", ua: row.categoryUa || "" }, shortDescription: { en: row.shortDescEn || "", ua: row.shortDescUa || "" }, longDescription: { en: row.longDescEn || "", ua: row.longDescUa || "" }, productType: row.productType } as unknown as ShopProduct;
    console.log(JSON.stringify({ id: row.id, slug: row.slug, sku: row.sku, published: row.isPublished, status: row.status, title: product.title, tags: row.tags, collections: row.collections.map((item) => item.collection.handle), fitment: extractProductFitment(product), fitmentMetadata: row.metafields.filter((item) => /fitment/.test(item.key)).map((item) => ({ key: item.key, value: item.value })) }));
  }
  const settings = await prisma.shopSettings.findUnique({ where: { key: "shop" }, select: { currencyRates: true, defaultCurrency: true } });
  console.log(JSON.stringify({ settings }));
  process.env.DATABASE_URL = url;
  const { resolveCanonicalVehicleProductIds } = await import("../src/lib/shopStockCanonicalVehicleIds.server");
  const { resolveLegacyVehicleProductIds } = await import("../src/lib/shopCatalogLegacyVehicleIds.server");
  for (const [make, model] of [["BMW", "X5 M"], ["Land Rover", "Defender"]]) {
    const canonical = await resolveCanonicalVehicleProductIds({ make, model, chassis: "", year: null, engine: null, fuel: null, opfGpf: null, scope: "auto" });
    const legacy = await resolveLegacyVehicleProductIds({ make, model });
    console.log(JSON.stringify({ make, model, canonicalCount: canonical?.length, legacyCount: legacy?.length, canonicalSample: products.filter((p) => canonical?.includes(p.id)).map((p) => p.sku), legacySample: products.filter((p) => legacy?.includes(p.id)).map((p) => p.sku) }));
  }
  const candidates = await prisma.shopProduct.findMany({
    where: { isPublished: true, status: "ACTIVE", OR: ["hose", "clamp", "шланг", "хомут"].flatMap((term) => [{ titleEn: { contains: term, mode: "insensitive" as const } }, { titleUa: { contains: term, mode: "insensitive" as const } }, { categoryEn: { contains: term, mode: "insensitive" as const } }, { categoryUa: { contains: term, mode: "insensitive" as const } }]) },
    include: { variants: true }, orderBy: { sku: "asc" },
  });
  const output = resolve("outputs/site-commerce-2026-10-03");
  mkdirSync(output, { recursive: true });
  writeFileSync(resolve(output, "hose-clamp-candidates.json"), JSON.stringify({ databaseHost: new URL(url).hostname, readAt: new Date().toISOString(), settings, products: candidates }, (_, value) => typeof value === "bigint" ? value.toString() : value, 2));
  console.log(JSON.stringify({ candidates: candidates.length, output }));
} finally { await prisma.$disconnect(); }
}
void main().catch((error) => { console.error(error instanceof Error ? error.message : "Audit failed"); process.exitCode = 1; });
