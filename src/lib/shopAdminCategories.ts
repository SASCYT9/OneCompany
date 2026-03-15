import { Prisma, PrismaClient } from '@prisma/client';

export const adminCategoryInclude = {
  parent: {
    select: {
      id: true,
      slug: true,
      titleEn: true,
      titleUa: true,
    },
  },
  children: {
    orderBy: [{ sortOrder: 'asc' }, { titleEn: 'asc' }],
    select: {
      id: true,
      slug: true,
      titleEn: true,
      titleUa: true,
      isPublished: true,
      sortOrder: true,
    },
  },
  products: {
    orderBy: [{ updatedAt: 'desc' }],
    select: {
      id: true,
      slug: true,
      titleEn: true,
      titleUa: true,
      brand: true,
      image: true,
      isPublished: true,
    },
  },
} satisfies Prisma.ShopCategoryInclude;

export const adminCategoryListSelect = {
  id: true,
  slug: true,
  titleUa: true,
  titleEn: true,
  isPublished: true,
  sortOrder: true,
  updatedAt: true,
  parent: {
    select: {
      id: true,
      slug: true,
      titleEn: true,
      titleUa: true,
    },
  },
  _count: {
    select: {
      children: true,
      products: true,
    },
  },
} satisfies Prisma.ShopCategorySelect;

export type AdminShopCategoryRecord = Prisma.ShopCategoryGetPayload<{
  include: typeof adminCategoryInclude;
}>;

export type AdminShopCategoryListRecord = Prisma.ShopCategoryGetPayload<{
  select: typeof adminCategoryListSelect;
}>;

export type AdminShopCategoryPayload = {
  slug: string;
  titleUa: string;
  titleEn: string;
  descriptionUa?: string | null;
  descriptionEn?: string | null;
  parentId?: string | null;
  isPublished: boolean;
  sortOrder: number;
};

function sanitizeSlug(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function stringValue(value: unknown, fallback = ''): string {
  return String(value ?? fallback).trim();
}

function nullableString(value: unknown): string | null {
  const trimmed = stringValue(value);
  return trimmed || null;
}

function boolValue(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'active', 'published'].includes(normalized)) return true;
    if (['false', '0', 'no', 'draft', 'hidden'].includes(normalized)) return false;
  }
  return fallback;
}

function intValue(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function productCategorySeed(product: {
  productCategory: string | null;
  categoryEn: string | null;
  categoryUa: string | null;
}) {
  const titleEn = stringValue(product.productCategory || product.categoryEn);
  const titleUa = stringValue(product.categoryUa || product.productCategory || product.categoryEn);
  const slug = sanitizeSlug(titleEn || titleUa);

  if (!slug || (!titleEn && !titleUa)) {
    return null;
  }

  return {
    slug,
    titleEn: titleEn || titleUa,
    titleUa: titleUa || titleEn,
  };
}

export function normalizeAdminCategoryPayload(input: unknown) {
  const source = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const titleUa = stringValue(source.titleUa || source.title_ua || source.title);
  const titleEn = stringValue(source.titleEn || source.title_en || source.title);
  const slug = sanitizeSlug(source.slug || source.handle || titleEn || titleUa);
  const errors: string[] = [];

  if (!slug) errors.push('slug is required');
  if (!titleUa && !titleEn) errors.push('titleUa or titleEn is required');

  const data: AdminShopCategoryPayload = {
    slug,
    titleUa: titleUa || titleEn,
    titleEn: titleEn || titleUa,
    descriptionUa: nullableString(source.descriptionUa),
    descriptionEn: nullableString(source.descriptionEn),
    parentId: nullableString(source.parentId),
    isPublished: boolValue(source.isPublished, true),
    sortOrder: intValue(source.sortOrder, 0),
  };

  return { data, errors };
}

export function buildAdminCategoryCreateData(data: AdminShopCategoryPayload): Prisma.ShopCategoryCreateInput {
  return {
    slug: data.slug,
    titleUa: data.titleUa,
    titleEn: data.titleEn,
    descriptionUa: data.descriptionUa ?? null,
    descriptionEn: data.descriptionEn ?? null,
    isPublished: data.isPublished,
    sortOrder: data.sortOrder,
    parent: data.parentId ? { connect: { id: data.parentId } } : undefined,
  };
}

export function buildAdminCategoryUpdateData(data: AdminShopCategoryPayload): Prisma.ShopCategoryUpdateInput {
  return {
    slug: data.slug,
    titleUa: data.titleUa,
    titleEn: data.titleEn,
    descriptionUa: data.descriptionUa ?? null,
    descriptionEn: data.descriptionEn ?? null,
    isPublished: data.isPublished,
    sortOrder: data.sortOrder,
    parent: data.parentId ? { connect: { id: data.parentId } } : { disconnect: true },
  };
}

export function serializeAdminCategory(record: AdminShopCategoryRecord) {
  return {
    id: record.id,
    slug: record.slug,
    titleUa: record.titleUa,
    titleEn: record.titleEn,
    descriptionUa: record.descriptionUa,
    descriptionEn: record.descriptionEn,
    parentId: record.parentId,
    parent: record.parent
      ? {
          id: record.parent.id,
          slug: record.parent.slug,
          titleEn: record.parent.titleEn,
          titleUa: record.parent.titleUa,
        }
      : null,
    isPublished: record.isPublished,
    sortOrder: record.sortOrder,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    productsCount: record.products.length,
    products: record.products.map((product) => ({
      id: product.id,
      slug: product.slug,
      titleEn: product.titleEn,
      titleUa: product.titleUa,
      brand: product.brand,
      image: product.image,
      isPublished: product.isPublished,
    })),
    children: record.children.map((child) => ({
      id: child.id,
      slug: child.slug,
      titleEn: child.titleEn,
      titleUa: child.titleUa,
      isPublished: child.isPublished,
      sortOrder: child.sortOrder,
    })),
  };
}

export function serializeAdminCategoryListItem(record: AdminShopCategoryRecord | AdminShopCategoryListRecord) {
  return {
    id: record.id,
    slug: record.slug,
    titleUa: record.titleUa,
    titleEn: record.titleEn,
    isPublished: record.isPublished,
    sortOrder: record.sortOrder,
    parent: record.parent
      ? {
          id: record.parent.id,
          slug: record.parent.slug,
          titleEn: record.parent.titleEn,
          titleUa: record.parent.titleUa,
        }
      : null,
    productsCount: 'products' in record ? record.products.length : record._count.products,
    childrenCount: 'children' in record ? record.children.length : record._count.children,
    updatedAt: record.updatedAt.toISOString(),
  };
}

export async function syncCatalogCategories(prisma: PrismaClient) {
  const existingCategories = await prisma.shopCategory.findMany({
    select: {
      id: true,
      slug: true,
    },
  });
  const existingBySlug = new Map(existingCategories.map((item) => [item.slug, item.id]));
  const products = await prisma.shopProduct.findMany({
    select: {
      id: true,
      productCategory: true,
      categoryEn: true,
      categoryUa: true,
      categoryId: true,
    },
  });

  let created = 0;
  let updated = 0;
  const categoryIdBySlug = new Map(existingBySlug);

  for (const product of products) {
    const seed = productCategorySeed(product);
    if (!seed) {
      continue;
    }

    const previousCategoryId = categoryIdBySlug.get(seed.slug);
    const category = await prisma.shopCategory.upsert({
      where: { slug: seed.slug },
      update: {
        titleEn: seed.titleEn,
        titleUa: seed.titleUa,
        isPublished: true,
      },
      create: {
        slug: seed.slug,
        titleEn: seed.titleEn,
        titleUa: seed.titleUa,
        isPublished: true,
      },
      select: {
        id: true,
      },
    });

    if (previousCategoryId) {
      updated += 1;
    } else {
      created += 1;
    }

    categoryIdBySlug.set(seed.slug, category.id);
  }

  let assigned = 0;

  for (const product of products) {
    const seed = productCategorySeed(product);
    if (!seed) {
      continue;
    }

    const categoryId = categoryIdBySlug.get(seed.slug);
    if (!categoryId || product.categoryId === categoryId) {
      continue;
    }

    await prisma.shopProduct.update({
      where: { id: product.id },
      data: {
        categoryId,
      },
    });
    assigned += 1;
  }

  return {
    created,
    updated,
    assigned,
    totalCategories: categoryIdBySlug.size,
  };
}
