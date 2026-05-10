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

    const priceUah = parseAtomicPrice(row);

    const variants = await prisma.shopProductVariant.findMany({
      where: {
        sku: mpn,
        product: {
          brand: { equals: brand, mode: "insensitive" },
        },
      },
    });

    if (variants.length > 0) {
      for (const variant of variants) {
        await prisma.shopProductVariant.update({
          where: { id: variant.id },
          data: {
            inventoryQty: isNaN(stockVal) ? 0 : stockVal,
            ...(priceUah !== undefined && !isNaN(priceUah) && { priceUah }),
          },
        });
        await prisma.shopProduct.update({
          where: { id: variant.productId },
          data: {
            stock: stockVal > 0 ? "inStock" : "outOfStock",
            ...(priceUah !== undefined && !isNaN(priceUah) && { priceUah }),
          },
        });
      }
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
          scope: "auto",
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
          ...(priceUah !== undefined && !isNaN(priceUah) && { priceUah }),
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
                ...(priceUah !== undefined && !isNaN(priceUah) && { priceUah }),
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
      createdCount++;
    }
  }

  await prisma.adminAuditLog.create({
    data: {
      actorEmail: "cron@system.local",
      actorName: "Atomic Feed Cron (GitHub Actions)",
      action: "SYNC",
      scope: "INVENTORY",
      entityType: "ShopProductVariant",
      metadata: { updatedCount, createdCount, total: rows.length },
    },
  });

  console.log(
    `[Atomic Sync] Done. Updated: ${updatedCount}, Created: ${createdCount}, Total rows: ${rows.length}`
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
