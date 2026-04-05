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
import { resolveBundleInventory } from '@/lib/shopBundles';
import { prisma } from '@/lib/prisma';
import { resolveUrbanThemeAssetUrl } from '@/lib/urbanThemeAssets';

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
            image: resolveUrbanThemeAssetUrl(item.componentProduct.image ?? ''),
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
      en: row.categoryEn ?? row.category?.titleEn ?? '',
    },
    shortDescription: { ua: row.shortDescUa ?? '', en: row.shortDescEn ?? '' },
    longDescription: {
      ua: row.longDescUa ?? row.bodyHtmlUa ?? '',
      en: row.longDescEn ?? row.bodyHtmlEn ?? '',
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
    image: resolveUrbanThemeAssetUrl(row.image ?? primaryVariant?.image ?? galleryFromMedia[0] ?? ''),
    gallery: (legacyGallery.length ? legacyGallery : galleryFromMedia).map((url) => resolveUrbanThemeAssetUrl(url)),
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
        image: variant.image ? resolveUrbanThemeAssetUrl(variant.image) : null,
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

let globalProductsCache: ShopProduct[] | null = null;
let lastCacheTime = 0;

/** All products: from DB (published) then static catalog (by slug, DB wins). */
export async function getShopProductsServer(): Promise<ShopProduct[]> {
  const now = Date.now();
  // Memory cache for 45 seconds (prevents Vercel OOM during heavy static build)
  if (globalProductsCache && (now - lastCacheTime < 45000)) {
    return globalProductsCache;
  }

  // File cache for local development to prevent massive Supabase egress
  const isDev = process.env.NODE_ENV === 'development';
  const cachePath = isDev ? path.join(process.cwd(), '.shop-products-dev-cache.json') : '';
  
  if (isDev && fs.existsSync(cachePath)) {
    try {
      const stat = fs.statSync(cachePath);
      // Use file cache if it's less than 3 hours old
      if (now - stat.mtimeMs < 1000 * 60 * 60 * 3) {
        const fileContent = fs.readFileSync(cachePath, 'utf8');
        globalProductsCache = JSON.parse(fileContent);
        lastCacheTime = stat.mtimeMs;
        return globalProductsCache as ShopProduct[];
      }
    } catch {
      // ignore parse errors and fetch fresh
    }
  }

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

  const bySlug = new Map<string, ShopProduct>();
  dbRows.forEach((row) => bySlug.set(row.slug, mapDbToCatalog(row)));
  SHOP_PRODUCTS.forEach((p) => {
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
