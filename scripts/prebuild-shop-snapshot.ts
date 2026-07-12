/**
 * Build-time snapshot of shop settings and products.
 *
 * Vercel's static prerender pass spawns multiple worker processes that each
 * load `[locale]/layout.tsx` and many shop pages — every one of those calls
 * `getOrCreateShopSettings(prisma)`. With Vercel Postgres' restricted
 * `prisma_migration` role connection ceiling, this triggers a "too many
 * database connections" storm.
 *
 * Additionally, querying the entire database catalog of 15k products with
 * multiple joins takes >60 seconds in production, causing serverless function
 * execution timeouts.
 *
 * This script runs once before `next build`, fetches settings and products,
 * and writes snapshots to:
 * - `data/shop-settings.snapshot.json`
 * - `data/shop-products.snapshot.json`
 *
 * The storefront routes and APIs consult these snapshots during production
 * runtime to bypass slow database queries entirely.
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";
import crypto from "node:crypto";

import { getShopProductBySlugServer, getShopProductsServer } from "../src/lib/shopCatalogServer";
import { resolveShopStorefrontSegment } from "../src/lib/shopStorefrontRouting";

const SETTINGS_OUTPUT = path.join(process.cwd(), "data", "shop-settings.snapshot.json");
const PRODUCTS_OUTPUT = path.join(process.cwd(), "data", "shop-products.snapshot.json");
const FALLBACK_OUTPUT_DIR = path.join(process.cwd(), "public", "catalog-fallback");
const FALLBACK_VERSION = 2;

async function main() {
  const prisma = new PrismaClient();
  try {
    console.log("[prebuild-shop-snapshot] fetching settings and product count...");
    const [settings, activeProducts] = await Promise.all([
      prisma.shopSettings.findUnique({ where: { key: "shop" } }),
      prisma.shopProduct.findMany({
        where: { isPublished: true, status: "ACTIVE" },
        select: { slug: true },
      }),
    ]);
    const productCount = activeProducts.length;

    if (!settings) {
      console.warn(
        "[prebuild-shop-snapshot] no shop settings row found — skipping settings snapshot"
      );
    } else {
      fs.writeFileSync(SETTINGS_OUTPUT, JSON.stringify(settings, null, 2), "utf8");
      console.log(
        `[prebuild-shop-snapshot] wrote settings to ${path.relative(process.cwd(), SETTINGS_OUTPUT)}`
      );
    }

    console.log(
      `[prebuild-shop-snapshot] database contains ${productCount} active published products`
    );
    if (productCount === 0) {
      throw new Error(
        "No published products found in database! Database might be empty or disconnected."
      );
    }

    // Never let a previous local/build artifact short-circuit the fresh DB
    // read below. The old behavior silently reused a stale 14,934-product
    // snapshot while the database already contained 15,015 active rows.
    fs.rmSync(PRODUCTS_OUTPUT, { force: true });

    // Fetch products using getShopProductsServer (includes full DB fetch + static fallbacks mapping)
    console.log("[prebuild-shop-snapshot] fetching all products catalog...");
    const start = Date.now();
    const products = await getShopProductsServer();
    const loadedSlugs = new Set(products.map((product) => product.slug));
    const missingActiveSlugs = activeProducts
      .map((product) => product.slug)
      .filter((slug) => !loadedSlugs.has(slug));
    if (missingActiveSlugs.length > 0) {
      console.log(
        `[prebuild-shop-snapshot] recovering ${missingActiveSlugs.length} active rows removed by catalog deduplication`
      );
      const recovered = await Promise.all(
        missingActiveSlugs.map((slug) => getShopProductBySlugServer(slug))
      );
      for (const product of recovered) {
        if (product && !loadedSlugs.has(product.slug)) {
          products.push(product);
          loadedSlugs.add(product.slug);
        }
      }
    }
    console.log(
      `[prebuild-shop-snapshot] loaded ${products.length} products in ${Date.now() - start}ms`
    );

    // Generate simplified products snapshot
    console.log("[prebuild-shop-snapshot] writing simplified products snapshot...");
    const simplifiedProducts = products.map((product: any) => {
      const defaultVariant =
        product.variants?.find((v: any) => v.isDefault) || product.variants?.[0];
      return {
        id: product.id,
        slug: product.slug,
        sku: product.sku,
        scope: product.scope,
        brand: product.brand,
        vendor: product.vendor,
        productType: product.productType,
        title: product.title,
        category: product.category,
        shortDescription: product.shortDescription,
        longDescription: product.longDescription,
        leadTime: product.leadTime,
        stock: product.stock,
        collection: product.collection,
        collections: product.collections,
        tags: product.tags,
        price: product.price,
        compareAt: product.compareAt,
        image: product.image,
        gallery: product.gallery,
        highlights: product.highlights,
        variants: defaultVariant
          ? [
              {
                id: defaultVariant.id,
                title: defaultVariant.title,
                sku: defaultVariant.sku,
                optionValues: defaultVariant.optionValues,
                isDefault: true,
              },
            ]
          : [],
      };
    });

    const uniqueSlugs = new Set(simplifiedProducts.map((product) => product.slug));
    if (uniqueSlugs.size !== simplifiedProducts.length) {
      throw new Error(
        `Duplicate product slugs in fallback snapshot: ${simplifiedProducts.length - uniqueSlugs.size}`
      );
    }
    if (simplifiedProducts.length < productCount) {
      throw new Error(
        `Fallback snapshot is truncated: ${simplifiedProducts.length} products for ${productCount} active DB rows`
      );
    }

    fs.rmSync(FALLBACK_OUTPUT_DIR, { recursive: true, force: true });
    fs.mkdirSync(FALLBACK_OUTPUT_DIR, { recursive: true });

    const groups = new Map<string, typeof simplifiedProducts>();
    const slugToStore: Record<string, string> = {};
    for (const product of simplifiedProducts) {
      const store = resolveShopStorefrontSegment(product) ?? "generic";
      const group = groups.get(store) ?? [];
      group.push(product);
      groups.set(store, group);
      slugToStore[product.slug] = store;
    }

    const stores: Record<string, { file: string; count: number }> = {};
    for (const [store, storeProducts] of [...groups.entries()].sort(([a], [b]) =>
      a.localeCompare(b)
    )) {
      const json = JSON.stringify(storeProducts);
      const hash = crypto.createHash("sha256").update(json).digest("hex").slice(0, 12);
      const file = `${store}.${hash}.json`;
      fs.writeFileSync(path.join(FALLBACK_OUTPUT_DIR, file), json, "utf8");
      stores[store] = { file, count: storeProducts.length };
    }

    const sitemapRows = simplifiedProducts.map((product) => ({
      slug: product.slug,
      brand: product.brand ?? "",
      vendor: product.vendor ?? undefined,
      tags: product.tags ?? [],
      productType: product.productType ?? undefined,
    }));
    fs.writeFileSync(
      path.join(FALLBACK_OUTPUT_DIR, "sitemap.json"),
      JSON.stringify(sitemapRows),
      "utf8"
    );

    // Manifest is written last: its presence means all referenced immutable
    // shards are complete and safe for runtime fallback reads.
    fs.writeFileSync(
      path.join(FALLBACK_OUTPUT_DIR, "manifest.json"),
      JSON.stringify({
        version: FALLBACK_VERSION,
        generatedAt: new Date().toISOString(),
        count: simplifiedProducts.length,
        activeDatabaseCount: productCount,
        stores,
        slugToStore,
      }),
      "utf8"
    );
    fs.writeFileSync(PRODUCTS_OUTPUT, JSON.stringify(simplifiedProducts), "utf8");
    console.log(
      `[prebuild-shop-snapshot] wrote simplified products to ${path.relative(process.cwd(), PRODUCTS_OUTPUT)}`
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  const isProd = process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
  if (isProd) {
    console.error(
      "[prebuild-shop-snapshot] CRITICAL BUILD ERROR (failing build):",
      err?.message || err
    );
    process.exit(1);
  } else {
    console.warn(
      "[prebuild-shop-snapshot] failed (dev/local build will continue):",
      err?.message || err
    );
    process.exit(0);
  }
});
