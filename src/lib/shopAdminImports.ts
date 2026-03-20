import {
  Prisma,
  PrismaClient,
  ShopImportAction,
  ShopImportConflictMode,
  ShopImportStatus,
} from '@prisma/client';
import type { AdminSession } from '@/lib/adminAuth';
import {
  buildAdminProductCreateData,
  buildAdminProductUpdateData,
  normalizeAdminProductPayload,
} from '@/lib/shopAdminCatalog';
import { buildProductsFromShopifyCsv, type CsvHeaderMapping } from '@/lib/shopAdminCsv';
import { writeAdminAuditLog } from '@/lib/adminRbac';
import { DEFAULT_SHOP_STORE_KEY, ensureDefaultShopStores, normalizeShopStoreKey } from '@/lib/shopStores';

export const adminImportTemplateSelect = {
  id: true,
  name: true,
  storeKey: true,
  store: {
    select: {
      key: true,
      name: true,
    },
  },
  supplierName: true,
  sourceType: true,
  notes: true,
  fieldMapping: true,
  defaultConflictMode: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      jobs: true,
    },
  },
} satisfies Prisma.ShopImportTemplateSelect;

export const adminImportJobInclude = {
  store: {
    select: {
      key: true,
      name: true,
    },
  },
  template: {
    select: {
      id: true,
      name: true,
      storeKey: true,
      store: {
        select: {
          key: true,
          name: true,
        },
      },
      supplierName: true,
    },
  },
  rowErrors: {
    orderBy: [{ rowNumber: 'asc' }, { createdAt: 'asc' }],
    take: 50,
  },
} satisfies Prisma.ShopImportJobInclude;

export type AdminImportTemplateRecord = Prisma.ShopImportTemplateGetPayload<{
  select: typeof adminImportTemplateSelect;
}>;

export type AdminImportJobRecord = Prisma.ShopImportJobGetPayload<{
  include: typeof adminImportJobInclude;
}>;

type CsvImportRequest = {
  csvText: string;
  action: 'dry-run' | 'commit';
  supplierName?: string | null;
  sourceFilename?: string | null;
  templateId?: string | null;
  conflictMode?: string | null;
  storeKey?: string | null;
};

type ImportRowErrorInput = {
  rowNumber: number;
  handle?: string | null;
  message: string;
  payload?: Prisma.InputJsonValue;
};

type ImportTemplatePayload = ReturnType<typeof normalizeImportTemplatePayload>['data'];

function nullableString(value: unknown) {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

function normalizeConflictMode(value: unknown, fallback: ShopImportConflictMode = 'UPDATE') {
  const normalized = String(value ?? '').trim().toUpperCase();
  if (normalized === 'SKIP') return 'SKIP';
  if (normalized === 'CREATE') return 'CREATE';
  return fallback;
}

function jsonValueOrNull(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

export function serializeImportTemplate(record: AdminImportTemplateRecord) {
  return {
    id: record.id,
    name: record.name,
    storeKey: record.storeKey,
    store: record.store,
    supplierName: record.supplierName,
    sourceType: record.sourceType,
    notes: record.notes,
    fieldMapping: record.fieldMapping,
    defaultConflictMode: record.defaultConflictMode,
    jobsCount: record._count.jobs,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function serializeImportJob(record: AdminImportJobRecord) {
  return {
    id: record.id,
    storeKey: record.storeKey,
    store: record.store
      ? {
          key: record.store.key,
          name: record.store.name,
        }
      : null,
    sourceType: record.sourceType,
    sourceFilename: record.sourceFilename,
    supplierName: record.supplierName,
    templateId: record.templateId,
    template: record.template,
    action: record.action,
    status: record.status,
    conflictMode: record.conflictMode,
    actorEmail: record.actorEmail,
    actorName: record.actorName,
    totalRows: record.totalRows,
    productsCount: record.productsCount,
    variantsCount: record.variantsCount,
    validProducts: record.validProducts,
    createdCount: record.createdCount,
    updatedCount: record.updatedCount,
    skippedCount: record.skippedCount,
    errorCount: record.errorCount,
    columns: record.columns,
    templateSnapshot: record.templateSnapshot,
    summary: record.summary,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    rowErrors: record.rowErrors.map((item) => ({
      id: item.id,
      rowNumber: item.rowNumber,
      handle: item.handle,
      message: item.message,
      payload: item.payload,
      createdAt: item.createdAt.toISOString(),
    })),
  };
}

export function normalizeImportTemplatePayload(input: unknown) {
  const source = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const name = String(source.name ?? '').trim();
  const errors: string[] = [];

  if (!name) {
    errors.push('name is required');
  }

  return {
    data: {
      name,
      storeKey: normalizeShopStoreKey(source.storeKey),
      supplierName: nullableString(source.supplierName),
      sourceType: nullableString(source.sourceType) ?? 'shopify_csv',
      notes: nullableString(source.notes),
      fieldMapping: normalizeTemplateFieldMapping(source.fieldMapping),
      defaultConflictMode: normalizeConflictMode(source.defaultConflictMode),
    },
    errors,
  };
}

function normalizeTemplateFieldMapping(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return Prisma.JsonNull;
  }

  const mapping = Object.entries(value as Record<string, unknown>).reduce<Record<string, string>>(
    (accumulator, [sourceColumn, targetColumn]) => {
      const normalizedSource = String(sourceColumn ?? '').trim();
      const normalizedTarget = String(targetColumn ?? '').trim();
      if (!normalizedSource || !normalizedTarget) {
        return accumulator;
      }
      accumulator[normalizedSource] = normalizedTarget;
      return accumulator;
    },
    {}
  );

  return Object.keys(mapping).length ? (mapping as Prisma.InputJsonValue) : Prisma.JsonNull;
}

function extractHeaderMapping(value: unknown): CsvHeaderMapping | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const mapping = Object.entries(value as Record<string, unknown>).reduce<Record<string, string>>(
    (accumulator, [sourceColumn, targetColumn]) => {
      const normalizedSource = String(sourceColumn ?? '').trim();
      const normalizedTarget = String(targetColumn ?? '').trim();
      if (!normalizedSource || !normalizedTarget) {
        return accumulator;
      }
      accumulator[normalizedSource] = normalizedTarget;
      return accumulator;
    },
    {}
  );

  return Object.keys(mapping).length ? mapping : undefined;
}

export async function listImportTemplates(prisma: PrismaClient) {
  await ensureDefaultShopStores(prisma);
  const templates = await prisma.shopImportTemplate.findMany({
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    select: adminImportTemplateSelect,
  });

  return templates.map(serializeImportTemplate);
}

export async function listImportJobs(prisma: PrismaClient) {
  await ensureDefaultShopStores(prisma);
  const jobs = await prisma.shopImportJob.findMany({
    orderBy: [{ createdAt: 'desc' }],
    include: adminImportJobInclude,
    take: 30,
  });

  return jobs.map(serializeImportJob);
}

export async function createImportTemplate(
  prisma: PrismaClient,
  payload: ImportTemplatePayload,
  session: AdminSession
) {
  await ensureDefaultShopStores(prisma);
  const template = await prisma.shopImportTemplate.create({
    data: {
      name: payload.name,
      store: { connect: { key: payload.storeKey } },
      supplierName: payload.supplierName,
      sourceType: payload.sourceType,
      notes: payload.notes,
      fieldMapping: payload.fieldMapping,
      defaultConflictMode: payload.defaultConflictMode,
    },
    select: adminImportTemplateSelect,
  });

  await writeAdminAuditLog(prisma, session, {
    scope: 'shop',
    action: 'import.template.create',
    entityType: 'shop.import_template',
    entityId: template.id,
      metadata: {
        name: template.name,
        storeKey: template.storeKey,
        supplierName: template.supplierName,
      sourceType: template.sourceType,
      defaultConflictMode: template.defaultConflictMode,
    },
  });

  return serializeImportTemplate(template);
}

export async function updateImportTemplate(
  prisma: PrismaClient,
  templateId: string,
  payload: ImportTemplatePayload,
  session: AdminSession
) {
  await ensureDefaultShopStores(prisma);
  const template = await prisma.shopImportTemplate.update({
    where: { id: templateId },
    data: {
      name: payload.name,
      store: { connect: { key: payload.storeKey } },
      supplierName: payload.supplierName,
      sourceType: payload.sourceType,
      notes: payload.notes,
      fieldMapping: payload.fieldMapping,
      defaultConflictMode: payload.defaultConflictMode,
    },
    select: adminImportTemplateSelect,
  });

  await writeAdminAuditLog(prisma, session, {
    scope: 'shop',
    action: 'import.template.update',
    entityType: 'shop.import_template',
    entityId: template.id,
      metadata: {
        name: template.name,
        storeKey: template.storeKey,
        supplierName: template.supplierName,
      sourceType: template.sourceType,
      defaultConflictMode: template.defaultConflictMode,
    },
  });

  return serializeImportTemplate(template);
}

export async function deleteImportTemplate(
  prisma: PrismaClient,
  templateId: string,
  session: AdminSession
) {
  const template = await prisma.shopImportTemplate.delete({
    where: { id: templateId },
    select: {
      id: true,
      name: true,
      storeKey: true,
      supplierName: true,
      sourceType: true,
      defaultConflictMode: true,
    },
  });

  await writeAdminAuditLog(prisma, session, {
    scope: 'shop',
    action: 'import.template.delete',
    entityType: 'shop.import_template',
    entityId: template.id,
      metadata: {
        name: template.name,
        storeKey: template.storeKey,
        supplierName: template.supplierName,
      sourceType: template.sourceType,
      defaultConflictMode: template.defaultConflictMode,
    },
  });

  return template;
}

export async function getImportJob(prisma: PrismaClient, jobId: string) {
  await ensureDefaultShopStores(prisma);
  const job = await prisma.shopImportJob.findUnique({
    where: { id: jobId },
    include: {
      template: {
        select: {
          id: true,
          name: true,
          supplierName: true,
        },
      },
      rowErrors: {
        orderBy: [{ rowNumber: 'asc' }, { createdAt: 'asc' }],
      },
    },
  });

  return job ? serializeImportJob(job as AdminImportJobRecord) : null;
}

async function findTemplate(prisma: PrismaClient, templateId?: string | null) {
  if (!templateId) return null;

  return prisma.shopImportTemplate.findUnique({
    where: { id: templateId },
    select: {
      id: true,
      name: true,
      storeKey: true,
      supplierName: true,
      sourceType: true,
      notes: true,
      fieldMapping: true,
      defaultConflictMode: true,
    },
  });
}

async function createImportJobRecord(
  prisma: PrismaClient,
  input: {
    action: ShopImportAction;
    status: ShopImportStatus;
    session: AdminSession;
    sourceFilename?: string | null;
    supplierName?: string | null;
    templateId?: string | null;
    conflictMode: ShopImportConflictMode;
    totalRows: number;
    productsCount: number;
    variantsCount: number;
    validProducts: number;
    createdCount?: number;
    updatedCount?: number;
    skippedCount?: number;
    errorCount?: number;
    columns?: unknown;
    templateSnapshot?: unknown;
    summary?: unknown;
    rowErrors?: ImportRowErrorInput[];
    storeKey?: string | null;
  }
 ) {
  return prisma.shopImportJob.create({
    data: {
      store: { connect: { key: normalizeShopStoreKey(input.storeKey) } },
      sourceType: 'shopify_csv',
      sourceFilename: input.sourceFilename ?? null,
      supplierName: input.supplierName ?? null,
      template: input.templateId ? { connect: { id: input.templateId } } : undefined,
      action: input.action,
      status: input.status,
      conflictMode: input.conflictMode,
      actorEmail: input.session.email,
      actorName: input.session.name,
      totalRows: input.totalRows,
      productsCount: input.productsCount,
      variantsCount: input.variantsCount,
      validProducts: input.validProducts,
      createdCount: input.createdCount ?? 0,
      updatedCount: input.updatedCount ?? 0,
      skippedCount: input.skippedCount ?? 0,
      errorCount: input.errorCount ?? 0,
      columns: jsonValueOrNull(input.columns),
      templateSnapshot: jsonValueOrNull(input.templateSnapshot),
      summary: jsonValueOrNull(input.summary),
      rowErrors: input.rowErrors?.length
        ? {
            create: input.rowErrors.map((item) => ({
              rowNumber: item.rowNumber,
              handle: item.handle ?? null,
              message: item.message,
              payload: jsonValueOrNull(item.payload),
            })),
          }
        : undefined,
    },
    include: adminImportJobInclude,
  });
}

export async function runShopCsvImport(
  prisma: PrismaClient,
  session: AdminSession,
  request: CsvImportRequest
) {
  await ensureDefaultShopStores(prisma);
  const template = await findTemplate(prisma, request.templateId);
  const storeKey = normalizeShopStoreKey(request.storeKey ?? template?.storeKey ?? DEFAULT_SHOP_STORE_KEY);
  const headerMapping = extractHeaderMapping(template?.fieldMapping);
  const parsed = buildProductsFromShopifyCsv(request.csvText, headerMapping);
  if (parsed.columns.length === 0) {
    throw new Error('CSV is empty or has no header row');
  }
  const conflictMode = normalizeConflictMode(
    request.conflictMode,
    template?.defaultConflictMode ?? 'UPDATE'
  );

  const validationErrors: ImportRowErrorInput[] = [...parsed.errors].map((item) => ({
    rowNumber: item.row,
    message: item.message,
  }));

  const productsToUpsert = parsed.productRows.map(({ product, rowNumber }) => {
    const normalized = normalizeAdminProductPayload(product);
    normalized.data.storeKey = storeKey;
    normalized.errors.forEach((message) => {
      validationErrors.push({
        rowNumber,
        handle: product.slug,
        message,
        payload: {
          slug: product.slug,
          titleEn: product.titleEn,
        },
      });
    });
    return {
      data: normalized.data,
      rowIndex: rowNumber,
    };
  });

  const invalidRows = new Set(validationErrors.map((item) => item.rowNumber));
  const validProducts = productsToUpsert.filter((item) => !invalidRows.has(item.rowIndex)).length;

  const templateSnapshot = template
    ? {
        id: template.id,
        name: template.name,
        storeKey: template.storeKey,
        supplierName: template.supplierName,
        sourceType: template.sourceType,
        fieldMapping: template.fieldMapping,
        defaultConflictMode: template.defaultConflictMode,
      }
    : null;

  if (request.action === 'dry-run') {
    const job = await createImportJobRecord(prisma, {
      action: 'DRY_RUN',
      status: validationErrors.length ? 'FAILED' : 'COMPLETED',
      session,
      sourceFilename: request.sourceFilename,
      supplierName: request.supplierName ?? template?.supplierName ?? null,
      templateId: template?.id ?? null,
      storeKey,
      conflictMode,
      totalRows: parsed.totalRows,
      productsCount: parsed.products.length,
      variantsCount: parsed.variantsCount,
      validProducts,
      errorCount: validationErrors.length,
      columns: parsed.columns,
      templateSnapshot,
      summary: {
        action: 'dry-run',
      },
      rowErrors: validationErrors,
    });

    await writeAdminAuditLog(prisma, session, {
      scope: 'shop',
      action: 'import.csv.dry_run',
      entityType: 'shop.import',
      entityId: job.id,
      metadata: {
        totalRows: parsed.totalRows,
      storeKey,
      products: parsed.products.length,
      variants: parsed.variantsCount,
      errorCount: validationErrors.length,
      validProducts,
      templateId: template?.id ?? null,
      conflictMode,
    },
    });

    return {
      dryRun: true,
      totalRows: parsed.totalRows,
      valid: productsToUpsert.length,
      variants: parsed.variantsCount,
      products: parsed.products.length,
      errors: validationErrors.map((item) => ({
        row: item.rowNumber,
        message: item.message,
      })),
      columns: parsed.columns,
      job: serializeImportJob(job as AdminImportJobRecord),
    };
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const commitErrors: ImportRowErrorInput[] = [...validationErrors];

  for (const { data, rowIndex } of productsToUpsert) {
    if (validationErrors.some((entry) => entry.rowNumber === rowIndex)) {
      continue;
    }

    try {
      const existing = await prisma.shopProduct.findUnique({
        where: { storeKey_slug: { storeKey, slug: data.slug } },
        select: { id: true, slug: true, storeKey: true },
      });

      if (existing) {
        if (conflictMode === 'SKIP') {
          skipped += 1;
          continue;
        }

        if (conflictMode === 'CREATE') {
          commitErrors.push({
            rowNumber: rowIndex,
            handle: data.slug,
            message: 'Product already exists and conflict mode is CREATE-only',
            payload: {
              slug: data.slug,
            },
          });
          continue;
        }

        await prisma.shopProduct.update({
          where: {
            storeKey_slug: {
              storeKey,
              slug: data.slug,
            },
          },
          data: buildAdminProductUpdateData(data),
        });
        updated += 1;
        continue;
      }

      await prisma.shopProduct.create({
        data: buildAdminProductCreateData(data),
      });
      created += 1;
    } catch (error) {
      commitErrors.push({
        rowNumber: rowIndex,
        handle: data.slug,
        message: (error as Error).message,
        payload: {
          slug: data.slug,
        },
      });
    }
  }

  const job = await createImportJobRecord(prisma, {
    action: 'COMMIT',
    status: commitErrors.length ? 'FAILED' : 'COMPLETED',
    session,
    sourceFilename: request.sourceFilename,
    supplierName: request.supplierName ?? template?.supplierName ?? null,
    templateId: template?.id ?? null,
    storeKey,
    conflictMode,
    totalRows: parsed.totalRows,
      productsCount: parsed.products.length,
      variantsCount: parsed.variantsCount,
      validProducts,
      createdCount: created,
      updatedCount: updated,
      skippedCount: skipped,
    errorCount: commitErrors.length,
    columns: parsed.columns,
    templateSnapshot,
    summary: {
      action: 'commit',
      created,
      updated,
      skipped,
    },
    rowErrors: commitErrors,
  });

  await writeAdminAuditLog(prisma, session, {
    scope: 'shop',
    action: 'import.csv.commit',
    entityType: 'shop.import',
    entityId: job.id,
    metadata: {
      totalRows: parsed.totalRows,
      storeKey,
      products: parsed.products.length,
      variants: parsed.variantsCount,
      created,
      updated,
      skipped,
      errorCount: commitErrors.length,
      validProducts,
      templateId: template?.id ?? null,
      conflictMode,
    },
  });

  return {
    created,
    updated,
    skipped,
    errors: commitErrors.map((item) => ({
      row: item.rowNumber,
      message: item.message,
    })),
    job: serializeImportJob(job as AdminImportJobRecord),
  };
}
