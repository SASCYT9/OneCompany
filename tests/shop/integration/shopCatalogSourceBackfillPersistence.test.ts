import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { PrismaClient } from "@prisma/client";

const databaseUrl = process.env.CATALOG_EPHEMERAL_TEST === "1" ? process.env.OPS_TEST_DATABASE_URL : undefined;
const serverOnlyStub = pathToFileURL(path.resolve("tests/shop/unit/fixtures/server-only-stub.cjs")).href;
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return { url: serverOnlyStub, shortCircuit: true };
  return nextResolve(specifier, context);
} });
const backfillModule = import("../../../src/lib/shopCatalogSourceBackfill.server");

test("shared source writer supports true product-level records without synthetic variants", { skip: !databaseUrl }, async () => {
  const client = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const suffix = Date.now().toString();
  const productId = `product-level-source-${suffix}`;
  try {
    await client.shopProduct.create({ data: { id: productId, slug: productId, titleUa: productId, titleEn: productId } });
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
