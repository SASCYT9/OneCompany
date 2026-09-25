import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import Papa from "papaparse";

import {
  ATOMIC_MOTO_DISCOUNT_PERCENT,
  ATOMIC_UAH_PER_EUR,
  calculateAtomicPricing,
  parseAtomicPriceUah,
} from "@/lib/atomicFeedPricing";
import { matchesBearerSecret, resolveSecret } from "@/lib/requestSecrets";
import { prisma } from "@/lib/prisma";
import { publishShopCatalogImportUpdate } from "@/lib/shopCatalogImportWriter.server";
import { runShopCatalogOutboxRuntime } from "@/lib/shopCatalogOutboxRuntime.server";
import { revalidateShopStorefrontProducts } from "@/lib/shopStorefrontRevalidation";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const atomicPriceSyncSession = {
  email: "cron@system.local",
  name: "Atomic Price Sync",
  permissions: ["*"],
  issuedAt: 0,
  nonce: "atomic-price-cron",
};

const variantSelect = {
  id: true,
  sku: true,
  productId: true,
  isDefault: true,
  priceEur: true,
  priceUsd: true,
  priceUah: true,
  compareAtEur: true,
  compareAtUsd: true,
  compareAtUah: true,
  product: {
    select: {
      id: true,
      slug: true,
      sku: true,
      brand: true,
      vendor: true,
      scope: true,
      catalogVersion: true,
      tags: true,
      priceEur: true,
      priceUsd: true,
      priceUah: true,
      compareAtEur: true,
      compareAtUsd: true,
      compareAtUah: true,
    },
  },
} satisfies Prisma.ShopProductVariantSelect;

type AtomicVariant = Prisma.ShopProductVariantGetPayload<{ select: typeof variantSelect }>;
type AtomicPrice = NonNullable<ReturnType<typeof calculateAtomicPricing>>;
type FeedPrice = { brand: string; sku: string; priceUah: number; source: "feed" | "collection" };
type VariantPriceChange = { variant: AtomicVariant; pricing: AtomicPrice };
type ProductPricePlan = {
  product: AtomicVariant["product"];
  variants: Map<string, VariantPriceChange>;
  parentPrices: AtomicPrice[];
};
type ProductPriceUpdate = {
  product: AtomicVariant["product"];
  updateData: Prisma.ShopProductUpdateInput;
  changedVariantCount: number;
};

type MissingCollection = {
  handle: string;
  brand: string;
  missingKeys: Set<string>;
};

type AtomicShopifyProduct = {
  variants?: Array<{ sku?: unknown; price?: unknown }>;
};

const ATOMIC_FALLBACK_BRANDS = ["AKRAPOVIC", "OHLINS", "CSF", "ADRO"] as const;
const ATOMIC_SHOPIFY_PAGE_SIZE = 250;
const ATOMIC_SHOPIFY_MAX_PAGES = 20;

function normalizeBrand(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("en-US");
}

function normalizeSku(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLocaleUpperCase("en-US");
}

function feedKey(brand: string | null | undefined, sku: string | null | undefined) {
  return `${normalizeBrand(brand)}\u0000${normalizeSku(sku)}`;
}

function chunk<T>(values: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

function toPriceFields(pricing: AtomicPrice) {
  return {
    priceEur: pricing.priceEur,
    priceUsd: null,
    priceUah: pricing.priceUah,
    compareAtEur: pricing.compareAtEur,
    compareAtUsd: null,
    compareAtUah: pricing.compareAtUah,
  };
}

function samePriceFields(
  current: {
    priceEur: unknown;
    priceUsd: unknown;
    priceUah: unknown;
    compareAtEur: unknown;
    compareAtUsd: unknown;
    compareAtUah: unknown;
  },
  expected: AtomicPrice
) {
  return (
    Number(current.priceEur) === expected.priceEur &&
    current.priceUsd == null &&
    Number(current.priceUah) === expected.priceUah &&
    Number(current.compareAtEur) === expected.compareAtEur &&
    current.compareAtUsd == null &&
    Number(current.compareAtUah) === expected.compareAtUah
  );
}

async function findCatalogVariants(skus: readonly string[]) {
  const variants: AtomicVariant[] = [];
  for (const skuBatch of chunk(skus, 500)) {
    const batch = await prisma.shopProductVariant.findMany({
      where: { sku: { in: skuBatch } },
      select: variantSelect,
    });
    variants.push(...batch);
  }
  return variants;
}

function getFallbackCollection(variant: AtomicVariant) {
  const brand = normalizeBrand(variant.product.brand);
  if (brand === "akrapovic") {
    return variant.product.scope === "moto" ? "akrapovic-moto" : "akrapovic";
  }
  if (brand === "ohlins" || brand === "csf" || brand === "adro") return brand;
  return null;
}

async function findMissingCollectionPrices(
  sourcePrices: Map<string, FeedPrice>,
  ambiguousSourceKeys: Set<string>
) {
  // The Atomic CSV omits some catalog SKUs; use Shopify collection JSON only for
  // exact existing brand/SKU pairs that were absent from the CSV.
  const existingVariants = await prisma.shopProductVariant.findMany({
    where: {
      product: {
        OR: ATOMIC_FALLBACK_BRANDS.map((brand) => ({
          brand: { equals: brand, mode: "insensitive" as const },
        })),
      },
    },
    select: variantSelect,
  });
  const missingByCollection = new Map<string, MissingCollection>();

  for (const variant of existingVariants) {
    const brand = String(variant.product.brand ?? "").trim();
    const sku = String(variant.sku ?? "").trim();
    if (!brand || !sku) continue;

    const key = feedKey(brand, sku);
    if (sourcePrices.has(key) || ambiguousSourceKeys.has(key)) continue;

    const handle = getFallbackCollection(variant);
    if (!handle) continue;

    const collection = missingByCollection.get(handle) ?? {
      handle,
      brand,
      missingKeys: new Set<string>(),
    };
    collection.missingKeys.add(key);
    missingByCollection.set(handle, collection);
  }

  let pageCount = 0;
  let rowsWithoutPrice = 0;
  let unavailableSkuCount = 0;
  const unavailableSkuSamples: string[] = [];
  for (const collection of missingByCollection.values()) {
    let reachedLastPage = false;

    for (let page = 1; page <= ATOMIC_SHOPIFY_MAX_PAGES; page += 1) {
      const url = new URL(`https://atomic-shop.ua/collections/${collection.handle}/products.json`);
      url.searchParams.set("limit", String(ATOMIC_SHOPIFY_PAGE_SIZE));
      url.searchParams.set("page", String(page));

      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "OneCompany Atomic Price Sync/1.0",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) {
        throw new Error(`Atomic collection ${collection.handle} returned HTTP ${response.status}`);
      }

      const payload = (await response.json()) as { products?: AtomicShopifyProduct[] };
      if (!Array.isArray(payload.products)) {
        throw new Error(`Atomic collection ${collection.handle} returned an invalid response`);
      }
      const products = payload.products;
      pageCount += 1;
      if (products.length === 0) {
        reachedLastPage = true;
        break;
      }

      for (const product of products) {
        for (const variant of product.variants ?? []) {
          const sku = String(variant.sku ?? "").trim();
          if (!sku) continue;
          const key = feedKey(collection.brand, sku);
          if (!collection.missingKeys.has(key) || ambiguousSourceKeys.has(key)) continue;

          const priceUah = parseAtomicPriceUah({ price: variant.price });
          if (priceUah === undefined) {
            rowsWithoutPrice += 1;
            continue;
          }

          const existing = sourcePrices.get(key);
          if (existing && existing.priceUah !== priceUah) {
            sourcePrices.delete(key);
            ambiguousSourceKeys.add(key);
            continue;
          }
          if (!existing) {
            sourcePrices.set(key, { brand: collection.brand, sku, priceUah, source: "collection" });
          }
        }
      }

      if (products.length < ATOMIC_SHOPIFY_PAGE_SIZE) {
        reachedLastPage = true;
        break;
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 250));
    }

    if (!reachedLastPage) {
      throw new Error(`Atomic collection ${collection.handle} exceeded the page safety limit`);
    }

    for (const key of collection.missingKeys) {
      if (sourcePrices.has(key) || ambiguousSourceKeys.has(key)) continue;
      unavailableSkuCount += 1;
      if (unavailableSkuSamples.length < 12) {
        unavailableSkuSamples.push(`${collection.brand}:${key.split("\u0000")[1] ?? ""}`);
      }
    }
  }

  return { pageCount, rowsWithoutPrice, unavailableSkuCount, unavailableSkuSamples };
}

function buildUpdatePlans(
  sourcePrices: ReadonlyMap<string, FeedPrice>,
  variants: readonly AtomicVariant[]
) {
  const variantsBySource = new Map<string, AtomicVariant[]>();
  for (const variant of variants) {
    const key = feedKey(variant.product.brand, variant.sku ?? "");
    if (!sourcePrices.has(key)) continue;
    const matching = variantsBySource.get(key) ?? [];
    matching.push(variant);
    variantsBySource.set(key, matching);
  }

  let unmatchedSkuCount = 0;
  let ambiguousCatalogMatchCount = 0;
  let conflictingParentPriceCount = 0;
  const productPlans = new Map<string, ProductPricePlan>();

  for (const [key, source] of sourcePrices) {
    const matchingVariants = variantsBySource.get(key) ?? [];
    if (matchingVariants.length === 0) {
      unmatchedSkuCount += 1;
      continue;
    }

    const productIds = new Set(matchingVariants.map((variant) => variant.productId));
    if (productIds.size !== 1) {
      ambiguousCatalogMatchCount += 1;
      continue;
    }

    const product = matchingVariants[0]!.product;
    const pricing = calculateAtomicPricing(
      source.priceUah,
      product.scope === "moto" ? "moto" : "other"
    );
    if (!pricing) {
      unmatchedSkuCount += 1;
      continue;
    }

    const plan = productPlans.get(product.id) ?? {
      product,
      variants: new Map<string, VariantPriceChange>(),
      parentPrices: [],
    };
    for (const variant of matchingVariants) {
      plan.variants.set(variant.id, { variant, pricing });
      if (normalizeSku(product.sku) === normalizeSku(source.sku) || variant.isDefault) {
        plan.parentPrices.push(pricing);
      }
    }
    productPlans.set(product.id, plan);
  }

  let changedVariantCount = 0;
  const updates: ProductPriceUpdate[] = [];
  for (const plan of productPlans.values()) {
    const distinctParentPrices = new Map(
      plan.parentPrices.map((pricing) => [
        `${pricing.priceUah}:${pricing.priceEur}:${pricing.compareAtUah}:${pricing.compareAtEur}`,
        pricing,
      ])
    );
    const parentPricing =
      distinctParentPrices.size === 1 ? [...distinctParentPrices.values()][0] : null;
    if (distinctParentPrices.size > 1) conflictingParentPriceCount += 1;

    const variantUpdates = [...plan.variants.values()]
      .filter(({ variant, pricing }) => !samePriceFields(variant, pricing))
      .map(({ variant, pricing }) => ({
        where: { id: variant.id },
        data: toPriceFields(pricing),
      }));
    const updateParent = parentPricing && !samePriceFields(plan.product, parentPricing);

    if (variantUpdates.length === 0 && !updateParent) continue;

    changedVariantCount += variantUpdates.length;
    updates.push({
      product: plan.product,
      changedVariantCount: variantUpdates.length,
      updateData: {
        ...(updateParent && parentPricing ? toPriceFields(parentPricing) : {}),
        ...(variantUpdates.length > 0 ? { variants: { update: variantUpdates } } : {}),
      },
    });
  }

  return {
    updates,
    changedVariantCount,
    unmatchedSkuCount,
    ambiguousCatalogMatchCount,
    conflictingParentPriceCount,
  };
}

export async function GET(request: Request) {
  const cronSecret = resolveSecret("CRON_SECRET");
  if (!cronSecret) {
    return NextResponse.json(
      { success: false, error: "CRON_SECRET is not configured" },
      { status: 503 }
    );
  }
  if (!matchesBearerSecret(request.headers, cronSecret)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";

  try {
    const response = await fetch("https://feed.atomic-shop.ua/feed_tts.csv", {
      cache: "no-store",
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: `Atomic feed returned HTTP ${response.status}` },
        { status: 502 }
      );
    }

    const parsed = Papa.parse<Record<string, unknown>>(await response.text(), {
      header: true,
      skipEmptyLines: true,
    });
    const rows = parsed.data;
    const sourcePrices = new Map<string, FeedPrice>();
    const ambiguousSourceKeys = new Set<string>();
    let rowsWithoutPrice = 0;

    for (const row of rows) {
      const brand = String(row.brand ?? "").trim();
      const sku = String(row.mpn ?? "").trim();
      if (!brand || !sku) continue;

      const priceUah = parseAtomicPriceUah(row);
      if (priceUah === undefined) {
        rowsWithoutPrice += 1;
        continue;
      }

      const key = feedKey(brand, sku);
      if (ambiguousSourceKeys.has(key)) continue;
      const existing = sourcePrices.get(key);
      if (existing && existing.priceUah !== priceUah) {
        sourcePrices.delete(key);
        ambiguousSourceKeys.add(key);
        continue;
      }
      if (!existing) sourcePrices.set(key, { brand, sku, priceUah, source: "feed" });
    }

    if (rows.length === 0 || sourcePrices.size === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Atomic feed contained no usable SKU-price rows; no catalog changes were made",
        },
        { status: 502 }
      );
    }

    const feedSourceSkuCount = sourcePrices.size;
    const collectionFallback = await findMissingCollectionPrices(sourcePrices, ambiguousSourceKeys);
    rowsWithoutPrice += collectionFallback.rowsWithoutPrice;

    const skuList = [...new Set([...sourcePrices.values()].map((source) => source.sku))];
    const variants = await findCatalogVariants(skuList);
    const plan = buildUpdatePlans(sourcePrices, variants);
    const summary = {
      dryRun,
      source: "Atomic Shop UA",
      feedRows: rows.length,
      sourceSkuCount: sourcePrices.size,
      feedSourceSkuCount,
      collectionFallbackSkuCount: [...sourcePrices.values()].filter(
        (source) => source.source === "collection"
      ).length,
      collectionPagesFetched: collectionFallback.pageCount,
      unavailableCatalogSkuCount: collectionFallback.unavailableSkuCount,
      unavailableCatalogSkuSamples: collectionFallback.unavailableSkuSamples,
      ambiguousSourceCount: ambiguousSourceKeys.size,
      rowsWithoutPrice,
      unmatchedSkuCount: plan.unmatchedSkuCount,
      ambiguousCatalogMatchCount: plan.ambiguousCatalogMatchCount,
      conflictingParentPriceCount: plan.conflictingParentPriceCount,
      productsToUpdate: plan.updates.length,
      variantsToUpdate: plan.changedVariantCount,
      uahPerEur: ATOMIC_UAH_PER_EUR,
      motoDiscountPercent: ATOMIC_MOTO_DISCOUNT_PERCENT,
      nonMotoDiscountPercent: 0,
    };

    if (dryRun) return NextResponse.json({ success: true, ...summary });

    const saved: ProductPriceUpdate[] = [];
    const failedProductIds: string[] = [];
    let nextIndex = 0;
    const workerCount = Math.min(4, plan.updates.length);
    await Promise.all(
      Array.from({ length: workerCount }, async () => {
        while (nextIndex < plan.updates.length) {
          const current = plan.updates[nextIndex++];
          if (!current) continue;
          try {
            await publishShopCatalogImportUpdate({
              productId: current.product.id,
              expectedCatalogVersion: current.product.catalogVersion,
              updateData: current.updateData,
              session: atomicPriceSyncSession,
              reason: "sync.atomic.price",
              changeDomains: ["PRICE"],
            });
            saved.push(current);
          } catch (error) {
            failedProductIds.push(current.product.id);
            console.error("[atomic-price-sync] product price update failed", {
              productId: current.product.id,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      })
    );

    const changedProducts = saved.map(({ product }) => ({
      slug: product.slug,
      brand: product.brand,
      vendor: product.vendor,
      tags: product.tags,
    }));
    let publication = null;
    if (saved.length > 0) {
      publication = await runShopCatalogOutboxRuntime({
        workerId: `atomic-price:${process.env.VERCEL_REGION || "local"}:${randomUUID()}`,
        limit: Math.min(50, saved.length),
      });
      try {
        revalidateShopStorefrontProducts(changedProducts);
      } catch (error) {
        console.error("[atomic-price-sync] targeted storefront revalidation failed", error);
      }
    }

    await prisma.adminAuditLog.create({
      data: {
        actorEmail: atomicPriceSyncSession.email,
        actorName: atomicPriceSyncSession.name,
        action: "SYNC",
        scope: "PRICE",
        entityType: "AtomicPriceSync",
        metadata: {
          ...summary,
          dryRun: false,
          updatedProductCount: saved.length,
          updatedVariantCount: saved.reduce(
            (total, update) => total + update.changedVariantCount,
            0
          ),
          failedCount: failedProductIds.length,
        },
      },
    });

    return NextResponse.json(
      {
        success: failedProductIds.length === 0,
        ...summary,
        updatedProductCount: saved.length,
        updatedVariantCount: saved.reduce((total, update) => total + update.changedVariantCount, 0),
        failedCount: failedProductIds.length,
        publication,
      },
      { status: failedProductIds.length === 0 ? 200 : 500 }
    );
  } catch (error) {
    console.error("[atomic-price-sync] failed", error);
    return NextResponse.json(
      { success: false, error: "Atomic price sync failed" },
      { status: 500 }
    );
  }
}
