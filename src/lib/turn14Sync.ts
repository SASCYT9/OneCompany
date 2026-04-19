import { PrismaClient } from '@prisma/client';
import { fetchTurn14ItemPricing } from './turn14';
import { htmlToPlainText, sanitizeRichTextHtml } from '@/lib/sanitizeRichTextHtml';

// Approximate exchange rates for auto-conversion from USD
// These serve as reasonable defaults for display pricing
const USD_TO_EUR = 0.92;
const USD_TO_UAH = 41.5;

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Maps and imports (upserts) a raw Turn14 Item JSON payload into the Prisma DB.
 * Creates ShopProduct + ShopProductVariant + ShopProductMedia.
 * If already exists (by slug or SKU), updates pricing / stock instead of duplicating.
 */
export async function importTurn14ItemToDb(
  prisma: PrismaClient,
  turn14Data: any,
  options: { brandOverride?: string; fetchPricing?: boolean } = {}
) {
  const attributes = turn14Data.attributes || turn14Data;
  const brand = options.brandOverride || attributes.brand_name || attributes.brand || 'Turn14';
  const partNumber = attributes.part_number || attributes.mfr_part_number || '';
  const sku = partNumber || `t14-${turn14Data.id}`;
  const productName = attributes.product_name || attributes.item_name || attributes.name || 'Auto Part';
  const description = typeof attributes.part_description === 'string' ? attributes.part_description : '';
  const sanitizedDescriptionHtml = description ? sanitizeRichTextHtml(description) : '';
  const descriptionText = sanitizedDescriptionHtml ? htmlToPlainText(sanitizedDescriptionHtml) : '';
  const thumbnail = attributes.thumbnail || null;

  // Build deterministic slug
  const slug = buildSlug(brand, sku);

  // Try to get pricing data from the API
  let retailPrice = 0;
  let jobberPrice = 0;
  if (options.fetchPricing && turn14Data.id) {
    try {
      const pricingData = await fetchTurn14ItemPricing(turn14Data.id);
      if (pricingData?.data?.attributes) {
        const pa = pricingData.data.attributes;
        const pricelists = pa.pricelists || [];
        const retailPl = pricelists.find((p: any) => p.name === 'Retail') || pricelists.find((p: any) => p.name === 'MAP');
        const listPl = pricelists.find((p: any) => p.name === 'List');
        
        retailPrice = parseFloat(retailPl?.price || listPl?.price || '0') || 0;
        jobberPrice = parseFloat(pa.purchase_cost || '0') || 0;
      }
    } catch {
      // Pricing endpoint may not be available — continue without
    }
  }

  // Fallback to cache prices if API is offline
  // Force-coerce Prisma Decimal / string / object to plain number
  if (!retailPrice && attributes.price) {
    retailPrice = parseFloat(String(attributes.price)) || 0;
  }
  if (!jobberPrice && attributes.purchase_cost) {
    jobberPrice = parseFloat(String(attributes.purchase_cost)) || 0;
  }

  // Extract total weight in metric grams (Turn14 weight is in pounds)
  let totalGrams = 0;
  if (Array.isArray(attributes.dimensions)) {
    for (const d of attributes.dimensions) {
      if (d.weight) totalGrams += Math.round(parseFloat(String(d.weight)) * 453.592);
    }
  }

  // Check if product already exists by slug
  const existingProduct = await prisma.shopProduct.findFirst({
    where: {
      OR: [
        { slug },
        { sku }
      ]
    },
    include: { variants: true, media: true }
  });

  if (existingProduct) {
    // === UPDATE existing product ===
    const updates: any = {
      isPublished: true,
      status: 'ACTIVE'
    };
    // ALWAYS overwrite price if we have a valid one (fixes 0-price hydration bug)
    if (retailPrice > 0) {
      updates.priceUsd = retailPrice;
      updates.priceEur = roundMoney(retailPrice * USD_TO_EUR);
      updates.priceUah = roundMoney(retailPrice * USD_TO_UAH);
    }
    if (existingProduct.titleEn === 'Auto Part' && productName && productName !== 'Auto Part') {
      updates.titleEn = productName;
      updates.titleUa = productName; // Auto-migrate placeholder title
    }
    if (sanitizedDescriptionHtml && !existingProduct.longDescEn) {
      updates.longDescEn = sanitizedDescriptionHtml;
      updates.longDescUa = sanitizedDescriptionHtml;
      updates.bodyHtmlEn = sanitizedDescriptionHtml;
      updates.bodyHtmlUa = sanitizedDescriptionHtml;
    }
    if (thumbnail && !existingProduct.image) {
      updates.image = thumbnail;
    }

    if (Object.keys(updates).length > 0) {
      await prisma.shopProduct.update({
        where: { id: existingProduct.id },
        data: updates
      });
    }

    // ALWAYS update default variant pricing when we have valid data
    const defaultVariant = existingProduct.variants[0];
    if (defaultVariant && retailPrice > 0) {
      const vUpdates: any = {
        priceUsd: retailPrice,
        priceEur: roundMoney(retailPrice * USD_TO_EUR),
        priceUah: roundMoney(retailPrice * USD_TO_UAH),
      };
      if (jobberPrice > 0) {
        vUpdates.priceUsdB2b = jobberPrice;
        vUpdates.priceEurB2b = roundMoney(jobberPrice * USD_TO_EUR);
        vUpdates.priceUahB2b = roundMoney(jobberPrice * USD_TO_UAH);
      }
      if (totalGrams > 0) {
        vUpdates.grams = totalGrams;
      }
      await prisma.shopProductVariant.update({
        where: { id: defaultVariant.id },
        data: vUpdates
      });
    }

    // Add thumbnail as media if not already present
    if (thumbnail && existingProduct.media.length === 0) {
      await prisma.shopProductMedia.create({
        data: {
          productId: existingProduct.id,
          src: thumbnail,
          altText: productName,
          position: 1,
          mediaType: 'IMAGE'
        }
      });
    }

    return { action: 'updated', id: existingProduct.id, slug };
  }

  // === CREATE new product ===
  const product = await prisma.shopProduct.create({
    data: {
      slug,
      sku,
      brand,
      vendor: 'Turn14',
      scope: 'auto',
      productType: 'Auto Part',
      status: 'ACTIVE',
      isPublished: true,
      titleEn: productName,
      titleUa: productName, // We can auto-translate later
      shortDescEn: descriptionText.substring(0, 250) || null,
      shortDescUa: descriptionText.substring(0, 250) || null,
      longDescEn: sanitizedDescriptionHtml || null,
      longDescUa: sanitizedDescriptionHtml || null,
      bodyHtmlEn: sanitizedDescriptionHtml || null,
      bodyHtmlUa: sanitizedDescriptionHtml || null,
      seoTitleEn: `${brand} ${productName}`.substring(0, 70),
      seoTitleUa: `${brand} ${productName}`.substring(0, 70),
      seoDescriptionEn: descriptionText.substring(0, 160) || null,
      seoDescriptionUa: descriptionText.substring(0, 160) || null,
      image: thumbnail,
      priceUsd: retailPrice > 0 ? retailPrice : null,
      priceEur: retailPrice > 0 ? roundMoney(retailPrice * USD_TO_EUR) : null,
      priceUah: retailPrice > 0 ? roundMoney(retailPrice * USD_TO_UAH) : null,
      tags: ['turn14', brand.toLowerCase()],
      variants: {
        create: [
          {
            title: 'Default',
            sku,
            position: 1,
            isDefault: true,
            priceUsd: retailPrice > 0 ? retailPrice : null,
            priceEur: retailPrice > 0 ? roundMoney(retailPrice * USD_TO_EUR) : null,
            priceUah: retailPrice > 0 ? roundMoney(retailPrice * USD_TO_UAH) : null,
            priceUsdB2b: jobberPrice > 0 ? jobberPrice : null,
            priceEurB2b: jobberPrice > 0 ? roundMoney(jobberPrice * USD_TO_EUR) : null,
            priceUahB2b: jobberPrice > 0 ? roundMoney(jobberPrice * USD_TO_UAH) : null,
            inventoryQty: 0,
            inventoryPolicy: 'CONTINUE',
            requiresShipping: true,
            taxable: true,
            grams: totalGrams > 0 ? totalGrams : null,
          }
        ]
      },
      media: thumbnail ? {
        create: [
          {
            src: thumbnail,
            altText: productName,
            position: 1,
            mediaType: 'IMAGE',
          }
        ]
      } : undefined,
    }
  });

  return { action: 'created', id: product.id, slug };
}

/**
 * Run a full brand sync: find brand → paginate all items → import each one.
 * Returns a summary of what happened.
 */
export async function syncBrandFromTurn14(
  prisma: PrismaClient,
  brandName: string,
  findBrandId: (name: string) => Promise<string | null>,
  fetchByBrand: (brandId: string, page: number) => Promise<{ data: any[]; meta: any }>,
  onProgress?: (msg: string) => void
): Promise<{ total: number; created: number; updated: number; errors: number }> {
  const log = onProgress || console.log;

  log(`[Sync] Looking up brand "${brandName}"...`);
  const brandId = await findBrandId(brandName);
  if (!brandId) {
    throw new Error(`Brand "${brandName}" not found in Turn14 catalog`);
  }
  log(`[Sync] Found brand ID: ${brandId}`);

  let page = 1;
  let total = 0;
  let created = 0;
  let updated = 0;
  let errors = 0;
  let hasMore = true;

  while (hasMore) {
    log(`[Sync] Fetching page ${page}...`);
    const result = await fetchByBrand(brandId, page);
    const items = result.data || [];

    if (items.length === 0) {
      hasMore = false;
      break;
    }

    for (const item of items) {
      total++;
      try {
        const res = await importTurn14ItemToDb(prisma, item, {
          brandOverride: brandName,
          fetchPricing: true
        });
        if (res.action === 'created') created++;
        else updated++;
      } catch (err: any) {
        errors++;
        log(`[Sync] Error importing item ${item.id}: ${err.message}`);
      }
    }

    log(`[Sync] Page ${page} done: ${items.length} items processed (${created} new, ${updated} updated, ${errors} errors)`);

    // Check pagination
    const meta = result.meta;
    const totalPages = meta?.total_pages || meta?.last_page || 1;
    if (page >= totalPages) {
      hasMore = false;
    } else {
      page++;
    }
  }

  log(`[Sync] Complete! Total: ${total}, Created: ${created}, Updated: ${updated}, Errors: ${errors}`);
  return { total, created, updated, errors };
}

function buildSlug(brand: string, sku: string): string {
  const brandPart = brand.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const skuPart = sku.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  return `t14-${brandPart}-${skuPart}`.substring(0, 120);
}
