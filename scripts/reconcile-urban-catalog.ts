#!/usr/bin/env tsx

import fs from 'node:fs/promises';
import path from 'node:path';

import { PrismaClient } from '@prisma/client';

import { URBAN_COLLECTION_CARDS } from '../src/app/[locale]/shop/data/urbanCollectionsList';
import { replaceStorefrontTag } from '../src/lib/shopProductStorefront';
import { getUrbanCollectionHandleForProduct } from '../src/lib/urbanCollectionMatcher';

const prisma = new PrismaClient();

const args = new Set(process.argv.slice(2));
const COMMIT = args.has('--commit');
const DRY_RUN = !COMMIT || args.has('--dry-run');
const GP_ONLY = args.has('--gp-only');
const LIMIT_ARG = process.argv.find((arg) => arg.startsWith('--limit='));
const LIMIT = LIMIT_ARG ? Number(LIMIT_ARG.split('=')[1]) : null;

const URBAN_VENDOR = 'Urban Automotive';
const GP_PORTAL_SOURCE = 'gp-portal';
const LEGACY_CURATED_SOURCE = 'legacy-curated';
const STOREFRONT_TAG_PREFIX = 'store:';
const URBAN_SOURCE_TAG_PREFIX = 'urban-source:';
const URBAN_VEHICLE_BRAND_TAG_PREFIX = 'urban-vehicle-brand:';
const URBAN_MANUFACTURER_TAG = 'urban-manufacturer:urban-automotive';
const URBAN_SYNC_SOURCE_METAFIELD = {
  namespace: 'custom',
  key: 'urban_sync_source',
  valueType: 'single_line_text_field',
} as const;
const URBAN_MANUFACTURER_METAFIELD = {
  namespace: 'custom',
  key: 'manufacturer',
  valueType: 'single_line_text_field',
  value: URBAN_VENDOR,
} as const;
const URBAN_BRAND_METAFIELD = {
  namespace: 'custom',
  key: 'brand',
  valueType: 'single_line_text_field',
} as const;
const URBAN_VEHICLE_BRAND_METAFIELD = {
  namespace: 'custom',
  key: 'vehicle_brand',
  valueType: 'single_line_text_field',
} as const;

const COLLECTION_CARD_BY_HANDLE = new Map(
  URBAN_COLLECTION_CARDS.map((card) => [card.collectionHandle, card] as const)
);

async function fetchUrbanCatalogRows(limit: number | null) {
  return prisma.shopProduct.findMany({
    where: {
      status: 'ACTIVE',
      OR: [
        {
          metafields: {
            some: {
              namespace: 'custom',
              key: 'urban_sync_source',
              value: {
                in: [GP_PORTAL_SOURCE, LEGACY_CURATED_SOURCE],
              },
            },
          },
        },
        {
          tags: {
            hasSome: ['store:urban', 'urban-source:gp-portal', 'urban-source:legacy-curated', URBAN_MANUFACTURER_TAG],
          },
        },
        {
          vendor: {
            in: ['Urban', URBAN_VENDOR],
          },
        },
        {
          brand: {
            in: ['Urban', URBAN_VENDOR],
          },
        },
        {
          slug: {
            startsWith: 'urb-',
          },
        },
      ],
    },
    orderBy: {
      slug: 'asc',
    },
    ...(limit ? { take: limit } : {}),
    select: {
      id: true,
      slug: true,
      sku: true,
      brand: true,
      vendor: true,
      titleEn: true,
      titleUa: true,
      collectionEn: true,
      collectionUa: true,
      tags: true,
      isPublished: true,
      status: true,
      metafields: {
        select: {
          namespace: true,
          key: true,
          value: true,
          valueType: true,
        },
      },
      collections: {
        orderBy: {
          sortOrder: 'asc',
        },
        select: {
          collection: {
            select: {
              id: true,
              handle: true,
              titleEn: true,
              titleUa: true,
              brand: true,
              isUrban: true,
            },
          },
        },
      },
    },
  });
}

type UrbanCatalogRow = Awaited<ReturnType<typeof fetchUrbanCatalogRows>>[number];

type ArchivePlan = {
  id: string;
  slug: string;
  sku: string | null;
  titleEn: string;
  source: string | null;
  reason: 'duplicate-legacy' | 'gp-only-prune';
  keepSlug?: string;
};

type ProductPlan = {
  id: string;
  slug: string;
  targetBrand: string;
  targetSource: string;
  targetTags: string[];
  targetVendor: string;
  targetCollectionHandles: string[];
  syncCollectionHandles: boolean;
  productData: {
    brand?: string;
    vendor?: string;
    tags?: string[];
    collectionEn?: string;
    collectionUa?: string;
  };
  metafieldOps: Array<{
    namespace: string;
    key: string;
    value: string;
    valueType: string;
  }>;
};

function normalizeWhitespace(value: string | null | undefined) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.map((value) => normalizeWhitespace(value)).filter(Boolean))
  );
}

function stripTagPrefixes(tags: readonly string[], prefixes: string[]) {
  const normalizedPrefixes = prefixes.map((prefix) => prefix.toLowerCase());

  return uniqueStrings(
    tags.filter((tag) => {
      const normalizedTag = normalizeWhitespace(tag).toLowerCase();
      return normalizedPrefixes.every((prefix) => !normalizedTag.startsWith(prefix));
    })
  );
}

function replacePrefixedTag(tags: readonly string[], prefix: string, replacement: string | null) {
  const normalizedPrefix = prefix.toLowerCase();
  const cleaned = (tags ?? [])
    .map((tag) => normalizeWhitespace(tag))
    .filter((tag) => tag && !tag.toLowerCase().startsWith(normalizedPrefix));

  return uniqueStrings(replacement ? [...cleaned, replacement] : cleaned);
}

function arraysEqual(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function canonicalizeBrand(value: string | null | undefined) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return '';

  const compact = normalized.toLowerCase().replace(/\s+/g, ' ');
  if (compact === 'urban') return URBAN_VENDOR;
  if (compact === 'urban automotive') return URBAN_VENDOR;
  if (compact === 'land rover') return 'Land Rover';
  if (compact === 'range rover') return 'Range Rover';
  if (compact === 'lamborghini') return 'Lamborghini';
  if (compact === 'audi') return 'Audi';
  if (compact === 'bentley') return 'Bentley';
  if (compact === 'volkswagen') return 'Volkswagen';
  if (compact === 'ineos') return 'INEOS';
  if (compact === 'rolls royce' || compact === 'rolls-royce') return 'Rolls-Royce';
  if (compact === 'mercedes benz' || compact === 'mercedes-benz') return 'Mercedes-Benz';

  return normalized;
}

function isMeaningfulVehicleBrand(value: string | null | undefined) {
  const normalized = canonicalizeBrand(value);
  return Boolean(normalized && normalized !== URBAN_VENDOR);
}

function slugifyBrand(value: string) {
  return canonicalizeBrand(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function getMetafieldValue(row: UrbanCatalogRow, key: string) {
  return (
    row.metafields.find((metafield) => metafield.namespace === 'custom' && metafield.key === key)?.value ?? null
  );
}

function getTagValue(tags: readonly string[], prefix: string) {
  const normalizedPrefix = prefix.toLowerCase();
  const match = tags.find((tag) => normalizeWhitespace(tag).toLowerCase().startsWith(normalizedPrefix));
  if (!match) return null;

  return normalizeWhitespace(match.slice(prefix.length));
}

function resolveUrbanSource(row: UrbanCatalogRow) {
  const metafieldValue = normalizeWhitespace(getMetafieldValue(row, URBAN_SYNC_SOURCE_METAFIELD.key));
  if (metafieldValue === GP_PORTAL_SOURCE) return GP_PORTAL_SOURCE;
  if (metafieldValue === LEGACY_CURATED_SOURCE) return LEGACY_CURATED_SOURCE;

  const tagValue = normalizeWhitespace(getTagValue(row.tags, URBAN_SOURCE_TAG_PREFIX));
  if (tagValue === GP_PORTAL_SOURCE) return GP_PORTAL_SOURCE;
  if (tagValue === LEGACY_CURATED_SOURCE) return LEGACY_CURATED_SOURCE;

  return null;
}

function getCurrentUrbanCollectionHandles(row: UrbanCatalogRow) {
  return uniqueStrings(
    row.collections
      .filter((entry) => COLLECTION_CARD_BY_HANDLE.has(entry.collection.handle))
      .map((entry) => entry.collection.handle)
  );
}

function buildCollectionLabel(handles: readonly string[]) {
  return handles
    .map((handle) => normalizeWhitespace(COLLECTION_CARD_BY_HANDLE.get(handle)?.title))
    .filter(Boolean)
    .join(' / ');
}

function buildMatcherProduct(row: UrbanCatalogRow) {
  return {
    slug: row.slug,
    brand: row.brand,
    vendor: row.vendor,
    title: {
      en: row.titleEn,
      ua: row.titleUa,
    },
    collection: {
      en: row.collectionEn,
      ua: row.collectionUa,
    },
    tags: replaceStorefrontTag(row.tags, 'urban'),
    collections: row.collections.map((entry) => ({
      handle: entry.collection.handle,
      brand: entry.collection.brand,
      isUrban: entry.collection.isUrban,
      title: {
        en: entry.collection.titleEn,
        ua: entry.collection.titleUa,
      },
    })),
  };
}

function resolveTargetCollectionHandle(row: UrbanCatalogRow) {
  return getUrbanCollectionHandleForProduct(buildMatcherProduct(row)) ?? getCurrentUrbanCollectionHandles(row)[0] ?? null;
}

function resolveRsq8CollectionHandles(row: UrbanCatalogRow) {
  const haystack = normalizeWhitespace(row.titleEn).toLowerCase();
  if (!haystack.includes('rsq8')) {
    return null;
  }

  const hasPreFacelift = /\bpre[\s-]?facelift\b/.test(haystack);
  const haystackWithoutPreFacelift = haystack.replace(/\bpre[\s-]?facelift\b/g, ' ');
  const hasFacelift = /\bfacelift\b|\b2024\b|\b2025\b/.test(haystackWithoutPreFacelift);

  if (hasPreFacelift && hasFacelift) {
    return ['audi-rsq8', 'audi-rsq8-facelift'];
  }

  if (hasPreFacelift) {
    return ['audi-rsq8'];
  }

  if (hasFacelift) {
    return ['audi-rsq8-facelift'];
  }

  return ['audi-rsq8'];
}

function resolveTargetCollectionHandles(row: UrbanCatalogRow) {
  const rsq8Handles = resolveRsq8CollectionHandles(row);
  if (rsq8Handles) {
    return rsq8Handles;
  }

  return getCurrentUrbanCollectionHandles(row);
}

function resolveTargetBrand(row: UrbanCatalogRow, targetCollectionHandle: string | null) {
  const brandFromCollection = targetCollectionHandle
    ? canonicalizeBrand(COLLECTION_CARD_BY_HANDLE.get(targetCollectionHandle)?.brand ?? null)
    : '';
  if (isMeaningfulVehicleBrand(brandFromCollection)) {
    return brandFromCollection;
  }

  const vehicleBrand = canonicalizeBrand(
    getMetafieldValue(row, URBAN_VEHICLE_BRAND_METAFIELD.key) ?? getMetafieldValue(row, URBAN_BRAND_METAFIELD.key)
  );
  if (isMeaningfulVehicleBrand(vehicleBrand)) {
    return vehicleBrand;
  }

  const currentBrand = canonicalizeBrand(row.brand);
  if (isMeaningfulVehicleBrand(currentBrand)) {
    return currentBrand;
  }

  return URBAN_VENDOR;
}

function buildTargetTags(row: UrbanCatalogRow, source: string, brand: string) {
  const baseTags = stripTagPrefixes(row.tags, [
    STOREFRONT_TAG_PREFIX,
    URBAN_SOURCE_TAG_PREFIX,
    URBAN_VEHICLE_BRAND_TAG_PREFIX,
    'urban-manufacturer:',
  ]);

  return uniqueStrings([
    ...baseTags,
    `${STOREFRONT_TAG_PREFIX}urban`,
    `${URBAN_SOURCE_TAG_PREFIX}${source}`,
    isMeaningfulVehicleBrand(brand) ? `${URBAN_VEHICLE_BRAND_TAG_PREFIX}${slugifyBrand(brand)}` : null,
    URBAN_MANUFACTURER_TAG,
  ]);
}

function buildMetafieldOps(row: UrbanCatalogRow, targetSource: string, targetBrand: string) {
  const ops: ProductPlan['metafieldOps'] = [];
  const currentSource = normalizeWhitespace(getMetafieldValue(row, URBAN_SYNC_SOURCE_METAFIELD.key));
  if (currentSource !== targetSource) {
    ops.push({ ...URBAN_SYNC_SOURCE_METAFIELD, value: targetSource });
  }

  const currentManufacturer = canonicalizeBrand(getMetafieldValue(row, URBAN_MANUFACTURER_METAFIELD.key));
  if (currentManufacturer !== URBAN_VENDOR) {
    ops.push({ ...URBAN_MANUFACTURER_METAFIELD });
  }

  const currentBrandMetafield = canonicalizeBrand(getMetafieldValue(row, URBAN_BRAND_METAFIELD.key));
  if (currentBrandMetafield !== targetBrand) {
    ops.push({ ...URBAN_BRAND_METAFIELD, value: targetBrand });
  }

  if (isMeaningfulVehicleBrand(targetBrand)) {
    const currentVehicleBrand = canonicalizeBrand(getMetafieldValue(row, URBAN_VEHICLE_BRAND_METAFIELD.key));
    if (currentVehicleBrand !== targetBrand) {
      ops.push({ ...URBAN_VEHICLE_BRAND_METAFIELD, value: targetBrand });
    }
  }

  return ops;
}

function buildProductPlan(row: UrbanCatalogRow): ProductPlan | null {
  const currentSource = resolveUrbanSource(row);
  const targetSource = currentSource === GP_PORTAL_SOURCE ? GP_PORTAL_SOURCE : LEGACY_CURATED_SOURCE;
  const rsq8RepairHandles = resolveRsq8CollectionHandles(row);
  const targetCollectionHandles = resolveTargetCollectionHandles(row);
  const primaryTargetCollectionHandle = targetCollectionHandles[0] ?? null;
  const targetBrand = resolveTargetBrand(row, primaryTargetCollectionHandle);
  const targetVendor = URBAN_VENDOR;
  const targetTags = buildTargetTags(row, targetSource, targetBrand);
  const productData: ProductPlan['productData'] = {};

  if (canonicalizeBrand(row.brand) !== targetBrand) {
    productData.brand = targetBrand;
  }

  if (canonicalizeBrand(row.vendor) !== targetVendor) {
    productData.vendor = targetVendor;
  }

  if (!arraysEqual(uniqueStrings(row.tags), targetTags)) {
    productData.tags = targetTags;
  }

  const currentUrbanCollectionHandles = getCurrentUrbanCollectionHandles(row);
  const metafieldOps = buildMetafieldOps(row, targetSource, targetBrand);
  let syncCollectionHandles = false;
  let finalTargetCollectionHandles = targetCollectionHandles;

  if (rsq8RepairHandles) {
    const targetCollectionLabel = buildCollectionLabel(targetCollectionHandles);
    if (targetCollectionLabel && normalizeWhitespace(row.collectionEn) !== targetCollectionLabel) {
      productData.collectionEn = targetCollectionLabel;
    }

    if (targetCollectionLabel && normalizeWhitespace(row.collectionUa) !== targetCollectionLabel) {
      productData.collectionUa = targetCollectionLabel;
    }

    const currentVehicleModelHandles = normalizeWhitespace(getMetafieldValue(row, 'vehicle_model_handles'));
    const targetVehicleModelHandles = targetCollectionHandles.join(',');
    if (currentVehicleModelHandles !== targetVehicleModelHandles) {
      metafieldOps.push({
        namespace: 'custom',
        key: 'vehicle_model_handles',
        value: targetVehicleModelHandles,
        valueType: 'multi_line_text_field',
      });
    }

    syncCollectionHandles = !arraysEqual(currentUrbanCollectionHandles, targetCollectionHandles);
  } else if (!currentUrbanCollectionHandles.length) {
    const inferredHandle = resolveTargetCollectionHandle(row);
    if (inferredHandle) {
      finalTargetCollectionHandles = [inferredHandle];
      syncCollectionHandles = true;
    }
  }

  if (!Object.keys(productData).length && !metafieldOps.length && !syncCollectionHandles) {
    return null;
  }

  return {
    id: row.id,
    slug: row.slug,
    targetBrand,
    targetSource,
    targetTags,
    targetVendor,
    targetCollectionHandles: finalTargetCollectionHandles,
    syncCollectionHandles,
    productData,
    metafieldOps,
  };
}

function findArchiveDuplicatePlans(rows: UrbanCatalogRow[]) {
  const rowsBySku = new Map<string, UrbanCatalogRow[]>();

  rows.forEach((row) => {
    const sku = normalizeWhitespace(row.sku).toUpperCase();
    if (!sku) return;

    const group = rowsBySku.get(sku) ?? [];
    group.push(row);
    rowsBySku.set(sku, group);
  });

  const plans: ArchivePlan[] = [];

  rowsBySku.forEach((group) => {
    if (group.length !== 2) {
      return;
    }

    const gpPortalRow = group.find((row) => resolveUrbanSource(row) === GP_PORTAL_SOURCE);
    const legacyRow = group.find((row) => resolveUrbanSource(row) !== GP_PORTAL_SOURCE);
    if (!gpPortalRow || !legacyRow) {
      return;
    }

    if (!gpPortalRow.slug.startsWith('urb-') || legacyRow.slug.startsWith('urb-')) {
      return;
    }

    if (
      normalizeWhitespace(gpPortalRow.titleEn).toLowerCase() !==
      normalizeWhitespace(legacyRow.titleEn).toLowerCase()
    ) {
      return;
    }

    plans.push({
      id: legacyRow.id,
      slug: legacyRow.slug,
      sku: legacyRow.sku,
      titleEn: legacyRow.titleEn,
      source: resolveUrbanSource(legacyRow),
      reason: 'duplicate-legacy',
      keepSlug: gpPortalRow.slug,
    });
  });

  return plans.sort((left, right) => left.slug.localeCompare(right.slug));
}

function findGpOnlyArchivePlans(rows: UrbanCatalogRow[]) {
  return rows
    .filter((row) => resolveUrbanSource(row) !== GP_PORTAL_SOURCE)
    .map((row) => ({
      id: row.id,
      slug: row.slug,
      sku: row.sku,
      titleEn: row.titleEn,
      source: resolveUrbanSource(row),
      reason: 'gp-only-prune' as const,
    }))
    .sort((left, right) => left.slug.localeCompare(right.slug));
}

function nowStamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function writeBackup(rows: UrbanCatalogRow[], archivePlans: ArchivePlan[], productPlans: ProductPlan[]) {
  const directory = path.join(process.cwd(), 'backups', 'urban-reconcile');
  await fs.mkdir(directory, { recursive: true });
  const filePath = path.join(directory, `urban-reconcile-${nowStamp()}.json`);

  await fs.writeFile(
    filePath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        rows,
        archivePlans,
        productPlans,
      },
      null,
      2
    ),
    'utf8'
  );

  return filePath;
}

async function ensureUrbanCollections() {
  const collectionIdByHandle = new Map<string, string>();

  for (const [index, card] of URBAN_COLLECTION_CARDS.entries()) {
    const record = await prisma.shopCollection.upsert({
      where: {
        handle: card.collectionHandle,
      },
      update: {
        titleUa: card.title,
        titleEn: card.title,
        brand: card.brand,
        heroImage: card.externalImageUrl,
        isPublished: true,
        isUrban: true,
        sortOrder: index,
      },
      create: {
        handle: card.collectionHandle,
        titleUa: card.title,
        titleEn: card.title,
        brand: card.brand,
        heroImage: card.externalImageUrl,
        isPublished: true,
        isUrban: true,
        sortOrder: index,
      },
      select: {
        id: true,
      },
    });

    collectionIdByHandle.set(card.collectionHandle, record.id);
  }

  return collectionIdByHandle;
}

async function applyArchivePlans(archivePlans: ArchivePlan[]) {
  for (const plan of archivePlans) {
    await prisma.shopProduct.update({
      where: {
        id: plan.id,
      },
      data: {
        status: 'ARCHIVED',
        isPublished: false,
        publishedAt: null,
      },
    });
  }
}

async function applyProductPlans(productPlans: ProductPlan[], collectionIdByHandle: Map<string, string>) {
  for (const plan of productPlans) {
    await prisma.$transaction(async (tx) => {
      if (Object.keys(plan.productData).length) {
        await tx.shopProduct.update({
          where: {
            id: plan.id,
          },
          data: plan.productData,
        });
      }

      for (const operation of plan.metafieldOps) {
        await tx.shopProductMetafield.upsert({
          where: {
            productId_namespace_key: {
              productId: plan.id,
              namespace: operation.namespace,
              key: operation.key,
            },
          },
          update: {
            value: operation.value,
            valueType: operation.valueType,
          },
          create: {
            productId: plan.id,
            namespace: operation.namespace,
            key: operation.key,
            value: operation.value,
            valueType: operation.valueType,
          },
        });
      }

      if (plan.syncCollectionHandles) {
        await tx.shopProductCollection.deleteMany({
          where: {
            productId: plan.id,
          },
        });

        for (const [index, handle] of plan.targetCollectionHandles.entries()) {
          const collectionId = collectionIdByHandle.get(handle);
          if (!collectionId) {
            continue;
          }

          await tx.shopProductCollection.create({
            data: {
              productId: plan.id,
              collectionId,
              sortOrder: index,
            },
          });
        }
      }
    });
  }
}

async function main() {
  const rows = await fetchUrbanCatalogRows(LIMIT);
  const duplicateArchivePlans = findArchiveDuplicatePlans(rows);
  const gpOnlyArchivePlans = GP_ONLY ? findGpOnlyArchivePlans(rows) : [];
  const archivePlans = Array.from(
    new Map(
      [...duplicateArchivePlans, ...gpOnlyArchivePlans].map((plan) => [plan.id, plan] as const)
    ).values()
  );
  const archivedIds = new Set(archivePlans.map((plan) => plan.id));
  const productPlans = rows
    .filter((row) => !archivedIds.has(row.id))
    .map((row) => buildProductPlan(row))
    .filter((plan): plan is ProductPlan => Boolean(plan));

  const summary = {
    mode: DRY_RUN ? 'dry-run' : 'commit',
    gpOnly: GP_ONLY,
    totalRows: rows.length,
    archiveTotal: archivePlans.length,
    archiveDuplicates: archivePlans.filter((plan) => plan.reason === 'duplicate-legacy').length,
    archiveGpOnlyPrune: archivePlans.filter((plan) => plan.reason === 'gp-only-prune').length,
    normalizeProducts: productPlans.length,
    vendorUpdates: productPlans.filter((plan) => Boolean(plan.productData.vendor)).length,
    brandUpdates: productPlans.filter((plan) => Boolean(plan.productData.brand)).length,
    tagUpdates: productPlans.filter((plan) => Boolean(plan.productData.tags)).length,
    collectionLinks: productPlans.filter((plan) => plan.syncCollectionHandles).length,
    metafieldUpserts: productPlans.reduce((total, plan) => total + plan.metafieldOps.length, 0),
    sampleArchives: archivePlans.slice(0, 20),
    samplePlans: productPlans.slice(0, 30).map((plan) => ({
      slug: plan.slug,
      targetBrand: plan.targetBrand,
      targetSource: plan.targetSource,
      targetCollectionHandles: plan.targetCollectionHandles,
      productFields: Object.keys(plan.productData),
      metafields: plan.metafieldOps.map((operation) => operation.key),
    })),
  };

  console.log(JSON.stringify(summary, null, 2));

  if (DRY_RUN) {
    return;
  }

  const backupPath = await writeBackup(rows, archivePlans, productPlans);
  const collectionIdByHandle = await ensureUrbanCollections();
  await applyArchivePlans(archivePlans);
  await applyProductPlans(productPlans, collectionIdByHandle);

  console.log(
    JSON.stringify(
      {
        committed: true,
        gpOnly: GP_ONLY,
        backupPath,
        archiveTotal: archivePlans.length,
        normalizeProducts: productPlans.length,
      },
      null,
      2
    )
  );
}

main()
  .catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
