import { Prisma, PrismaClient, ShopInventoryPolicy } from '@prisma/client';

export const adminVariantSummarySelect = {
  id: true,
  productId: true,
  title: true,
  sku: true,
  position: true,
  inventoryQty: true,
  inventoryPolicy: true,
  inventoryTracker: true,
  fulfillmentService: true,
  inventoryLevels: {
    include: { location: true },
  },
  priceEur: true,
  priceUsd: true,
  priceUah: true,
  priceEurB2b: true,
  priceUsdB2b: true,
  priceUahB2b: true,
  compareAtEur: true,
  compareAtUsd: true,
  compareAtUah: true,
  compareAtEurB2b: true,
  compareAtUsdB2b: true,
  compareAtUahB2b: true,
  image: true,
  isDefault: true,
  updatedAt: true,
  product: {
    select: {
      id: true,
      slug: true,
      titleUa: true,
      titleEn: true,
      brand: true,
      vendor: true,
      scope: true,
      status: true,
      isPublished: true,
      stock: true,
      collections: {
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        select: {
          collectionId: true,
          collection: {
            select: {
              id: true,
              handle: true,
              titleUa: true,
              titleEn: true,
              isUrban: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.ShopProductVariantSelect;

export type AdminShopVariantSummaryRecord = Prisma.ShopProductVariantGetPayload<{
  select: typeof adminVariantSummarySelect;
}>;

export type AdminInventoryPatchInput = {
  variantIds: string[];
  inventoryQty?: number | null;
  inventoryAdjustment?: number | null;
  inventoryPolicy?: ShopInventoryPolicy | null;
  inventoryTracker?: string | null;
  fulfillmentService?: string | null;
};

export type AdminPricingPatchInput = {
  variantIds: string[];
  priceEur?: number | null;
  priceUsd?: number | null;
  priceUah?: number | null;
  priceEurB2b?: number | null;
  priceUsdB2b?: number | null;
  priceUahB2b?: number | null;
  compareAtEur?: number | null;
  compareAtUsd?: number | null;
  compareAtUah?: number | null;
  compareAtEurB2b?: number | null;
  compareAtUsdB2b?: number | null;
  compareAtUahB2b?: number | null;
  /** Множник поточної ціни (наприклад 1.1 = +10%). Застосовується до обраних варіантів, якщо не задано абсолютне значення. */
  multiplyUah?: number | null;
  multiplyEur?: number | null;
  multiplyUsd?: number | null;
  multiplyEurB2b?: number | null;
  multiplyUsdB2b?: number | null;
  multiplyUahB2b?: number | null;
};

function decimalToNumber(value: Prisma.Decimal | number | null | undefined): number | null {
  if (value == null) return null;
  return Number(value);
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

export function serializeAdminVariantSummary(record: AdminShopVariantSummaryRecord) {
  return {
    id: record.id,
    productId: record.productId,
    title: record.title,
    sku: record.sku,
    position: record.position,
    inventoryQty: record.inventoryQty,
    inventoryPolicy: record.inventoryPolicy,
    inventoryTracker: record.inventoryTracker,
    fulfillmentService: record.fulfillmentService,
    inventoryLevels: record.inventoryLevels.map(level => ({
      id: level.id,
      locationId: level.locationId,
      locationName: level.location.name,
      locationCode: level.location.code,
      stockedQuantity: level.stockedQuantity,
      reservedQuantity: level.reservedQuantity,
      incomingQuantity: level.incomingQuantity,
    })),
    priceEur: decimalToNumber(record.priceEur),
    priceUsd: decimalToNumber(record.priceUsd),
    priceUah: decimalToNumber(record.priceUah),
    priceEurB2b: decimalToNumber(record.priceEurB2b),
    priceUsdB2b: decimalToNumber(record.priceUsdB2b),
    priceUahB2b: decimalToNumber(record.priceUahB2b),
    compareAtEur: decimalToNumber(record.compareAtEur),
    compareAtUsd: decimalToNumber(record.compareAtUsd),
    compareAtUah: decimalToNumber(record.compareAtUah),
    compareAtEurB2b: decimalToNumber(record.compareAtEurB2b),
    compareAtUsdB2b: decimalToNumber(record.compareAtUsdB2b),
    compareAtUahB2b: decimalToNumber(record.compareAtUahB2b),
    image: record.image,
    isDefault: record.isDefault,
    updatedAt: record.updatedAt.toISOString(),
    product: {
      id: record.product.id,
      slug: record.product.slug,
      titleUa: record.product.titleUa,
      titleEn: record.product.titleEn,
      brand: record.product.brand,
      vendor: record.product.vendor,
      scope: record.product.scope,
      status: record.product.status,
      isPublished: record.product.isPublished,
      stock: record.product.stock,
      collectionIds: record.product.collections.map((entry) => entry.collectionId),
      collectionHandles: record.product.collections.map((entry) => entry.collection.handle),
      collections: record.product.collections.map((entry) => ({
        id: entry.collection.id,
        handle: entry.collection.handle,
        titleUa: entry.collection.titleUa,
        titleEn: entry.collection.titleEn,
        isUrban: entry.collection.isUrban,
      })),
    },
  };
}

async function syncProductsFromDefaultVariantPricing(prisma: PrismaClient, productIds: string[]) {
  const ids = uniqueStrings(productIds);
  if (!ids.length) return;

  const defaultVariants = await prisma.shopProductVariant.findMany({
    where: {
      productId: { in: ids },
      isDefault: true,
    },
    select: {
      productId: true,
      priceEur: true,
      priceUsd: true,
      priceUah: true,
      priceEurB2b: true,
      priceUsdB2b: true,
      priceUahB2b: true,
      compareAtEur: true,
      compareAtUsd: true,
      compareAtUah: true,
      compareAtEurB2b: true,
      compareAtUsdB2b: true,
      compareAtUahB2b: true,
    },
  });

  if (!defaultVariants.length) return;

  await prisma.$transaction(
    defaultVariants.map((variant) =>
      prisma.shopProduct.update({
        where: { id: variant.productId },
        data: {
          priceEur: variant.priceEur,
          priceUsd: variant.priceUsd,
          priceUah: variant.priceUah,
          priceEurB2b: variant.priceEurB2b,
          priceUsdB2b: variant.priceUsdB2b,
          priceUahB2b: variant.priceUahB2b,
          compareAtEur: variant.compareAtEur,
          compareAtUsd: variant.compareAtUsd,
          compareAtUah: variant.compareAtUah,
          compareAtEurB2b: variant.compareAtEurB2b,
          compareAtUsdB2b: variant.compareAtUsdB2b,
          compareAtUahB2b: variant.compareAtUahB2b,
        },
      })
    )
  );
}

async function syncProductsFromVariantInventory(prisma: PrismaClient, productIds: string[]) {
  const ids = uniqueStrings(productIds);
  if (!ids.length) return;

  const variants = await prisma.shopProductVariant.findMany({
    where: {
      productId: { in: ids },
    },
    select: {
      productId: true,
      inventoryQty: true,
    },
  });

  const byProduct = new Map<string, boolean>();
  for (const id of ids) {
    byProduct.set(id, false);
  }
  for (const variant of variants) {
    if (variant.inventoryQty > 0) {
      byProduct.set(variant.productId, true);
    }
  }

  await prisma.$transaction(
    ids.map((productId) =>
      prisma.shopProduct.update({
        where: { id: productId },
        data: {
          stock: byProduct.get(productId) ? 'inStock' : 'preOrder',
        },
      })
    )
  );
}

export async function applyAdminInventoryPatch(prisma: PrismaClient, input: AdminInventoryPatchInput & { locationId?: string }) {
  const variantIds = uniqueStrings(input.variantIds);
  if (!variantIds.length) {
    return { updatedCount: 0, productIds: [] as string[] };
  }

  const variants = await prisma.shopProductVariant.findMany({
    where: { id: { in: variantIds } },
    select: {
      id: true,
      productId: true,
      inventoryQty: true,
    },
  });

  if (!variants.length) {
    return { updatedCount: 0, productIds: [] as string[] };
  }

  // Update legacy fields for backwards compatibility (for now)
  await prisma.$transaction(
    variants.map((variant) =>
      prisma.shopProductVariant.update({
        where: { id: variant.id },
        data: {
          inventoryQty:
            input.inventoryQty != null
              ? input.inventoryQty
              : input.inventoryAdjustment != null
                ? variant.inventoryQty + input.inventoryAdjustment
                : undefined,
          inventoryPolicy: input.inventoryPolicy ?? undefined,
          inventoryTracker:
            input.inventoryTracker !== undefined ? input.inventoryTracker : undefined,
          fulfillmentService:
            input.fulfillmentService !== undefined ? input.fulfillmentService : undefined,
        },
      })
    )
  );

  // If a location is specified, heavily modify the Warehouse inventory metrics
  if (input.locationId && (input.inventoryQty != null || input.inventoryAdjustment != null)) {
    // 1. Fetch current levels for that location
    const currentLevels = await prisma.shopInventoryLevel.findMany({
      where: {
        variantId: { in: variantIds },
        locationId: input.locationId,
      }
    });
    const levelMap = new Map(currentLevels.map(lvl => [`${lvl.variantId}_${lvl.locationId}`, lvl.stockedQuantity]));

    const upserts = variants.map(variant => {
      const variantQty = typeof variant.inventoryQty === 'number' ? variant.inventoryQty : Number(variant.inventoryQty || 0);
      const existingQuantity = typeof levelMap.get(`${variant.id}_${input.locationId}`) === 'number' ? levelMap.get(`${variant.id}_${input.locationId}`) as number : 0;
      
      const targetQuantity = input.inventoryQty != null
        ? input.inventoryQty 
        : existingQuantity + (input.inventoryAdjustment || 0);

      return prisma.shopInventoryLevel.upsert({
        where: {
          variantId_locationId: {
            variantId: variant.id,
            locationId: input.locationId as string
          }
        },
        create: {
          variantId: variant.id,
          locationId: input.locationId as string,
          stockedQuantity: targetQuantity
        },
        update: {
          stockedQuantity: targetQuantity
        }
      });
    });

    await prisma.$transaction(upserts);
  }

  const productIds = uniqueStrings(variants.map((variant) => variant.productId));
  await syncProductsFromVariantInventory(prisma, productIds);

  return {
    updatedCount: variants.length,
    productIds,
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export async function applyAdminPricingPatch(prisma: PrismaClient, input: AdminPricingPatchInput) {
  const variantIds = uniqueStrings(input.variantIds);
  if (!variantIds.length) {
    return { updatedCount: 0, productIds: [] as string[] };
  }

  const hasMultiplier =
    input.multiplyUah != null ||
    input.multiplyEur != null ||
    input.multiplyUsd != null ||
    input.multiplyEurB2b != null ||
    input.multiplyUsdB2b != null ||
    input.multiplyUahB2b != null;

  const variants = await prisma.shopProductVariant.findMany({
    where: { id: { in: variantIds } },
    select: {
      id: true,
      productId: true,
      priceEur: true,
      priceUsd: true,
      priceUah: true,
      priceEurB2b: true,
      priceUsdB2b: true,
      priceUahB2b: true,
      compareAtEur: true,
      compareAtUsd: true,
      compareAtUah: true,
      compareAtEurB2b: true,
      compareAtUsdB2b: true,
      compareAtUahB2b: true,
    },
  });

  if (!variants.length) {
    return { updatedCount: 0, productIds: [] as string[] };
  }

  await prisma.$transaction(
    variants.map((variant) => {
      const current = {
        priceEur: decimalToNumber(variant.priceEur),
        priceUsd: decimalToNumber(variant.priceUsd),
        priceUah: decimalToNumber(variant.priceUah),
        priceEurB2b: decimalToNumber(variant.priceEurB2b),
        priceUsdB2b: decimalToNumber(variant.priceUsdB2b),
        priceUahB2b: decimalToNumber(variant.priceUahB2b),
        compareAtEur: decimalToNumber(variant.compareAtEur),
        compareAtUsd: decimalToNumber(variant.compareAtUsd),
        compareAtUah: decimalToNumber(variant.compareAtUah),
        compareAtEurB2b: decimalToNumber(variant.compareAtEurB2b),
        compareAtUsdB2b: decimalToNumber(variant.compareAtUsdB2b),
        compareAtUahB2b: decimalToNumber(variant.compareAtUahB2b),
      };
      const data: Prisma.ShopProductVariantUpdateInput = {
        priceEur:
          input.priceEur !== undefined
            ? input.priceEur
            : hasMultiplier && input.multiplyEur != null && current.priceEur != null
              ? round2(current.priceEur * input.multiplyEur)
              : undefined,
        priceUsd:
          input.priceUsd !== undefined
            ? input.priceUsd
            : hasMultiplier && input.multiplyUsd != null && current.priceUsd != null
              ? round2(current.priceUsd * input.multiplyUsd)
              : undefined,
        priceUah:
          input.priceUah !== undefined
            ? input.priceUah
            : hasMultiplier && input.multiplyUah != null && current.priceUah != null
              ? round2(current.priceUah * input.multiplyUah)
              : undefined,
        priceEurB2b:
          input.priceEurB2b !== undefined
            ? input.priceEurB2b
            : hasMultiplier && input.multiplyEurB2b != null && current.priceEurB2b != null
              ? round2(current.priceEurB2b * input.multiplyEurB2b)
              : undefined,
        priceUsdB2b:
          input.priceUsdB2b !== undefined
            ? input.priceUsdB2b
            : hasMultiplier && input.multiplyUsdB2b != null && current.priceUsdB2b != null
              ? round2(current.priceUsdB2b * input.multiplyUsdB2b)
              : undefined,
        priceUahB2b:
          input.priceUahB2b !== undefined
            ? input.priceUahB2b
            : hasMultiplier && input.multiplyUahB2b != null && current.priceUahB2b != null
              ? round2(current.priceUahB2b * input.multiplyUahB2b)
              : undefined,
        compareAtEur: input.compareAtEur !== undefined ? input.compareAtEur : undefined,
        compareAtUsd: input.compareAtUsd !== undefined ? input.compareAtUsd : undefined,
        compareAtUah: input.compareAtUah !== undefined ? input.compareAtUah : undefined,
        compareAtEurB2b: input.compareAtEurB2b !== undefined ? input.compareAtEurB2b : undefined,
        compareAtUsdB2b: input.compareAtUsdB2b !== undefined ? input.compareAtUsdB2b : undefined,
        compareAtUahB2b: input.compareAtUahB2b !== undefined ? input.compareAtUahB2b : undefined,
      };
      return prisma.shopProductVariant.update({
        where: { id: variant.id },
        data,
      });
    })
  );

  const productIds = uniqueStrings(variants.map((variant) => variant.productId));
  await syncProductsFromDefaultVariantPricing(prisma, productIds);

  return {
    updatedCount: variants.length,
    productIds,
  };
}
