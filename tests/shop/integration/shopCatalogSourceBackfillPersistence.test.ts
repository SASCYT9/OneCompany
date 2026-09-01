import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { PrismaClient } from "@prisma/client";
import { buildShopCatalogBaselineProductEntry } from "../../../src/lib/shopCatalogBaseline";

const databaseUrl = process.env.CATALOG_EPHEMERAL_TEST === "1" ? process.env.OPS_TEST_DATABASE_URL : undefined;
const serverOnlyStub = pathToFileURL(path.resolve("tests/shop/unit/fixtures/server-only-stub.cjs")).href;
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return { url: serverOnlyStub, shortCircuit: true };
  return nextResolve(specifier, context);
} });
const backfillModule = import("../../../src/lib/shopCatalogSourceBackfill.server");
const toBaselineSnapshot = (value: unknown) => JSON.parse(JSON.stringify(value, (_key, nested) => typeof nested === "bigint" ? nested.toString() : nested));

test("shared source writer supports true product-level records without synthetic variants", { skip: !databaseUrl }, async () => {
  const client = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const suffix = Date.now().toString();
  const productId = `product-level-source-${suffix}`;
  try {
    const collectionId = `source-collection-${suffix}`;
    await client.shopCollection.create({ data: { id: collectionId, handle: collectionId, titleUa: "Колекція", titleEn: "Collection" } });
    await client.shopProduct.create({ data: {
      id: productId, slug: productId, sku: `SKU-${suffix}`, titleUa: "Товар", titleEn: "Product",
      shortDescUa: "Опис", shortDescEn: "Description", priceEur: "199.00",
      image: "/media/source-primary.jpg", gallery: ["/media/source-primary.jpg", "/media/source-detail.jpg"],
      media: { create: [{ id: `source-media-${suffix}`, src: "/media/source-primary.jpg", position: 1 }] },
      options: { create: [{ id: `source-option-${suffix}`, name: "Finish", position: 1, values: ["Gloss"] }] },
      metafields: { create: [{ id: `source-meta-${suffix}`, namespace: "spec", key: "material", value: "carbon" }] },
      collections: { create: [{ collectionId, sortOrder: 3 }] },
    } });
    const commerceInclude = { variants: true, media: true, options: true, metafields: true, collections: true } as const;
    const beforeCommerce = buildShopCatalogBaselineProductEntry(toBaselineSnapshot(await client.shopProduct.findUniqueOrThrow({ where: { id: productId }, include: commerceInclude })));
    const draft = {
      sourceRecord: {
        recordKey: productId,
        sourceRevision: "product-v1",
        rawPayload: { id: productId },
        payloadHash: "a".repeat(64),
        productId,
      },
      provenance: [{
        fieldPath: "id",
        ordinal: 0,
        rawValue: productId,
        canonicalEntityType: "PRODUCT" as const,
        canonicalEntityId: productId,
        canonicalField: "id",
        normalizedValue: productId,
        mappingStatus: "MAPPED" as const,
        mapperVersion: "product-level-test-v1",
        confidence: 1,
        reason: null,
        productId,
        variantId: null,
      }],
      normalization: { productId, variantId: null },
      issues: [],
    };
    const callbackRecords: string[] = [];
    const { persistCatalogSourceRecordPageWithClient } = await backfillModule;
    const result = await persistCatalogSourceRecordPageWithClient(client, { drafts: [draft], sourceKey: `product-source-${suffix}` }, {
      label: "Product fixture",
      defaultSourceKey: "unused",
      defaultDisplayName: "Product fixture",
      decisionReason: "verified product-level identity",
      async persistCompatibility(input) { callbackRecords.push(input.sourceRecordId); },
    });
    assert.equal(result.inserted, 1);
    assert.equal(callbackRecords.length, 1);
    const replay = await persistCatalogSourceRecordPageWithClient(client, { drafts: [draft], sourceKey: `product-source-${suffix}` }, {
      label: "Product fixture",
      defaultSourceKey: "unused",
      defaultDisplayName: "Product fixture",
      decisionReason: "verified product-level identity",
      async persistCompatibility(input) { callbackRecords.push(input.sourceRecordId); },
    });
    assert.equal(replay.inserted, 0);
    assert.equal(replay.idempotent, 1);
    assert.equal(callbackRecords.length, 1);
    const afterCommerce = buildShopCatalogBaselineProductEntry(toBaselineSnapshot(await client.shopProduct.findUniqueOrThrow({ where: { id: productId }, include: commerceInclude })));
    assert.equal(afterCommerce.hashes.full, beforeCommerce.hashes.full);
    assert.deepEqual(afterCommerce.counts, beforeCommerce.counts);
    assert.equal(afterCommerce.counts.media, 1);
    assert.equal(afterCommerce.counts.options, 1);
    assert.equal(afterCommerce.counts.metafields, 1);
    assert.equal(afterCommerce.counts.collections, 1);
    assert.equal(afterCommerce.counts.priceValues, 1);
    const sourceRecord = await client.shopCatalogSourceRecord.findFirstOrThrow({ where: { sourceId: result.sourceId } });
    assert.equal(sourceRecord.productId, productId);
    assert.equal(sourceRecord.variantId, null);
    const head = await client.shopCatalogSourceBindingHead.findFirstOrThrow({
      where: { sourceId: result.sourceId }, include: { currentBinding: true },
    });
    assert.equal(head.entityType, "PRODUCT");
    assert.equal(head.currentBinding.canonicalEntityId, productId);
    assert.equal(head.currentBinding.variantId, null);
    assert.equal(await client.shopProductVariant.count({ where: { productId } }), 0);
  } finally { await client.$disconnect(); }
});

test("shared source writer serializes concurrent binding and compatibility promotion", { skip: !databaseUrl }, async () => {
  const first = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const second = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const productId = `concurrent-source-${suffix}`;
  const sourceKey = `concurrent-source-${suffix}`;
  try {
    await first.shopProduct.create({
      data: { id: productId, slug: productId, titleUa: productId, titleEn: productId },
    });
    const draft = {
      sourceRecord: {
        recordKey: productId,
        sourceRevision: "v1",
        rawPayload: { id: productId },
        payloadHash: "b".repeat(64),
        productId,
      },
      provenance: [{
        fieldPath: "id",
        ordinal: 0,
        rawValue: productId,
        canonicalEntityType: "PRODUCT" as const,
        canonicalEntityId: productId,
        canonicalField: "id",
        normalizedValue: productId,
        mappingStatus: "MAPPED" as const,
        mapperVersion: "concurrency-test-v1",
        confidence: 1,
        reason: null,
        productId,
        variantId: null,
      }],
      normalization: { productId, variantId: null },
      issues: [],
    };
    const { persistCatalogSourceRecordPageWithClient } = await backfillModule;
    const config = {
      label: "Concurrent fixture",
      defaultSourceKey: "unused",
      defaultDisplayName: "Concurrent fixture",
      decisionReason: "concurrency regression",
      async persistCompatibility() {},
    };
    const results = await Promise.all([
      persistCatalogSourceRecordPageWithClient(first, { drafts: [draft], sourceKey }, config),
      persistCatalogSourceRecordPageWithClient(second, { drafts: [draft], sourceKey }, config),
    ]);
    assert.deepEqual(results.map((result) => result.inserted).sort(), [0, 1]);
    assert.deepEqual(results.map((result) => result.idempotent).sort(), [0, 1]);
    const source = await first.shopCatalogSource.findUniqueOrThrow({ where: { key: sourceKey } });
    assert.equal(await first.shopCatalogSourceRecord.count({ where: { sourceId: source.id } }), 1);
    assert.equal(await first.shopCatalogSourceBindingHead.count({ where: { sourceId: source.id } }), 1);
  } finally {
    await Promise.all([first.$disconnect(), second.$disconnect()]);
  }
});

test("source ledger refuses to promote a resilience snapshot into a missing canonical product", { skip: !databaseUrl }, async () => {
  const client = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const productId = `missing-canonical-${suffix}`;
  const sourceKey = `missing-canonical-source-${suffix}`;
  const draft = {
    sourceRecord: { recordKey: productId, sourceRevision: "v1", rawPayload: { id: productId }, payloadHash: "c".repeat(64), productId },
    provenance: [{ fieldPath: "id", ordinal: 0, rawValue: productId, canonicalEntityType: "PRODUCT" as const, canonicalEntityId: productId, canonicalField: "id", normalizedValue: productId, mappingStatus: "MAPPED" as const, mapperVersion: "missing-product-test-v1", confidence: 1, reason: null, productId, variantId: null }],
    normalization: { productId, variantId: null },
    issues: [],
  };
  try {
    const { persistCatalogSourceRecordPageWithClient } = await backfillModule;
    await assert.rejects(() => persistCatalogSourceRecordPageWithClient(client, { drafts: [draft], sourceKey }, {
      label: "Missing canonical fixture", defaultSourceKey: "unused", defaultDisplayName: "Missing canonical fixture", decisionReason: "must fail closed", async persistCompatibility() { throw new Error("compatibility must not run"); },
    }), /references missing products/);
    assert.equal(await client.shopCatalogSource.count({ where: { key: sourceKey } }), 0);
    assert.equal(await client.shopCatalogSourceRecord.count({ where: { recordKey: productId } }), 0);
  } finally { await client.$disconnect(); }
});

test("versioned full-commerce import creates a publishable canonical aggregate before source promotion", { skip: !databaseUrl }, async () => {
  const client = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const collectionId = `import-collection-${suffix}`;
  try {
    await client.shopCollection.create({ data: { id: collectionId, handle: collectionId, titleUa: "Імпорт", titleEn: "Import" } });
    const [{ normalizeAdminProductPayload, buildAdminProductCreateData }, { coordinateShopCatalogProductCreationWithClient }, { buildShopCatalogAdminSnapshot }] = await Promise.all([
      import("../../../src/lib/shopAdminCatalog"),
      import("../../../src/lib/shopCatalogMutationCoordinator.server"),
      import("../../../src/lib/shopCatalogAdminSnapshot.server"),
    ]);
    const normalized = normalizeAdminProductPayload({
      slug: `full-commerce-${suffix}`, sku: `FULL-${suffix}`, scope: "auto", storefront: "main", brand: "Future Brand",
      titleUa: "Повний товар", titleEn: "Full product", shortDescUa: "Опис", shortDescEn: "Description",
      priceEur: 499, image: "/media/full-main.jpg", gallery: ["/media/full-main.jpg", "/media/full-detail.jpg"],
      collectionIds: [collectionId], tags: ["future-brand"], isPublished: true,
      media: [{ src: "/media/full-main.jpg", position: 1 }, { src: "/media/full-detail.jpg", position: 2 }],
      options: [{ name: "Finish", position: 1, values: ["Gloss", "Matte"] }],
      variants: [{ title: "Gloss", sku: `FULL-${suffix}-G`, option1Value: "Gloss", priceEur: 499, inventoryQty: 2, isDefault: true }, { title: "Matte", sku: `FULL-${suffix}-M`, option1Value: "Matte", priceEur: 519, inventoryQty: 1 }],
      metafields: [{ namespace: "spec", key: "material", value: "carbon" }],
    });
    assert.deepEqual(normalized.errors, []);
    const creation = await coordinateShopCatalogProductCreationWithClient(client, {
      changeDomains: ["CONTENT", "SEO", "MEDIA", "PRICE", "INVENTORY", "FITMENT", "TAXONOMY", "VISIBILITY"],
      async create(tx) { return (await tx.shopProduct.create({ data: buildAdminProductCreateData(normalized.data), select: { id: true } })).id; },
      snapshot(tx, productId, initialVersion) { return buildShopCatalogAdminSnapshot(tx, productId, initialVersion, { type: "IMPORT", id: "integration", reason: "full commerce creation" }); },
    });
    assert.equal(creation.canonicalVersion, "1");
    const product = await client.shopProduct.findUniqueOrThrow({ where: { id: creation.productId }, include: { media: true, options: true, variants: true, metafields: true, collections: true } });
    assert.equal(product.media.length, 2); assert.equal(product.options.length, 1); assert.equal(product.variants.length, 2); assert.equal(product.metafields.length, 1); assert.equal(product.collections.length, 1);
    assert.equal(product.titleUa, "Повний товар"); assert.equal(product.titleEn, "Full product"); assert.equal(product.priceEur?.toString(), "499");
    assert.equal(await client.shopCatalogProductRevision.count({ where: { productId: product.id } }), 1);
    assert.equal(await client.shopCatalogOutbox.count({ where: { productId: product.id } }), 1);
    assert.ok(await client.shopCatalogPublicationReceipt.count({ where: { productId: product.id } }));
  } finally { await client.$disconnect(); }
});
