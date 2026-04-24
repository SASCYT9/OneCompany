import type { Prisma, PrismaClient, ShopCatalogStatus } from '@prisma/client';

export type CatalogQualityIssueKey =
  | 'NO_IMAGE'
  | 'NO_UA_TITLE'
  | 'NO_EN_TITLE'
  | 'NO_PRICE'
  | 'INACTIVE_IN_COLLECTION'
  | 'ACTIVE_WITHOUT_STOCK'
  | 'BAD_SEO';

export const CATALOG_QUALITY_ISSUES: Record<CatalogQualityIssueKey, { label: string; description: string }> = {
  NO_IMAGE: {
    label: 'No image',
    description: 'Product has no primary image, media image, or variant image.',
  },
  NO_UA_TITLE: {
    label: 'No UA title',
    description: 'Ukrainian title is missing or too short for storefront use.',
  },
  NO_EN_TITLE: {
    label: 'No EN title',
    description: 'English title is missing or too short for storefront/feed use.',
  },
  NO_PRICE: {
    label: 'No price',
    description: 'Product and variants have no visible B2C price.',
  },
  INACTIVE_IN_COLLECTION: {
    label: 'Inactive in collection',
    description: 'Draft, archived, or unpublished product is still assigned to collections.',
  },
  ACTIVE_WITHOUT_STOCK: {
    label: 'Active without stock',
    description: 'Active product has no stock signal from product state or tracked variants.',
  },
  BAD_SEO: {
    label: 'Bad SEO fields',
    description: 'SEO title or description is missing for UA/EN storefronts.',
  },
};

type ProductForQuality = {
  id: string;
  slug: string;
  sku: string | null;
  brand: string | null;
  vendor: string | null;
  titleUa: string;
  titleEn: string;
  stock: string;
  status: ShopCatalogStatus;
  isPublished: boolean;
  image: string | null;
  seoTitleUa: string | null;
  seoTitleEn: string | null;
  seoDescriptionUa: string | null;
  seoDescriptionEn: string | null;
  priceEur: Prisma.Decimal | null;
  priceUsd: Prisma.Decimal | null;
  priceUah: Prisma.Decimal | null;
  updatedAt: Date;
  media: Array<{ src: string | null }>;
  variants: Array<{
    sku: string | null;
    image: string | null;
    inventoryTracker: string | null;
    inventoryQty: number;
    priceEur: Prisma.Decimal | null;
    priceUsd: Prisma.Decimal | null;
    priceUah: Prisma.Decimal | null;
  }>;
  collections: Array<{
    collection: {
      id: string;
      handle: string;
      titleUa: string;
      titleEn: string;
      isPublished: boolean;
    };
  }>;
};

export type CatalogQualityProduct = {
  id: string;
  slug: string;
  sku: string | null;
  brand: string;
  title: string;
  status: ShopCatalogStatus;
  isPublished: boolean;
  stock: string;
  collections: Array<{ id: string; handle: string; title: string; isPublished: boolean }>;
  issues: CatalogQualityIssueKey[];
  issueCount: number;
  updatedAt: string;
};

export type CatalogQualityReport = {
  score: number;
  totalProducts: number;
  cleanProducts: number;
  issueProducts: number;
  issueCounts: Record<CatalogQualityIssueKey, number>;
  brandScores: Array<{
    brand: string;
    total: number;
    issueProducts: number;
    score: number;
    topIssues: Array<{ key: CatalogQualityIssueKey; count: number }>;
  }>;
  products: CatalogQualityProduct[];
};

function hasText(value: string | null | undefined, min = 2) {
  return String(value ?? '').trim().length >= min;
}

function hasPrice(product: ProductForQuality) {
  if (product.priceEur || product.priceUsd || product.priceUah) {
    return true;
  }
  return product.variants.some((variant) => variant.priceEur || variant.priceUsd || variant.priceUah);
}

function hasImage(product: ProductForQuality) {
  if (hasText(product.image, 6)) {
    return true;
  }
  if (product.media.some((media) => hasText(media.src, 6))) {
    return true;
  }
  return product.variants.some((variant) => hasText(variant.image, 6));
}

function hasStockSignal(product: ProductForQuality) {
  if (product.stock === 'inStock') {
    return true;
  }
  const trackedVariants = product.variants.filter((variant) => variant.inventoryTracker);
  if (!trackedVariants.length) {
    return product.stock === 'preOrder' || product.stock === 'available';
  }
  return trackedVariants.some((variant) => variant.inventoryQty > 0);
}

export function getCatalogQualityIssues(product: ProductForQuality): CatalogQualityIssueKey[] {
  const issues: CatalogQualityIssueKey[] = [];

  if (!hasImage(product)) issues.push('NO_IMAGE');
  if (!hasText(product.titleUa)) issues.push('NO_UA_TITLE');
  if (!hasText(product.titleEn)) issues.push('NO_EN_TITLE');
  if (!hasPrice(product)) issues.push('NO_PRICE');
  if ((product.status !== 'ACTIVE' || !product.isPublished) && product.collections.length > 0) {
    issues.push('INACTIVE_IN_COLLECTION');
  }
  if (product.status === 'ACTIVE' && product.isPublished && !hasStockSignal(product)) {
    issues.push('ACTIVE_WITHOUT_STOCK');
  }
  if (
    !hasText(product.seoTitleUa, 8) ||
    !hasText(product.seoTitleEn, 8) ||
    !hasText(product.seoDescriptionUa, 30) ||
    !hasText(product.seoDescriptionEn, 30)
  ) {
    issues.push('BAD_SEO');
  }

  return issues;
}

export function buildCatalogQualityReport(products: ProductForQuality[]): CatalogQualityReport {
  const issueCounts = Object.keys(CATALOG_QUALITY_ISSUES).reduce(
    (acc, key) => ({ ...acc, [key]: 0 }),
    {} as Record<CatalogQualityIssueKey, number>
  );
  const brandMap = new Map<string, { total: number; issueProducts: number; issues: Record<CatalogQualityIssueKey, number> }>();

  const assessed = products.map((product) => {
    const issues = getCatalogQualityIssues(product);
    const brand = product.brand || product.vendor || 'Unassigned';
    const brandEntry =
      brandMap.get(brand) ||
      {
        total: 0,
        issueProducts: 0,
        issues: Object.keys(CATALOG_QUALITY_ISSUES).reduce(
          (acc, key) => ({ ...acc, [key]: 0 }),
          {} as Record<CatalogQualityIssueKey, number>
        ),
      };

    brandEntry.total += 1;
    if (issues.length) brandEntry.issueProducts += 1;

    for (const issue of issues) {
      issueCounts[issue] += 1;
      brandEntry.issues[issue] += 1;
    }
    brandMap.set(brand, brandEntry);

    return {
      id: product.id,
      slug: product.slug,
      sku: product.sku,
      brand,
      title: product.titleEn || product.titleUa || product.slug,
      status: product.status,
      isPublished: product.isPublished,
      stock: product.stock,
      collections: product.collections.map((entry) => ({
        id: entry.collection.id,
        handle: entry.collection.handle,
        title: entry.collection.titleEn || entry.collection.titleUa,
        isPublished: entry.collection.isPublished,
      })),
      issues,
      issueCount: issues.length,
      updatedAt: product.updatedAt.toISOString(),
    };
  });

  const issueProducts = assessed.filter((product) => product.issueCount > 0).length;
  const cleanProducts = products.length - issueProducts;
  const score = products.length > 0 ? Math.round((cleanProducts / products.length) * 100) : 100;

  return {
    score,
    totalProducts: products.length,
    cleanProducts,
    issueProducts,
    issueCounts,
    brandScores: Array.from(brandMap.entries())
      .map(([brand, entry]) => ({
        brand,
        total: entry.total,
        issueProducts: entry.issueProducts,
        score: entry.total > 0 ? Math.round(((entry.total - entry.issueProducts) / entry.total) * 100) : 100,
        topIssues: Object.entries(entry.issues)
          .map(([key, count]) => ({ key: key as CatalogQualityIssueKey, count }))
          .filter((entry) => entry.count > 0)
          .sort((left, right) => right.count - left.count)
          .slice(0, 3),
      }))
      .sort((left, right) => left.score - right.score || right.issueProducts - left.issueProducts)
      .slice(0, 12),
    products: assessed
      .filter((product) => product.issueCount > 0)
      .sort((left, right) => right.issueCount - left.issueCount || left.brand.localeCompare(right.brand))
      .slice(0, 250),
  };
}

export async function getCatalogQualityReport(prisma: PrismaClient) {
  const products = await prisma.shopProduct.findMany({
    orderBy: [{ updatedAt: 'desc' }],
    select: {
      id: true,
      slug: true,
      sku: true,
      brand: true,
      vendor: true,
      titleUa: true,
      titleEn: true,
      stock: true,
      status: true,
      isPublished: true,
      image: true,
      seoTitleUa: true,
      seoTitleEn: true,
      seoDescriptionUa: true,
      seoDescriptionEn: true,
      priceEur: true,
      priceUsd: true,
      priceUah: true,
      updatedAt: true,
      media: {
        select: { src: true },
        take: 1,
      },
      variants: {
        select: {
          sku: true,
          image: true,
          inventoryTracker: true,
          inventoryQty: true,
          priceEur: true,
          priceUsd: true,
          priceUah: true,
        },
      },
      collections: {
        select: {
          collection: {
            select: {
              id: true,
              handle: true,
              titleUa: true,
              titleEn: true,
              isPublished: true,
            },
          },
        },
      },
    },
  });

  return buildCatalogQualityReport(products);
}
