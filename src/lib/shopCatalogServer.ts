/**
 * Server-side shop catalog: DB (ShopProduct) + static fallback.
 * Use for [slug] page and sitemap. When DATABASE_URL is set and migration applied,
 * products from admin appear; otherwise only static catalog is used.
 */

import fs from 'fs';
import path from 'path';

import {
  SHOP_PRODUCTS,
  getShopProductBySlug as getStaticBySlug,
  type ShopMoneySet,
  type ShopProduct,
  type ShopScope,
  type ShopStock,
} from '@/lib/shopCatalog';
import {
  adminProductInclude,
  type AdminShopProductRecord,
} from '@/lib/shopAdminCatalog';
import {
  isLikelyBrabusOverviewProductLike,
  scoreBrabusProductCandidateLike,
} from '@/lib/brabusCatalogCleanup';
import { isBrabusLocalImage, resolveBrabusFallbackImage } from '@/lib/brabusImageFallbacks';
import { resolveBundleInventory } from '@/lib/shopBundles';
import { prisma } from '@/lib/prisma';
import { sanitizeRichTextHtml } from '@/lib/sanitizeRichTextHtml';
import { resolveUrbanThemeAssetUrl } from '@/lib/urbanThemeAssets';
import { resolveEnglishCategory } from '@/lib/shopCategoryTranslation';
import {
  buildUrbanGpSafeFallbackDescription,
  isUnsafeUrbanGpDescription,
} from '@/lib/urbanGpDescriptionFallback';

const BRABUS_LOCAL_ASSETS_DEPLOYED = process.env.BRABUS_LOCAL_ASSETS_DEPLOYED === '1';
const shouldUseDeployedBrabusFallback =
  process.env.NODE_ENV === 'production' && !BRABUS_LOCAL_ASSETS_DEPLOYED;
const FEED_MANAGED_BRANDS = new Set(['ADRO', 'AKRAPOVIC', 'CSF', 'OHLINS']);
const BRAND_FALLBACK_IMAGES: Record<string, string> = {
  ADRO: '/images/shop/adro/adro-hero-m4.jpg',
  AKRAPOVIC: '/images/shop/akrapovic/factory-fallback.jpg',
  CSF: '/images/shop/csf/factory-fallback.jpg',
  OHLINS: '/images/shop/ohlins/factory-fallback.jpg',
};

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => String(value ?? '').trim()).filter(Boolean)));
}

function normalizeBrandImageKey(value: string | null | undefined) {
  return String(value ?? '').trim().toUpperCase();
}

function hasCatalogPrice(
  product: Pick<ShopProduct, 'price'> | Pick<AdminShopProductRecord, 'priceEur' | 'priceUsd' | 'priceUah'>
) {
  if ('price' in product) {
    return [product.price.eur, product.price.usd, product.price.uah].some((value) => Number(value) > 0);
  }

  return [product.priceEur, product.priceUsd, product.priceUah].some((value) => Number(value) > 0);
}

function isFeedManagedBrandValue(value: string | null | undefined) {
  return FEED_MANAGED_BRANDS.has(normalizeBrandImageKey(value));
}

function isFeedManagedCatalogProduct(product: Pick<ShopProduct, 'brand' | 'vendor'>) {
  return isFeedManagedBrandValue(product.brand) || isFeedManagedBrandValue(product.vendor);
}

function resolveBrandFallbackImage(brand: string | null | undefined, vendor?: string | null) {
  return (
    BRAND_FALLBACK_IMAGES[normalizeBrandImageKey(brand)] ??
    BRAND_FALLBACK_IMAGES[normalizeBrandImageKey(vendor)] ??
    undefined
  );
}

function normalizeCatalogAssetInput(input: string | null | undefined) {
  const raw = String(input ?? '').trim();
  if (!raw) {
    return '';
  }

  if (!raw.startsWith('http://') && !raw.startsWith('https://')) {
    return raw;
  }

  try {
    const parsed = new URL(raw);
    parsed.pathname = parsed.pathname.replace(/\/{2,}/g, '/');
    return parsed.toString();
  } catch {
    return raw;
  }
}

function resolveCatalogAssetUrl(input: string | null | undefined, fallbackSrc?: string) {
  const resolved = resolveUrbanThemeAssetUrl(normalizeCatalogAssetInput(input));
  if (!resolved && fallbackSrc) {
    return fallbackSrc;
  }
  if (fallbackSrc && isBrabusLocalImage(resolved) && shouldUseDeployedBrabusFallback) {
    return fallbackSrc;
  }
  return resolved;
}

function moneySet(input: Partial<ShopMoneySet> | null | undefined): ShopMoneySet {
  return {
    eur: Number(input?.eur ?? 0) || 0,
    usd: Number(input?.usd ?? 0) || 0,
    uah: Number(input?.uah ?? 0) || 0,
  };
}

function mapDbToCatalog(row: AdminShopProductRecord): ShopProduct {
  const num = (v: unknown) => (v != null && typeof v === 'number' ? v : v != null ? Number(v) : 0);
  const hl = row.highlights as { ua?: string[]; en?: string[] } | null;
  const highlightsArr = Array.isArray(hl?.ua)
    ? (hl.ua || []).map((text, i) => ({
        ua: text,
        en: hl.en?.[i] ?? text,
      }))
    : [];
  const primaryVariant = row.variants.find((variant) => variant.isDefault) ?? row.variants[0];
  const sortedMedia = [...row.media].sort((a, b) => a.position - b.position);
  const galleryFromMedia = sortedMedia.map((item) => item.src);
  const legacyGallery = Array.isArray(row.gallery) ? row.gallery.filter((item): item is string => typeof item === 'string') : [];
  const rawPrimaryImage = row.image ?? primaryVariant?.image ?? galleryFromMedia[0] ?? '';
  const brandFallbackImage = resolveBrandFallbackImage(row.brand, row.vendor);
  const brabusFallbackImage = resolveBrabusFallbackImage({
    brand: row.brand ?? row.vendor ?? '',
    slug: row.slug,
    sku: row.sku ?? primaryVariant?.sku ?? '',
    tags: row.tags ?? [],
    title: {
      ua: row.titleUa,
      en: row.titleEn,
    },
    collection: {
      ua: row.collectionUa ?? '',
      en: row.collectionEn ?? '',
    },
    image: rawPrimaryImage,
  });
  const catalogFallbackImage = brabusFallbackImage ?? brandFallbackImage;
  const resolvedPrimaryImage = resolveCatalogAssetUrl(rawPrimaryImage, catalogFallbackImage);
  const resolvedGallery = uniqueStrings(
    (legacyGallery.length ? legacyGallery : galleryFromMedia).map((url) =>
      resolveCatalogAssetUrl(url, catalogFallbackImage)
    )
  );
  const productGallery = resolvedGallery.length
    ? resolvedGallery
    : resolvedPrimaryImage
      ? [resolvedPrimaryImage]
      : [];
  const unsafeGpDescription = [
    row.shortDescUa,
    row.shortDescEn,
    row.longDescUa,
    row.longDescEn,
    row.bodyHtmlUa,
    row.bodyHtmlEn,
    row.seoDescriptionUa,
    row.seoDescriptionEn,
  ].some(isUnsafeUrbanGpDescription);
  const safeGpDescription = unsafeGpDescription
    ? buildUrbanGpSafeFallbackDescription({
        slug: row.slug,
        sku: row.sku ?? primaryVariant?.sku ?? '',
        titleUa: row.titleUa,
        titleEn: row.titleEn,
        categoryUa: row.categoryUa ?? row.category?.titleUa ?? '',
        categoryEn: resolveEnglishCategory(row.categoryEn, row.categoryUa) || row.category?.titleEn || '',
        collectionUa: row.collectionUa ?? '',
        collectionEn: row.collectionEn ?? '',
        brand: row.brand,
        vendor: row.vendor,
        productType: row.productType,
      })
    : null;
  const productB2BPrice = moneySet({
    eur: num(row.priceEurB2b ?? primaryVariant?.priceEurB2b),
    usd: num(row.priceUsdB2b ?? primaryVariant?.priceUsdB2b),
    uah: num(row.priceUahB2b ?? primaryVariant?.priceUahB2b),
  });
  const productB2BCompareAt = moneySet({
    eur: num(row.compareAtEurB2b ?? primaryVariant?.compareAtEurB2b),
    usd: num(row.compareAtUsdB2b ?? primaryVariant?.compareAtUsdB2b),
    uah: num(row.compareAtUahB2b ?? primaryVariant?.compareAtUahB2b),
  });
  const bundleInventory = row.bundle
    ? resolveBundleInventory(
        row.bundle.items.map((item) => ({
          id: item.id,
          quantity: item.quantity,
          componentProduct: {
            id: item.componentProduct.id,
            slug: item.componentProduct.slug,
            scope: item.componentProduct.scope === 'moto' ? 'moto' : 'auto',
            brand: item.componentProduct.brand ?? '',
            image: resolveCatalogAssetUrl(item.componentProduct.image ?? ''),
            title: {
              ua: item.componentProduct.titleUa,
              en: item.componentProduct.titleEn,
            },
            collection: {
              ua: item.componentProduct.collectionUa ?? '',
              en: item.componentProduct.collectionEn ?? '',
            },
            collections: item.componentProduct.collections.map((entry) => ({
              id: entry.collection.id,
              handle: entry.collection.handle,
              title: {
                ua: entry.collection.titleUa,
                en: entry.collection.titleEn,
              },
              brand: entry.collection.brand,
              isUrban: entry.collection.isUrban,
              sortOrder: entry.sortOrder,
            })),
            tags: item.componentProduct.tags,
            stock: item.componentProduct.stock,
            defaultVariantInventoryQty:
              item.componentProduct.variants.find((variant) => variant.isDefault)?.inventoryQty ??
              item.componentProduct.variants[0]?.inventoryQty ??
              0,
          },
          componentVariant: item.componentVariant
            ? {
                id: item.componentVariant.id,
                title: item.componentVariant.title,
                inventoryQty: item.componentVariant.inventoryQty,
              }
            : null,
        }))
      )
    : null;

  return {
    id: row.id,
    slug: row.slug,
    sku: row.sku ?? primaryVariant?.sku ?? '',
    scope: row.scope as ShopScope,
    brand: row.brand ?? '',
    vendor: row.vendor ?? undefined,
    productType: row.productType ?? undefined,
    tags: row.tags ?? [],
    collections: row.collections.map((entry) => ({
      id: entry.collection.id,
      handle: entry.collection.handle,
      title: {
        ua: entry.collection.titleUa,
        en: entry.collection.titleEn,
      },
      brand: entry.collection.brand,
      isUrban: entry.collection.isUrban,
      sortOrder: entry.sortOrder,
    })),
    title: { ua: row.titleUa, en: row.titleEn },
    category: {
      ua: row.categoryUa ?? row.category?.titleUa ?? '',
      en: resolveEnglishCategory(row.categoryEn, row.categoryUa) || row.category?.titleEn || '',
    },
    shortDescription: {
      ua: safeGpDescription?.shortDescription.ua ?? row.shortDescUa ?? '',
      en: safeGpDescription?.shortDescription.en ?? row.shortDescEn ?? '',
    },
    longDescription: {
      ua: sanitizeRichTextHtml(safeGpDescription?.bodyHtml.ua ?? row.bodyHtmlUa ?? row.longDescUa ?? ''),
      en: sanitizeRichTextHtml(safeGpDescription?.bodyHtml.en ?? row.bodyHtmlEn ?? row.longDescEn ?? ''),
    },
    leadTime: { ua: row.leadTimeUa ?? '', en: row.leadTimeEn ?? '' },
    stock: (bundleInventory?.stock ?? (row.stock === 'preOrder' ? 'preOrder' : 'inStock')) as ShopStock,
    collection: { ua: row.collectionUa ?? '', en: row.collectionEn ?? '' },
    price: {
      eur: num(row.priceEur ?? primaryVariant?.priceEur),
      usd: num(row.priceUsd ?? primaryVariant?.priceUsd),
      uah: num(row.priceUah ?? primaryVariant?.priceUah),
    },
    b2bPrice:
      productB2BPrice.eur > 0 || productB2BPrice.usd > 0 || productB2BPrice.uah > 0
        ? productB2BPrice
        : undefined,
    compareAt:
      row.compareAtEur != null ||
      row.compareAtUsd != null ||
      row.compareAtUah != null ||
      primaryVariant?.compareAtEur != null ||
      primaryVariant?.compareAtUsd != null ||
      primaryVariant?.compareAtUah != null
        ? {
            eur: num(row.compareAtEur ?? primaryVariant?.compareAtEur),
            usd: num(row.compareAtUsd ?? primaryVariant?.compareAtUsd),
            uah: num(row.compareAtUah ?? primaryVariant?.compareAtUah),
          }
        : undefined,
    weightKg:
      (row as any).weight != null ? Number((row as any).weight) : (primaryVariant as any)?.weight != null ? Number((primaryVariant as any).weight) : null,
    length:
      (row as any).length != null ? Number((row as any).length) : (primaryVariant as any)?.length != null ? Number((primaryVariant as any).length) : null,
    width:
      (row as any).width != null ? Number((row as any).width) : (primaryVariant as any)?.width != null ? Number((primaryVariant as any).width) : null,
    height:
      (row as any).height != null ? Number((row as any).height) : (primaryVariant as any)?.height != null ? Number((primaryVariant as any).height) : null,
    b2bCompareAt:
      productB2BCompareAt.eur > 0 || productB2BCompareAt.usd > 0 || productB2BCompareAt.uah > 0
        ? productB2BCompareAt
        : undefined,
    image: resolvedPrimaryImage,
    gallery: productGallery,
    highlights: highlightsArr,
    variants: row.variants.map((variant) => {
      const variantB2BPrice = moneySet({
        eur: num(variant.priceEurB2b),
        usd: num(variant.priceUsdB2b),
        uah: num(variant.priceUahB2b),
      });
      const variantB2BCompareAt = moneySet({
        eur: num(variant.compareAtEurB2b),
        usd: num(variant.compareAtUsdB2b),
        uah: num(variant.compareAtUahB2b),
      });

      return {
        id: variant.id,
        title: variant.title,
        sku: variant.sku,
        position: variant.position,
        optionValues: [variant.option1Value, variant.option2Value, variant.option3Value].filter(
          (value): value is string => Boolean(value)
        ),
        inventoryQty: variant.inventoryQty,
        image: variant.image ? resolveCatalogAssetUrl(variant.image, brabusFallbackImage) : null,
        isDefault: variant.isDefault,
        price: moneySet({
          eur: num(variant.priceEur),
          usd: num(variant.priceUsd),
          uah: num(variant.priceUah),
        }),
        weightKg: (variant as any).weight != null ? Number((variant as any).weight) : null,
        length: (variant as any).length != null ? Number((variant as any).length) : null,
        width: (variant as any).width != null ? Number((variant as any).width) : null,
        height: (variant as any).height != null ? Number((variant as any).height) : null,
        b2bPrice:
          variantB2BPrice.eur > 0 || variantB2BPrice.usd > 0 || variantB2BPrice.uah > 0
            ? variantB2BPrice
            : undefined,
        compareAt:
          variant.compareAtEur != null || variant.compareAtUsd != null || variant.compareAtUah != null
            ? moneySet({
                eur: num(variant.compareAtEur),
                usd: num(variant.compareAtUsd),
                uah: num(variant.compareAtUah),
              })
            : undefined,
        b2bCompareAt:
          variantB2BCompareAt.eur > 0 || variantB2BCompareAt.usd > 0 || variantB2BCompareAt.uah > 0
            ? variantB2BCompareAt
            : undefined,
      };
    }),
    categoryNode: row.category
      ? {
          id: row.category.id,
          slug: row.category.slug,
          title: {
            ua: row.category.titleUa,
            en: row.category.titleEn,
          },
        }
      : null,
    bundle: row.bundle
      ? {
          id: row.bundle.id,
          availableQuantity: bundleInventory?.availableQuantity ?? 0,
          items: bundleInventory?.items ?? [],
        }
      : null,
  };
}

function normalizeCatalogProducts(products: ShopProduct[]) {
  const normalized: ShopProduct[] = [];
  const brabusBySku = new Map<string, ShopProduct>();

  for (const product of products) {
    if (isFeedManagedCatalogProduct(product) && !hasCatalogPrice(product)) {
      continue;
    }

    if (isLikelyBrabusOverviewProductLike({
      sku: product.sku,
      titleEn: product.title.en,
      priceEur: product.price.eur,
      priceUsd: product.price.usd,
      priceUah: product.price.uah,
    })) {
      continue;
    }

    const isBrabus = product.brand === 'Brabus' || product.vendor === 'Brabus';
    const skuKey = String(product.sku ?? '').trim().toLowerCase();

    if (!isBrabus || !skuKey) {
      normalized.push(product);
      continue;
    }

    const existing = brabusBySku.get(skuKey);
    const candidateScore = scoreBrabusProductCandidateLike({
      sku: product.sku,
      slug: product.slug,
      titleEn: product.title.en,
      titleUa: product.title.ua,
      image: product.image,
      gallery: product.gallery,
      priceEur: product.price.eur,
      priceUsd: product.price.usd,
      priceUah: product.price.uah,
    });
    const existingScore = existing
      ? scoreBrabusProductCandidateLike({
          sku: existing.sku,
          slug: existing.slug,
          titleEn: existing.title.en,
          titleUa: existing.title.ua,
          image: existing.image,
          gallery: existing.gallery,
          priceEur: existing.price.eur,
          priceUsd: existing.price.usd,
          priceUah: existing.price.uah,
        })
      : Number.NEGATIVE_INFINITY;

    if (!existing || candidateScore > existingScore) {
      brabusBySku.set(skuKey, product);
    }
  }

  return [...normalized, ...brabusBySku.values()];
}

let globalProductsCache: ShopProduct[] | null = null;
let lastCacheTime = 0;
let globalProductsPromise: Promise<ShopProduct[]> | null = null;

/** All products: from DB (published) then static catalog (by slug, DB wins). */
export async function getShopProductsServer(): Promise<ShopProduct[]> {
  const now = Date.now();
  // Memory cache for 45 seconds (prevents Vercel OOM during heavy static build)
  if (globalProductsCache && (now - lastCacheTime < 45000)) {
    return globalProductsCache;
  }
  if (globalProductsPromise) {
    return globalProductsPromise;
  }

  // File cache for local development to avoid repeated filesystem checks
  const isDev = process.env.NODE_ENV === 'development';
  const cachePath = isDev ? path.join(process.cwd(), '.shop-products-dev-cache.json') : '';
  
  if (isDev && fs.existsSync(cachePath)) {
    try {
      const stat = fs.statSync(cachePath);
      // Use file cache if it's less than 3 hours old
      if (now - stat.mtimeMs < 1000 * 60 * 60 * 3) {
        const fileContent = fs.readFileSync(cachePath, 'utf8');
        globalProductsCache = normalizeCatalogProducts(JSON.parse(fileContent));
        lastCacheTime = stat.mtimeMs;
        return globalProductsCache as ShopProduct[];
      }
    } catch {
      // ignore parse errors and fetch fresh
    }
  }

  globalProductsPromise = (async () => {
    let dbRows: AdminShopProductRecord[] = [];
    try {
      dbRows = await prisma.shopProduct.findMany({
        where: { isPublished: true },
        orderBy: { updatedAt: 'desc' },
        include: adminProductInclude,
      });
    } catch {
      // No DB or not migrated — use only static
      return [...SHOP_PRODUCTS];
    }

    const dbProducts = normalizeCatalogProducts(dbRows.map((row) => mapDbToCatalog(row)));
    const bySlug = new Map<string, ShopProduct>();
    dbProducts.forEach((product) => bySlug.set(product.slug, product));
    const liveFeedBrands = new Set(
      dbProducts
        .filter((product) => isFeedManagedCatalogProduct(product) && hasCatalogPrice(product))
        .flatMap((product) => [product.brand, product.vendor].map((value) => normalizeBrandImageKey(value)))
        .filter((value) => FEED_MANAGED_BRANDS.has(value))
    );
    SHOP_PRODUCTS.forEach((p) => {
      if (
        isFeedManagedCatalogProduct(p) &&
        [p.brand, p.vendor].some((value) => liveFeedBrands.has(normalizeBrandImageKey(value)))
      ) {
        return;
      }
      if (!bySlug.has(p.slug)) bySlug.set(p.slug, p);
    });

    globalProductsCache = Array.from(bySlug.values());
    lastCacheTime = Date.now();

    if (isDev && cachePath) {
      try {
        fs.writeFileSync(cachePath, JSON.stringify(globalProductsCache), 'utf8');
      } catch {}
    }

    return globalProductsCache;
  })();

  try {
    return await globalProductsPromise;
  } finally {
    globalProductsPromise = null;
  }
}

/** One product by slug: DB first, then static. */
export async function getShopProductBySlugServer(slug: string): Promise<ShopProduct | undefined> {
  try {
    const row = await prisma.shopProduct.findFirst({
      where: { slug, isPublished: true },
      include: adminProductInclude,
    });
    if (row) return mapDbToCatalog(row);
  } catch {
    // ignore
  }
  return getStaticBySlug(slug);
}
