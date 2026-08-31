import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { PrismaClient } from "@prisma/client";

const databaseUrl =
  process.env.CATALOG_EPHEMERAL_TEST === "1" ? process.env.OPS_TEST_DATABASE_URL : undefined;
const serverOnlyStub = pathToFileURL(
  path.resolve("tests/shop/unit/fixtures/server-only-stub.cjs")
).href;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") return { url: serverOnlyStub, shortCircuit: true };
    return nextResolve(specifier, context);
  },
});

const reportModule = import("../../../src/lib/shopCatalogSourceCoverageReport.server");

test(
  "per-source coverage report fails closed until payload, provenance, and current binding are complete",
  { skip: !databaseUrl },
  async () => {
    const client = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    const suffix = Date.now().toString();
    const productId = `source-coverage-product-${suffix}`;
    const sourceKey = `source-coverage-${suffix}`;
    try {
      const product = await client.shopProduct.create({
        data: { id: productId, slug: productId, titleUa: productId, titleEn: productId },
      });
      const source = await client.shopCatalogSource.create({
        data: { key: sourceKey, displayName: "Coverage integration", kind: "INTEGRATION" },
      });
      const record = await client.shopCatalogSourceRecord.create({
        data: {
          sourceId: source.id,
          recordKey: "RC-1",
          sourceRevision: "1",
          rawPayload: { sku: "RC-1", engine: "S55", obsolete: false },
          payloadHash: "a".repeat(64),
          productId: product.id,
        },
      });
      const bindingId = randomUUID();
      await client.$transaction(async (tx) => {
        await tx.shopCatalogSourceBinding.create({
          data: {
            id: bindingId,
            sourceId: source.id,
            sourceRecordId: record.id,
            entityType: "PRODUCT",
            externalKey: "RC-1",
            canonicalEntityId: product.id,
            productId: product.id,
            decisionReason: "exact supplier SKU",
          },
        });
        await tx.shopCatalogSourceBindingHead.create({
          data: {
            sourceId: source.id,
            entityType: "PRODUCT",
            externalKey: "RC-1",
            currentBindingId: bindingId,
          },
        });
      });
      await client.shopCatalogFieldProvenance.create({
        data: {
          sourceRecordId: record.id,
          fieldPath: "sku",
          rawValue: "RC-1",
          canonicalEntityType: "PRODUCT",
          canonicalEntityId: product.id,
          canonicalField: "sku",
          normalizedValue: "RC-1",
          mappingStatus: "MAPPED",
          mapperVersion: "integration-v1",
          confidence: 1,
          productId: product.id,
        },
      });
      const { readShopCatalogSourceCoveragePage } = await reportModule;
      const incomplete = await readShopCatalogSourceCoveragePage(client, { sourceKey });
      assert.equal(incomplete?.records[0]?.activationReady, false);
      assert.deepEqual(incomplete?.records[0]?.blockers, ["unaccounted_raw_fields"]);

      await client.shopCatalogFieldProvenance.createMany({
        data: [
          {
            sourceRecordId: record.id,
            fieldPath: "engine",
            rawValue: "S55",
            canonicalEntityType: "PRODUCT",
            canonicalEntityId: product.id,
            canonicalField: "applications.engine",
            normalizedValue: "S55",
            mappingStatus: "MAPPED",
            mapperVersion: "integration-v1",
            confidence: 1,
            productId: product.id,
          },
          {
            sourceRecordId: record.id,
            fieldPath: "obsolete",
            rawValue: false,
            canonicalEntityType: "PRODUCT",
            mappingStatus: "IGNORED_WITH_REASON",
            mapperVersion: "integration-v1",
            confidence: 1,
            reason: "supplier-only historical flag",
            productId: product.id,
          },
        ],
      });
      const complete = await readShopCatalogSourceCoveragePage(client, { sourceKey });
      assert.equal(complete?.complete, true);
      assert.equal(complete?.records[0]?.coveragePercent, 100);
      assert.equal(complete?.records[0]?.activationReady, true);
      assert.equal(complete?.totals.activationReady, 1);
      assert.equal(complete?.totals.missingLeaves, 0);
      assert.equal(complete?.totals.unmappedRecords, 0);
    } finally {
      await client.$disconnect();
    }
  }
);
