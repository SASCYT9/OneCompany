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
 * - `data/shop-products-fitments.snapshot.json`
 *
 * The storefront routes and APIs consult these snapshots during production
 * runtime to bypass slow database queries entirely.
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

// Import mapping & search helpers
import { getShopProductsServer } from "../src/lib/shopCatalogServer";
import { extractProductFitment } from "../src/lib/crossShopFitment";
import { getProductDisplayBrand } from "../src/app/api/shop/stock/search/route";
import { normalizeShopSearchText } from "../src/lib/shopSearch";

const SETTINGS_OUTPUT = path.join(process.cwd(), "data", "shop-settings.snapshot.json");
const PRODUCTS_OUTPUT = path.join(process.cwd(), "data", "shop-products.snapshot.json");
const FITMENTS_OUTPUT = path.join(process.cwd(), "data", "shop-products-fitments.snapshot.json");

async function main() {
  const prisma = new PrismaClient();
  try {
    console.log("[prebuild-shop-snapshot] fetching settings and product count...");
    const [settings, productCount] = await Promise.all([
      prisma.shopSettings.findUnique({ where: { key: "shop" } }),
      prisma.shopProduct.count({ where: { isPublished: true, status: "ACTIVE" } }),
    ]);

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

    // Fetch products using getShopProductsServer (includes full DB fetch + static fallbacks mapping)
    console.log("[prebuild-shop-snapshot] fetching all products catalog...");
    const start = Date.now();
    const products = await getShopProductsServer();
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
        b2bPrice: product.b2bPrice,
        compareAt: product.compareAt,
        b2bCompareAt: product.b2bCompareAt,
        image: product.image,
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
    fs.writeFileSync(PRODUCTS_OUTPUT, JSON.stringify(simplifiedProducts), "utf8");
    console.log(
      `[prebuild-shop-snapshot] wrote simplified products to ${path.relative(process.cwd(), PRODUCTS_OUTPUT)}`
    );

    // Generate fitments snapshot
    console.log("[prebuild-shop-snapshot] extracting fitments and writing fitments snapshot...");
    const productsWithFitments = products.map((product: any) => {
      const fitment = extractProductFitment(product);
      const displayBrand = getProductDisplayBrand(product.brand);

      const searchText = [
        product.title?.en,
        product.title?.ua,
        product.sku,
        product.slug,
        displayBrand,
        product.vendor,
        product.productType,
        product.category?.ua,
        product.category?.en,
        product.collection?.ua,
        product.collection?.en,
        ...(product.tags ?? []),
      ]
        .map((value) => String(value ?? "").trim())
        .filter(Boolean)
        .join(" ");

      const defaultVariant =
        product.variants?.find((v: any) => v.isDefault) || product.variants?.[0];
      const simplifiedProduct = {
        id: product.id,
        slug: product.slug,
        sku: product.sku,
        brand: product.brand,
        vendor: product.vendor,
        title: product.title,
        category: product.category,
        shortDescription: product.shortDescription,
        longDescription: product.longDescription,
        collection: product.collection,
        collections: product.collections,
        productType: product.productType,
        tags: product.tags,
        highlights: product.highlights,
        image: product.image,
        stock: product.stock,
        price: product.price,
        b2bPrice: product.b2bPrice,
        compareAt: product.compareAt,
        b2bCompareAt: product.b2bCompareAt,
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

      return {
        product: simplifiedProduct,
        fitment,
        searchText: normalizeShopSearchText(searchText),
      };
    });
    fs.writeFileSync(FITMENTS_OUTPUT, JSON.stringify(productsWithFitments), "utf8");
    console.log(
      `[prebuild-shop-snapshot] wrote fitments to ${path.relative(process.cwd(), FITMENTS_OUTPUT)}`
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
