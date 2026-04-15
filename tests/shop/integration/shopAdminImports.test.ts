import test from 'node:test';
import assert from 'node:assert/strict';
import { ShopImportConflictMode } from '@prisma/client';
import { runShopCsvImport } from '../../../src/lib/shopAdminImports';

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

type MockProductRecord = { id: string; slug: string };

function createMockPrisma(existingProduct: MockProductRecord | null) {
  const state = {
    existingProduct,
    created: 0,
    updated: 0,
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
      update: async () => {
        state.updated += 1;
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

test('runShopCsvImport respects CREATE conflict mode and records row errors', async () => {
  const prisma = createMockPrisma({ id: 'product-1', slug: 'urban-rear-bumper' });
  const result = await runShopCsvImport(prisma as never, adminSession as never, {
    csvText: CSV,
    action: 'commit',
    conflictMode: 'CREATE',
    sourceFilename: 'urban.csv',
  });

  assert.equal(result.created, 0);
  assert.equal(result.updated, 0);
  assert.equal(result.skipped, 0);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0]?.message ?? '', /CREATE-only/i);
  assert.equal(prisma.state.auditLogs, 1);
});

test('runShopCsvImport respects SKIP and UPDATE conflict modes', async () => {
  const skipPrisma = createMockPrisma({ id: 'product-1', slug: 'urban-rear-bumper' });
  const skipResult = await runShopCsvImport(skipPrisma as never, adminSession as never, {
    csvText: CSV,
    action: 'commit',
    conflictMode: 'SKIP',
    sourceFilename: 'urban.csv',
  });

  assert.equal(skipResult.created, 0);
  assert.equal(skipResult.updated, 0);
  assert.equal(skipResult.skipped, 1);

  const updatePrisma = createMockPrisma({ id: 'product-1', slug: 'urban-rear-bumper' });
  const updateResult = await runShopCsvImport(updatePrisma as never, adminSession as never, {
    csvText: CSV,
    action: 'commit',
    conflictMode: 'UPDATE',
    sourceFilename: 'urban.csv',
    templateId: 'template-1',
  });

  assert.equal(updateResult.created, 0);
  assert.equal(updateResult.updated, 1);
  assert.equal(updatePrisma.state.updated, 1);
  assert.equal(updatePrisma.state.auditLogs, 1);
});
