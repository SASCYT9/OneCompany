import test from 'node:test';
import assert from 'node:assert/strict';
import type { Prisma } from '@prisma/client';
import {
  applyUrbanGpPortalSnapshot,
  type PreparedUrbanGpPortalProduct,
} from '../../../src/lib/urbanGpPortalSync';

function createMockPrisma() {
  const state = {
    archivedCount: 0,
    upserts: [] as Array<{ slug: string; create: Prisma.ShopProductCreateInput; update: Prisma.ShopProductUpdateInput }>,
    collectionUpserts: [] as string[],
    backupCalls: 0,
    updateManyArgs: [] as Array<Record<string, unknown>>,
    transactionOptions: null as Record<string, unknown> | null,
  };

  const tx = {
    shopCollection: {
      upsert: async ({ where }: { where: { handle: string } }) => {
        state.collectionUpserts.push(where.handle);
        return {
          id: `collection-${where.handle}`,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      },
    },
    shopProduct: {
      updateMany: async (args: Record<string, unknown>) => {
        state.updateManyArgs.push(args);
        state.archivedCount += 1;
        return { count: 5 };
      },
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: { slug: string };
        create: Prisma.ShopProductCreateInput;
        update: Prisma.ShopProductUpdateInput;
      }) => {
        state.upserts.push({ slug: where.slug, create, update });
        return { id: `product-${where.slug}`, slug: where.slug };
      },
    },
  };

  return {
    state,
    shopProduct: {
      findMany: async () => [
        {
          id: 'legacy-1',
          slug: 'legacy-urban-product',
          titleEn: 'Legacy',
        },
      ],
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: { slug: string };
        create: Prisma.ShopProductCreateInput;
        update: Prisma.ShopProductUpdateInput;
      }) => {
        state.upserts.push({ slug: where.slug, create, update });
        return { id: `product-${where.slug}`, slug: where.slug };
      },
    },
    $transaction: async <T>(
      callback: (client: typeof tx) => Promise<T>,
      options?: Record<string, unknown>
    ) => {
      state.transactionOptions = options ?? null;
      return callback(tx);
    },
  };
}

function buildPreparedItem(overrides: Partial<PreparedUrbanGpPortalProduct> = {}): PreparedUrbanGpPortalProduct {
  return {
    slug: 'urb-spo-25353093-v1',
    sku: 'URB-SPO-25353093-V1',
    title: 'Defender L663 90/110/130/OCTA URBAN Rear Spoiler',
    titleUa: 'Defender L663 90/110/130/OCTA URBAN Rear Spoiler',
    titleEn: 'Defender L663 90/110/130/OCTA URBAN Rear Spoiler',
    descriptionHtml: '<p>Rear spoiler.</p>',
    descriptionText: 'Rear spoiler.',
    vehicleBrand: 'Land Rover',
    brand: 'Land Rover',
    vendor: 'Urban Automotive',
    manufacturer: 'Urban Automotive',
    productType: 'Spoilers',
    exactCategory: 'Spoilers',
    family: 'exterior',
    tags: ['Defender', 'L663'],
    stock: 'inStock',
    image: 'https://cdn.shopify.com/s/files/spoiler.jpg?v=1',
    gallery: ['https://cdn.shopify.com/s/files/spoiler.jpg?v=1'],
    vehicleModelHandles: ['land-rover-defender-110'],
    collectionHandles: ['land-rover-defender-110'],
    primaryModelHandle: 'land-rover-defender-110',
    collectionLabel: 'Defender 110',
    priceEur: 1170,
    priceUsd: 1287,
    priceUah: 52650,
    compareAtEur: 1200,
    compareAtUsd: 1320,
    compareAtUah: 54000,
    variants: [
      {
        title: 'Default Title',
        sku: 'URB-SPO-25353093-V1',
        position: 1,
        option1Value: null,
        option1LinkedTo: null,
        option2Value: null,
        option2LinkedTo: null,
        option3Value: null,
        option3LinkedTo: null,
        grams: null,
        inventoryTracker: null,
        inventoryQty: 3,
        inventoryPolicy: 'DENY',
        fulfillmentService: 'manual',
        priceEur: 1170,
        priceUsd: 1287,
        priceUah: 52650,
        compareAtEur: 1200,
        compareAtUsd: 1320,
        compareAtUah: 54000,
        requiresShipping: true,
        taxable: true,
        barcode: null,
        image: 'https://cdn.shopify.com/s/files/spoiler.jpg?v=1',
        weightUnit: null,
        taxCode: null,
        costPerItem: null,
        isDefault: true,
      },
    ],
    options: [],
    media: [
      {
        src: 'https://cdn.shopify.com/s/files/spoiler.jpg?v=1',
        altText: 'Defender L663 90/110/130/OCTA URBAN Rear Spoiler',
        position: 1,
        mediaType: 'IMAGE',
      },
    ],
    sourceHandle: 'urb-spo-25353093-v1',
    sourceVendor: 'Urban',
    sourceType: 'Spoilers',
    sourceTags: ['Defender', 'L663'],
    sourcePriceEur: 975,
    sourceCompareAtEur: 1000,
    fallbackImageUsed: false,
    categoryUa: 'Спойлери',
    ...overrides,
  };
}

test('applyUrbanGpPortalSnapshot dry-run does not mutate catalog state', async () => {
  const prisma = createMockPrisma();

  const result = await applyUrbanGpPortalSnapshot(prisma as never, {
    items: [buildPreparedItem()],
    blockers: [],
    commit: false,
    backupCurrentCatalog: async () => {
      prisma.state.backupCalls += 1;
      return 'ignored.json';
    },
  });

  assert.equal(result.committed, false);
  assert.equal(prisma.state.backupCalls, 0);
  assert.equal(prisma.state.archivedCount, 0);
  assert.equal(prisma.state.upserts.length, 0);
});

test('applyUrbanGpPortalSnapshot archives existing Urban products and upserts incoming snapshot on commit', async () => {
  const prisma = createMockPrisma();

  const result = await applyUrbanGpPortalSnapshot(prisma as never, {
    items: [buildPreparedItem()],
    blockers: [],
    commit: true,
    backupCurrentCatalog: async () => {
      prisma.state.backupCalls += 1;
      return 'backup.json';
    },
  });

  assert.equal(result.committed, true);
  assert.equal(result.backupPath, 'backup.json');
  assert.equal(prisma.state.backupCalls, 1);
  assert.equal(prisma.state.archivedCount, 1);
  assert.equal(prisma.state.upserts.length, 1);
  assert.equal(prisma.state.upserts[0]?.slug, 'urb-spo-25353093-v1');
  assert.equal(prisma.state.collectionUpserts.includes('land-rover-defender-110'), true);
  assert.equal(
    JSON.stringify(prisma.state.updateManyArgs[0] ?? {}).includes('urban_sync_source'),
    true
  );
  assert.equal(Number(prisma.state.transactionOptions?.timeout ?? 0) >= 120000, true);
  assert.equal(
    JSON.stringify(prisma.state.upserts[0]?.create ?? {}).includes('vehicle_brand'),
    true
  );
});

test('applyUrbanGpPortalSnapshot refuses commit when blockers are present', async () => {
  const prisma = createMockPrisma();

  await assert.rejects(
    applyUrbanGpPortalSnapshot(prisma as never, {
      items: [buildPreparedItem()],
      blockers: [{ handle: 'urb-mystery-1', title: 'Mystery', reason: 'no urban collection match' }],
      commit: true,
      backupCurrentCatalog: async () => {
        prisma.state.backupCalls += 1;
        return 'backup.json';
      },
    }),
    /blockers/i
  );

  assert.equal(prisma.state.backupCalls, 0);
  assert.equal(prisma.state.archivedCount, 0);
  assert.equal(prisma.state.upserts.length, 0);
});
