import { PrismaClient } from '@prisma/client';
import { fetchTurn14ItemPricing } from './turn14';

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
        retailPrice = parseFloat(pa.retail || pa.list || '0') || 0;
        jobberPrice = parseFloat(pa.jobber || pa.dealer || '0') || 0;
      }
    } catch {
      // Pricing endpoint may not be available — continue without
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
    const updates: any = {};
    if (retailPrice > 0 && !existingProduct.priceUsd) {
      updates.priceUsd = retailPrice;
    }
    if (description && !existingProduct.longDescEn) {
      updates.longDescEn = description;
      updates.longDescUa = description;
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

    // Update default variant pricing if not set
    const defaultVariant = existingProduct.variants[0];
    if (defaultVariant && retailPrice > 0) {
      const vUpdates: any = {};
      if (!defaultVariant.priceUsd) vUpdates.priceUsd = retailPrice;
      if (!defaultVariant.priceUsdB2b && jobberPrice > 0) vUpdates.priceUsdB2b = jobberPrice;
      if (Object.keys(vUpdates).length > 0) {
        await prisma.shopProductVariant.update({
          where: { id: defaultVariant.id },
          data: vUpdates
        });
      }
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
      status: 'DRAFT',
      isPublished: false,
      titleEn: productName,
      titleUa: productName, // We can auto-translate later
      shortDescEn: description.substring(0, 250) || null,
      shortDescUa: description.substring(0, 250) || null,
      longDescEn: description || null,
      longDescUa: description || null,
      seoTitleEn: `${brand} ${productName}`.substring(0, 70),
      seoTitleUa: `${brand} ${productName}`.substring(0, 70),
      seoDescriptionEn: description.substring(0, 160) || null,
      seoDescriptionUa: description.substring(0, 160) || null,
      image: thumbnail,
      priceUsd: retailPrice > 0 ? retailPrice : null,
      tags: ['turn14', brand.toLowerCase()],
      variants: {
        create: [
          {
            title: 'Default',
            sku,
            position: 1,
            isDefault: true,
            priceUsd: retailPrice > 0 ? retailPrice : null,
            priceUsdB2b: jobberPrice > 0 ? jobberPrice : null,
            inventoryQty: 0,
            inventoryPolicy: 'CONTINUE',
            requiresShipping: true,
            taxable: true,
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
