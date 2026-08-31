import test from 'node:test';
import assert from 'node:assert/strict';
import { ShopImportConflictMode } from '@prisma/client';
import { runShopCsvImport } from '../../../src/lib/shopAdminImports';
import type { ShopCsvCatalogWriter } from '../../../src/lib/shopAdminImports';
import {
  buildAdminProductCreateData,
  buildAdminProductImportUpdateData,
} from '../../../src/lib/shopAdminCatalog';

const CSV = [
  [
    'Handle',
    'Title',
    'Body (HTML)',
    'Vendor',
    'Type',
    'Tags',
    'Published',
    'Option1 Name',
    'Option1 Value',
    'Variant SKU',
    'Variant Grams',
    'Variant Inventory Qty',
    'Variant Inventory Policy',
    'Variant Fulfillment Service',
    'Variant Price',
    'Variant Compare At Price',
    'Image Src',
  ].join(','),
  [
    'urban-rear-bumper',
    'Urban Rear Bumper',
    '"<p>Carbon rear bumper</p>"',
    'Urban Automotive',
    'Body Kit',
    '"urban,rear-bumper"',
    'TRUE',
    'Finish',
    'Gloss',
    'URB-RB-001',
    '0',
    '3',
    'deny',
    'manual',
    '35000',
    '36500',
    'https://cdn.example.com/rear-bumper.jpg',
  ].join(','),
].join('\n');

const PARTIAL_CSV = ['Handle,Title', 'urban-rear-bumper,Updated title'].join('\n');
const PARTIAL_VARIANT_CSV = [
  'Handle,Title,Variant SKU,Variant Price',
  'urban-rear-bumper,Updated title,URB-RB-001,36000',
].join('\n');
const PARTIAL_OPTION_CSV = [
  'Handle,Title,Option1 Name,Variant SKU',
  'urban-rear-bumper,Updated title,Surface,URB-RB-001',
].join('\n');

type MockProductRecord = {
  id: string;
  slug: string;
  collections?: Array<{ collectionId: string; sortOrder: number }>;
  media?: Array<{ id: string; src: string; position: number }>;
  options?: Array<{ id: string; name: string; position: number }>;
  variants?: Array<{
    id: string;
    sku: string | null;
    title: string | null;
    position: number;
    option1Value: string | null;
    option2Value: string | null;
    option3Value: string | null;
    isDefault: boolean;
  }>;
  metafields?: Array<{ id: string; namespace: string; key: string }>;
};

function createMockPrisma(existingProduct: MockProductRecord | null) {
  const state = {
    existingProduct: existingProduct
      ? {
          ...existingProduct,
          collections: existingProduct.collections ?? [],
          media: existingProduct.media ?? [],
          options: existingProduct.options ?? [],
          variants: existingProduct.variants ?? [],
          metafields: existingProduct.metafields ?? [],
        }
      : null,
    created: 0,
    updated: 0,
    lastUpdateData: null as Record<string, unknown> | null,
    auditLogs: 0,
    jobs: [] as Array<Record<string, unknown>>,
  };

  return {
    state,
    shopImportTemplate: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        if (where.id !== 'template-1') return null;
        return {
          id: 'template-1',
          name: 'Supplier remap',
          supplierName: 'Urban',
          sourceType: 'shopify_csv',
          notes: null,
          fieldMapping: null,
          defaultConflictMode: ShopImportConflictMode.UPDATE,
        };
      },
    },
    shopImportJob: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const rowErrorsCreate = ((data.rowErrors as { create?: Array<Record<string, unknown>> } | undefined)?.create ?? []).map(
          (rowError, index) => ({
            id: `row-${index + 1}`,
            rowNumber: rowError.rowNumber,
            handle: rowError.handle ?? null,
            message: rowError.message,
            payload: rowError.payload ?? null,
            createdAt: new Date(),
          })
        );
        const job = {
          id: `job-${state.jobs.length + 1}`,
          sourceType: data.sourceType,
          sourceFilename: data.sourceFilename ?? null,
          supplierName: data.supplierName ?? null,
          templateId: data.templateId ?? null,
          template: data.templateId
            ? { id: 'template-1', name: 'Supplier remap', supplierName: 'Urban' }
            : null,
          action: data.action,
          status: data.status,
          conflictMode: data.conflictMode,
          actorEmail: data.actorEmail,
          actorName: data.actorName ?? null,
          totalRows: data.totalRows,
          productsCount: data.productsCount,
          variantsCount: data.variantsCount,
          validProducts: data.validProducts,
          createdCount: data.createdCount ?? 0,
          updatedCount: data.updatedCount ?? 0,
          skippedCount: data.skippedCount ?? 0,
          errorCount: data.errorCount ?? 0,
          columns: data.columns ?? null,
          templateSnapshot: data.templateSnapshot ?? null,
          summary: data.summary ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
          rowErrors: rowErrorsCreate,
        };
        state.jobs.push(job);
        return job;
      },
    },
    shopProduct: {
      findUnique: async () => state.existingProduct,
      update: async ({ data }: { data: Record<string, unknown> }) => {
        state.updated += 1;
        state.lastUpdateData = data;
        return { id: 'product-1', slug: 'urban-rear-bumper' };
      },
      create: async () => {
        state.created += 1;
        return { id: 'product-2', slug: 'urban-rear-bumper' };
      },
    },
    adminUser: {
      findUnique: async () => ({ id: 'admin-1' }),
    },
    adminAuditLog: {
      create: async () => {
        state.auditLogs += 1;
        return { id: `audit-${state.auditLogs}` };
      },
    },
    turn14CatalogItem: {
      findMany: async () => [],
    },
  };
}

const adminSession = {
  email: 'admin@onecompany.local',
  name: 'Admin',
  permissions: ['*'],
} as const;

function catalogResult(productId: string) {
  return {
    productId,
    previousVersion: '0',
    canonicalVersion: '1',
    revisionId: `revision-${productId}`,
    outboxId: `outbox-${productId}`,
    dedupeKey: `product:${productId}:1`,
    projectionTargets: ['CONTENT'] as const,
    contentHash: 'a'.repeat(64),
  };
}

const mockCatalogWriter: ShopCsvCatalogWriter = {
  async update({ prisma, data, existing, relationMask, scalarMask }) {
    await prisma.shopProduct.update({
      where: { id: existing.id },
      data: buildAdminProductImportUpdateData(data, existing, relationMask, scalarMask),
    });
    return catalogResult(existing.id);
  },
  async create({ prisma, data }) {
    const created = await prisma.shopProduct.create({ data: buildAdminProductCreateData(data) });
    return catalogResult(created.id);
  },
};

test('runShopCsvImport respects CREATE conflict mode and records row errors', async () => {
  const prisma = createMockPrisma({ id: 'product-1', slug: 'urban-rear-bumper' });
  const result = await runShopCsvImport(prisma as never, adminSession as never, {
    csvText: CSV,
    action: 'commit',
    conflictMode: 'CREATE',
    sourceFilename: 'urban.csv',
  }, mockCatalogWriter);

  assert.equal(result.created, 0);
  assert.equal(result.updated, 0);
  assert.equal(result.skipped, 0);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0]?.message ?? '', /CREATE-only/i);
  assert.equal(prisma.state.auditLogs, 1);
});

test('runShopCsvImport returns the first catalog publication for a created product', async () => {
  const prisma = createMockPrisma(null);
  const result = await runShopCsvImport(prisma as never, adminSession as never, {
    csvText: CSV,
    action: 'commit',
    conflictMode: 'CREATE',
    sourceFilename: 'new-product.csv',
  }, mockCatalogWriter);

  assert.equal(result.created, 1);
  assert.equal(result.updated, 0);
  assert.equal(prisma.state.created, 1);
  assert.deepEqual(result.catalog, [
    {
      productId: 'product-2',
      version: '1',
      revisionId: 'revision-product-2',
      outboxId: 'outbox-product-2',
      status: 'SAVED',
    },
  ]);
});

test('runShopCsvImport respects SKIP and UPDATE conflict modes', async () => {
  const skipPrisma = createMockPrisma({ id: 'product-1', slug: 'urban-rear-bumper' });
  const skipResult = await runShopCsvImport(skipPrisma as never, adminSession as never, {
    csvText: CSV,
    action: 'commit',
    conflictMode: 'SKIP',
    sourceFilename: 'urban.csv',
  }, mockCatalogWriter);

  assert.equal(skipResult.created, 0);
  assert.equal(skipResult.updated, 0);
  assert.equal(skipResult.skipped, 1);

  const updatePrisma = createMockPrisma({
    id: 'product-1',
    slug: 'urban-rear-bumper',
    media: [
      {
        id: 'media-1',
        src: 'https://cdn.example.com/rear-bumper.jpg',
        position: 1,
      },
    ],
    options: [{ id: 'option-1', name: 'Finish', position: 1 }],
    variants: [
      {
        id: 'variant-1',
        sku: 'URB-RB-001',
        title: 'Gloss',
        position: 1,
        option1Value: 'Gloss',
        option2Value: null,
        option3Value: null,
        isDefault: true,
      },
    ],
  });
  const updateResult = await runShopCsvImport(updatePrisma as never, adminSession as never, {
    csvText: CSV,
    action: 'commit',
    conflictMode: 'UPDATE',
    sourceFilename: 'urban.csv',
    templateId: 'template-1',
  }, mockCatalogWriter);

  assert.equal(updateResult.created, 0);
  assert.equal(updateResult.updated, 1);
  assert.equal(updatePrisma.state.updated, 1);
  assert.equal(updatePrisma.state.auditLogs, 1);

  const updateData = updatePrisma.state.lastUpdateData as {
    media?: {
      update?: Array<{ where: { id: string }; data: Record<string, unknown> }>;
      deleteMany?: unknown;
    };
    options?: { update?: Array<{ where: { id: string } }>; deleteMany?: unknown };
    variants?: {
      update?: Array<{ where: { id: string }; data: Record<string, unknown> }>;
      deleteMany?: unknown;
    };
  };
  assert.equal(updateData.media?.update?.[0]?.where.id, 'media-1');
  assert.equal(updateData.options?.update?.[0]?.where.id, 'option-1');
  assert.equal(updateData.variants?.update?.[0]?.where.id, 'variant-1');
  assert.equal(updateData.media?.deleteMany, undefined);
  assert.equal(updateData.options?.deleteMany, undefined);
  assert.equal(updateData.variants?.deleteMany, undefined);
  assert.deepEqual(updateData.media?.update?.[0]?.data, {
    src: 'https://cdn.example.com/rear-bumper.jpg',
  });
  assert.equal(updateData.variants?.update?.[0]?.data.requiresShipping, undefined);
  assert.equal(updateData.variants?.update?.[0]?.data.taxable, undefined);
});

test('runShopCsvImport treats missing nested CSV columns as preserve, not delete-all', async () => {
  const prisma = createMockPrisma({
    id: 'product-1',
    slug: 'urban-rear-bumper',
    media: [{ id: 'media-1', src: 'https://cdn.example.com/existing.jpg', position: 1 }],
    options: [{ id: 'option-1', name: 'Finish', position: 1 }],
    variants: [
      {
        id: 'variant-1',
        sku: 'URB-RB-001',
        title: 'Gloss',
        position: 1,
        option1Value: 'Gloss',
        option2Value: null,
        option3Value: null,
        isDefault: true,
      },
    ],
    metafields: [{ id: 'metafield-1', namespace: 'custom', key: 'vehicle' }],
  });

  const result = await runShopCsvImport(prisma as never, adminSession as never, {
    csvText: PARTIAL_CSV,
    action: 'commit',
    conflictMode: 'UPDATE',
  }, mockCatalogWriter);

  assert.equal(result.updated, 1);
  const updateData = prisma.state.lastUpdateData as Record<string, unknown>;
  assert.equal(updateData.collections, undefined);
  assert.equal(updateData.media, undefined);
  assert.equal(updateData.options, undefined);
  assert.equal(updateData.variants, undefined);
  assert.equal(updateData.metafields, undefined);
  assert.equal(updateData.tags, undefined);
  assert.equal(updateData.image, undefined);
  assert.equal(updateData.gallery, undefined);
  assert.equal(updateData.category, undefined);
  assert.deepEqual(Object.keys(updateData).sort(), ['slug', 'titleUa']);
});

test('runShopCsvImport only mutates variant scalar columns that are present', async () => {
  const prisma = createMockPrisma({
    id: 'product-1',
    slug: 'urban-rear-bumper',
    variants: [
      {
        id: 'variant-1',
        sku: 'URB-RB-001',
        title: 'Gloss',
        position: 1,
        option1Value: 'Gloss',
        option2Value: null,
        option3Value: null,
        isDefault: true,
      },
    ],
  });

  const result = await runShopCsvImport(prisma as never, adminSession as never, {
    csvText: PARTIAL_VARIANT_CSV,
    action: 'commit',
    conflictMode: 'UPDATE',
  }, mockCatalogWriter);

  assert.equal(result.updated, 1);
  const updateData = prisma.state.lastUpdateData as {
    variants: { update: Array<{ where: { id: string }; data: Record<string, unknown> }> };
  } & Record<string, unknown>;
  assert.deepEqual(Object.keys(updateData).sort(), [
    'priceUah',
    'sku',
    'slug',
    'titleUa',
    'variants',
  ]);
  assert.equal(updateData.variants.update[0]?.where.id, 'variant-1');
  assert.deepEqual(updateData.variants.update[0]?.data, {
    sku: 'URB-RB-001',
    priceUah: 36000,
  });
});

test('runShopCsvImport does not clear option values when only the option name is present', async () => {
  const prisma = createMockPrisma({
    id: 'product-1',
    slug: 'urban-rear-bumper',
    options: [{ id: 'option-1', name: 'Finish', position: 1 }],
    variants: [
      {
        id: 'variant-1',
        sku: 'URB-RB-001',
        title: 'Gloss',
        position: 1,
        option1Value: 'Gloss',
        option2Value: null,
        option3Value: null,
        isDefault: true,
      },
    ],
  });

  const result = await runShopCsvImport(prisma as never, adminSession as never, {
    csvText: PARTIAL_OPTION_CSV,
    action: 'commit',
    conflictMode: 'UPDATE',
  }, mockCatalogWriter);

  assert.equal(result.updated, 1);
  const updateData = prisma.state.lastUpdateData as {
    options: { update: Array<{ where: { id: string }; data: Record<string, unknown> }> };
  };
  assert.equal(updateData.options.update[0]?.where.id, 'option-1');
  assert.deepEqual(updateData.options.update[0]?.data, { name: 'Surface' });
});
