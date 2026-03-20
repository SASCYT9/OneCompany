/**
 * Server-side shop catalog: DB (ShopProduct) + static fallback.
 * Use for [slug] page and sitemap. When DATABASE_URL is set and migration applied,
 * products from admin appear; otherwise only static catalog is used.
 */
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
import { DEFAULT_SHOP_STORE_KEY } from '@/lib/shopStores';

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
            image: item.componentProduct.image ?? '',
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
    storeKey: row.storeKey,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
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
    b2bCompareAt:
      productB2BCompareAt.eur > 0 || productB2BCompareAt.usd > 0 || productB2BCompareAt.uah > 0
        ? productB2BCompareAt
        : undefined,
    image: row.image ?? primaryVariant?.image ?? galleryFromMedia[0] ?? '',
    gallery: legacyGallery.length ? legacyGallery : galleryFromMedia,
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
        image: variant.image,
        isDefault: variant.isDefault,
        price: moneySet({
          eur: num(variant.priceEur),
          usd: num(variant.priceUsd),
          uah: num(variant.priceUah),
        }),
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

/** All products: from DB (published) then static catalog (by slug, DB wins). */
export async function getShopProductsServer(storeKey = DEFAULT_SHOP_STORE_KEY): Promise<ShopProduct[]> {
  let dbRows: AdminShopProductRecord[] = [];
  try {
    dbRows = await prisma.shopProduct.findMany({
      where: { isPublished: true, storeKey },
      orderBy: { updatedAt: 'desc' },
      include: adminProductInclude,
    });
  } catch {
    // No DB or not migrated — use only static
    return storeKey === DEFAULT_SHOP_STORE_KEY ? [...SHOP_PRODUCTS] : [];
  }

  const bySlug = new Map<string, ShopProduct>();
  dbRows.forEach((row) => bySlug.set(row.slug, mapDbToCatalog(row)));
  if (storeKey === DEFAULT_SHOP_STORE_KEY) {
    SHOP_PRODUCTS.forEach((p) => {
      if (!bySlug.has(p.slug)) bySlug.set(p.slug, p);
    });
  }
  return Array.from(bySlug.values());
}

/** One product by slug: DB first, then static. */
export async function getShopProductBySlugServer(
  slug: string,
  storeKey = DEFAULT_SHOP_STORE_KEY
): Promise<ShopProduct | undefined> {
  try {
    const row = await prisma.shopProduct.findFirst({
      where: { slug, isPublished: true, storeKey },
      include: adminProductInclude,
    });
    if (row) return mapDbToCatalog(row);
  } catch {
    // ignore
  }
  return storeKey === DEFAULT_SHOP_STORE_KEY ? getStaticBySlug(slug) : undefined;
}
