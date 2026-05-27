/**
 * Atomic Feed → DB sync (formerly /api/admin/cron/atomic-sync).
 *
 * Pulls https://feed.atomic-shop.ua/feed_tts.csv hourly, updates inventory
 * + price on existing variants, creates new ShopProduct records for
 * unknown SKUs. Migrated off Vercel Cron to save function-compute spend.
 *
 * Run via .github/workflows/atomic-sync-cron.yml (hourly).
 */

import { PrismaClient } from "@prisma/client";
import Papa from "papaparse";
import dotenv from "dotenv";
import { htmlToPlainText, sanitizeRichTextHtml } from "../src/lib/sanitizeRichTextHtml";
import { determineProductScope } from "../src/lib/akrapovicFilterUtils";
import { fetchPriceFromAtomicSite } from "./_lib/atomic-scraper";

dotenv.config({ path: ".env.local" });
const prisma = new PrismaClient();

function parseAtomicPrice(row: Record<string, unknown>): number | undefined {
  const candidates = [row.price_uah, row.price, row.retail, row.rrp];
  for (const candidate of candidates) {
    if (candidate === null || candidate === undefined) continue;
    const normalized = String(candidate).trim().replace(",", ".");
    if (!normalized) continue;
    const parsed = Number.parseFloat(normalized);
    if (!Number.isNaN(parsed)) {
      return Math.round(parsed);
    }
  }
  return undefined;
}

function generateSlug(brand: string, sku: string): string {
  return `${brand.toLowerCase()}-${sku
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")}`;
}

async function run() {
  console.log("[Atomic Sync] Fetching feed...");
  const feedUrl = "https://feed.atomic-shop.ua/feed_tts.csv";

  // Fetch Atomic Shop discount percentage from database
  const settings = await prisma.shopSettings.findUnique({ where: { key: "shop" } });
  const discountPercent = settings?.appAtomicDiscountPercent
    ? Number(settings.appAtomicDiscountPercent)
    : 0.0;
  console.log(`[Atomic Sync] Using Atomic Shop discount: ${discountPercent}%`);

  const response = await fetch(feedUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch atomic feed: ${response.statusText}`);
  }
  const csvText = await response.text();

  console.log("[Atomic Sync] Parsing CSV...");
  const parsed = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = parsed.data as any[];
  console.log(`[Atomic Sync] Parsed ${rows.length} rows.`);

  let updatedCount = 0;
  let createdCount = 0;
  const processedSkus = new Set<string>();

  for (const row of rows) {
    if (!row.mpn || !row.brand) continue;

    const mpn = String(row.mpn).trim();
    const brand = String(row.brand).trim();
    const stockVal = parseInt(row.stock || "0", 10);
    const title = row.title || `${brand} ${mpn}`;
    const description = row.description || null;
    const sanitizedDescriptionHtml = description ? sanitizeRichTextHtml(String(description)) : null;
    const descriptionText = sanitizedDescriptionHtml
      ? htmlToPlainText(sanitizedDescriptionHtml)
      : null;
    const categoryName = row.category || null;
    const imgLink = row.img_link || null;

    const variants = await prisma.shopProductVariant.findMany({
      where: {
        sku: mpn,
        product: {
          brand: { equals: brand, mode: "insensitive" },
        },
      },
      include: {
        product: true,
      },
    });

    const scope =
      variants.length > 0 ? variants[0].product.scope : determineProductScope(brand, mpn, title);
    const currentDiscount = scope === "moto" ? 5.0 : discountPercent;

    const rawPriceUah = parseAtomicPrice(row);
    let priceEur = undefined;
    if (rawPriceUah !== undefined && !isNaN(rawPriceUah)) {
      priceEur = Math.round((rawPriceUah / 52) * (1 - currentDiscount / 100));
    }

    if (variants.length > 0) {
      for (const variant of variants) {
        await prisma.shopProductVariant.update({
          where: { id: variant.id },
          data: {
            inventoryQty: isNaN(stockVal) ? 0 : stockVal,
            priceUah: null,
            priceUsd: null,
            ...(priceEur !== undefined && !isNaN(priceEur) && { priceEur }),
          },
        });
        await prisma.shopProduct.update({
          where: { id: variant.productId },
          data: {
            stock: stockVal > 0 ? "inStock" : "outOfStock",
            priceUah: null,
            priceUsd: null,
            ...(priceEur !== undefined && !isNaN(priceEur) && { priceEur }),
          },
        });
      }
      processedSkus.add(mpn.toLowerCase());
      updatedCount++;
    } else {
      const slug = generateSlug(brand, mpn);
      const existingSlug = await prisma.shopProduct.findUnique({ where: { slug } });
      const finalSlug = existingSlug ? `${slug}-${Date.now()}` : slug;

      await prisma.shopProduct.create({
        data: {
          slug: finalSlug,
          sku: mpn,
          brand,
          scope,
          isPublished: true,
          status: "ACTIVE",
          stock: stockVal > 0 ? "inStock" : "outOfStock",
          titleUa: title,
          titleEn: title,
          seoTitleUa: title,
          seoTitleEn: title,
          bodyHtmlUa: sanitizedDescriptionHtml,
          bodyHtmlEn: null,
          longDescUa: sanitizedDescriptionHtml,
          longDescEn: null,
          seoDescriptionUa: descriptionText ? descriptionText.slice(0, 300) : null,
          seoDescriptionEn: null,
          categoryUa: categoryName,
          categoryEn: categoryName,
          productCategory: categoryName,
          image: imgLink,
          priceUah: null,
          priceUsd: null,
          ...(priceEur !== undefined && !isNaN(priceEur) && { priceEur }),
          variants: {
            create: [
              {
                title,
                sku: mpn,
                position: 1,
                inventoryQty: isNaN(stockVal) ? 0 : stockVal,
                requiresShipping: true,
                image: imgLink,
                isDefault: true,
                priceUah: null,
                priceUsd: null,
                ...(priceEur !== undefined && !isNaN(priceEur) && { priceEur }),
              },
            ],
          },
          media: imgLink
            ? {
                create: [{ src: imgLink, altText: title, position: 1, mediaType: "IMAGE" }],
              }
            : undefined,
        },
      });
      processedSkus.add(mpn.toLowerCase());
      createdCount++;
    }
  }

  console.log(
    `[Atomic Sync] CSV sync complete. Checking remaining DB products of brand Akrapovic, Ohlins, CSF, Adro for live scraper fallback...`
  );

  const remainingProducts = await prisma.shopProduct.findMany({
    where: {
      brand: { in: ["AKRAPOVIC", "OHLINS", "CSF", "ADRO"], mode: "insensitive" },
    },
    include: {
      variants: true,
    },
  });

  let scrapedSuccessCount = 0;
  let scrapedFailCount = 0;

  const toScrape = remainingProducts.filter(
    (p) => p.sku && !processedSkus.has(p.sku.trim().toLowerCase())
  );
  console.log(`[Atomic Sync] Found ${toScrape.length} products to scrape via live fallback.`);

  if (toScrape.length > 0) {
    for (const product of toScrape) {
      if (!product.sku) continue;
      console.log(
        `[Atomic Sync] Running live scraper fallback for SKU: ${product.sku} (${product.brand})...`
      );

      // Enforce 1500ms delay between live requests to be safe
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const scraped = await fetchPriceFromAtomicSite(product.sku);
      if (scraped) {
        const currentDiscount = product.scope === "moto" ? 5.0 : discountPercent;
        const discountedPriceEur = Math.round(
          (scraped.priceUah / 52) * (1 - currentDiscount / 100)
        );

        for (const variant of product.variants) {
          await prisma.shopProductVariant.update({
            where: { id: variant.id },
            data: {
              inventoryQty: scraped.stockQty,
              priceUah: null,
              priceUsd: null,
              priceEur: discountedPriceEur,
            },
          });
        }

        await prisma.shopProduct.update({
          where: { id: product.id },
          data: {
            stock: scraped.stockStatus,
            priceUah: null,
            priceUsd: null,
            priceEur: discountedPriceEur,
          },
        });

        console.log(
          `[Atomic Sync] Successfully updated SKU: ${product.sku} -> priceEur: ${discountedPriceEur} EUR (original UAH: ${scraped.priceUah}), stock: ${scraped.stockStatus}`
        );
        scrapedSuccessCount++;
      } else {
        console.warn(
          `[Atomic Sync] Warning: SKU: ${product.sku} not found or failed to parse on Atomic Shop UA.`
        );
        scrapedFailCount++;
      }
    }
  }

  await prisma.adminAuditLog.create({
    data: {
      actorEmail: "cron@system.local",
      actorName: "Atomic Feed Cron (GitHub Actions)",
      action: "SYNC",
      scope: "INVENTORY",
      entityType: "ShopProductVariant",
      metadata: {
        updatedCount,
        createdCount,
        total: rows.length,
        scrapedSuccessCount,
        scrapedFailCount,
      },
    },
  });

  console.log(
    `[Atomic Sync] Done. CSV Updated: ${updatedCount}, CSV Created: ${createdCount}, Scraped Success: ${scrapedSuccessCount}, Scraped Failed/Missing: ${scrapedFailCount}`
  );
}

run()
  .catch((error) => {
    console.error("[Atomic Sync] Failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
