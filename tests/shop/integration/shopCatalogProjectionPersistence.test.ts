import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { PrismaClient } from "@prisma/client";

import type { ShopCatalogProjectionSource } from "../../../src/lib/shopCatalogProjection.server";

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

const projectionModule = import("../../../src/lib/shopCatalogProjection.server");
const persistenceModule = import("../../../src/lib/shopCatalogProjectionPersistence.server");
const queryModule = import("../../../src/lib/shopCatalogProjectionQuery.server");
const sourceModule = import("../../../src/lib/shopCatalogProjectionSource.server");
const mutationModule = import("../../../src/lib/shopCatalogMutationCoordinator.server");
const outboxModule = import("../../../src/lib/shopCatalogOutboxWorker.server");
const checkpointModule = import("../../../src/lib/shopCatalogRebuildCheckpoint.server");

function source(productId: string, version: string, titleSuffix = ""): ShopCatalogProjectionSource {
  return {
    productId,
    sourceVersion: version,
    catalogVersion: version,
    canonicalContentHash: "a".repeat(64),
    canonicalRelationCounts: { variants: 0, applications: 0 },
    slug: `projection-integration-${productId}`,
    sku: `PERSIST-${productId}`,
    scopeKey: "auto",
    statusKey: "ACTIVE",
    stockKey: "IN_STOCK",
    isPublished: true,
    stableRank: 1,
    brand: { key: "test", labelUa: "Тест", labelEn: "Test" },
    locales: {
      ua: { title: `Тестовий товар${titleSuffix}` },
      en: { title: `Test product${titleSuffix}` },
    },
  };
}

test(
  "projection persistence is atomic, monotonic, and idempotent in PostgreSQL",
  { skip: !databaseUrl },
  async () => {
    const client = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    const productId = `projection-integration-${Date.now()}`;
    const { buildShopCatalogProjection } = await projectionModule;
    const { persistShopCatalogProjectionBuild } = await persistenceModule;
    const { queryShopCatalogProjection } = await queryModule;
    const { RevisionBackedShopCatalogProjectionSource } = await sourceModule;
    const { coordinateShopCatalogProductCreation, coordinateShopCatalogProductMutation } =
      await mutationModule;
    const { claimShopCatalogOutbox, processShopCatalogOutboxJob } = await outboxModule;
    const { startShopCatalogRebuildCheckpoint, runCheckpointedShopCatalogRebuildPage } =
      await checkpointModule;
    try {
      await client.shopProduct.create({
        data: {
          id: productId,
          slug: productId,
          titleUa: "Projection integration",
          titleEn: "Projection integration",
        },
      });

      const firstMutation = await coordinateShopCatalogProductMutation({
        productId,
        expectedCatalogVersion: "0",
        changeDomains: ["CONTENT", "FITMENT"],
        async mutateAndSnapshot(tx) {
          const projectionSource = source(productId, "0");
          await tx.shopProduct.update({
            where: { id: productId },
            data: {
              slug: projectionSource.slug,
              titleUa: projectionSource.locales.ua.title,
              titleEn: projectionSource.locales.en.title,
            },
          });
          return {
            canonical: { productId, titleUa: projectionSource.locales.ua.title },
            projectionSource,
            actorType: "TEST",
            reason: "integration v1",
          };
        },
      });
      assert.equal(firstMutation.canonicalVersion, "1");
      const revisionSource = new RevisionBackedShopCatalogProjectionSource();
      const firstSource = (await revisionSource.loadPage({ afterProductId: null, limit: 10 })).find(
        (item) => item.productId === productId
      );
      assert.ok(firstSource);
      const first = buildShopCatalogProjection(firstSource);
      assert.equal((await persistShopCatalogProjectionBuild(first)).decision, "INSERT");
      assert.equal((await persistShopCatalogProjectionBuild(first)).decision, "IDEMPOTENT");

      const secondMutation = await coordinateShopCatalogProductMutation({
        productId,
        expectedCatalogVersion: "1",
        changeDomains: ["CONTENT"],
        async mutateAndSnapshot(tx) {
          const projectionSource = source(productId, "0", " v2");
          await tx.shopProduct.update({
            where: { id: productId },
            data: {
              titleUa: projectionSource.locales.ua.title,
              titleEn: projectionSource.locales.en.title,
            },
          });
          return {
            canonical: { productId, titleUa: projectionSource.locales.ua.title },
            projectionSource,
            actorType: "TEST",
            reason: "integration v2",
          };
        },
      });
      assert.equal(secondMutation.canonicalVersion, "2");
      await assert.rejects(
        coordinateShopCatalogProductMutation({
          productId,
          expectedCatalogVersion: "0",
          changeDomains: ["CONTENT"],
          async mutateAndSnapshot() {
            throw new Error("must not run after a version conflict");
          },
        }),
        /version conflict/
      );
      const currentSource = (
        await revisionSource.loadPage({ afterProductId: null, limit: 10 })
      ).find((item) => item.productId === productId);
      assert.ok(currentSource);
      const newer = buildShopCatalogProjection(currentSource);

      const rebuildRunId = `rebuild-${Date.now()}`;
      await startShopCatalogRebuildCheckpoint({ runId: rebuildRunId });
      const rebuilt = await runCheckpointedShopCatalogRebuildPage({
        runId: rebuildRunId,
        source: revisionSource,
        limit: 10,
      });
      assert.equal(rebuilt.checkpoint.status, "RUNNING");
      assert.equal(rebuilt.checkpoint.pageCount, 1);
      assert.equal(rebuilt.checkpoint.productCount, "1");
      const completedRebuild = await runCheckpointedShopCatalogRebuildPage({
        runId: rebuildRunId,
        source: revisionSource,
        limit: 10,
      });
      assert.equal(completedRebuild.checkpoint.status, "COMPLETED");

      const workerId = `catalog-integration-${Date.now()}`;
      const jobs = await claimShopCatalogOutbox({ workerId, limit: 10 });
      assert.equal(jobs.length, 2);
      const projectionHandler = async ({ job }: { job: (typeof jobs)[number] }) => {
        assert.ok(job.revision);
        const revisionProjectionSource = (await sourceModule).projectionSourceFromRevision({
          productId: job.revision.productId,
          catalogVersion: job.revision.version,
          revisionId: job.revision.id,
          revisionVersion: job.revision.version,
          contentHash: job.revision.contentHash,
          createdAt: job.revision.createdAt,
          snapshot: job.revision.snapshot,
        });
        await persistShopCatalogProjectionBuild(
          buildShopCatalogProjection(revisionProjectionSource)
        );
      };
      for (const job of jobs) {
        const result = await processShopCatalogOutboxJob({
          job,
          workerId,
          handlers: { CONTENT: projectionHandler, SEARCH: projectionHandler },
        });
        assert.equal(result.status, "COMPLETED");
      }
      assert.equal((await persistShopCatalogProjectionBuild(newer)).decision, "IDEMPOTENT");
      assert.equal((await persistShopCatalogProjectionBuild(first)).decision, "STALE_VERSION");

      const rows = await client.shopCatalogProjection.findMany({
        where: { productId },
        orderBy: { locale: "asc" },
      });
      assert.equal(rows.length, 2);
      assert.deepEqual(
        rows.map((row) => row.projectionVersion),
        [BigInt(2), BigInt(2)]
      );
      assert.ok(rows.every((row) => row.title.endsWith("v2")));

      assert.equal(await client.shopCatalogProductRevision.count({ where: { productId } }), 2);
      assert.equal(
        await client.shopCatalogOutbox.count({ where: { productId, status: "COMPLETED" } }),
        2
      );
      const receipts = await client.shopCatalogPublicationReceipt.findMany({
        where: { productId },
        orderBy: { target: "asc" },
      });
      assert.deepEqual(
        receipts.map((receipt) => receipt.target),
        ["CONTENT", "SEARCH"]
      );
      assert.ok(
        receipts.every(
          (receipt) => receipt.status === "PUBLISHED" && receipt.appliedVersion === BigInt(2)
        )
      );

      const query = await queryShopCatalogProjection({
        locale: "ua",
        brand: "test",
        text: "v2",
        limit: 1,
      });
      assert.equal(query.source, "catalog_v2_projection");
      assert.equal(query.items.length, 1);
      assert.equal(query.items[0]?.productId, productId);
      assert.equal(query.items[0]?.projectionVersion, "2");

      const createdProductId = `${productId}-created`;
      const creation = await coordinateShopCatalogProductCreation({
        changeDomains: ["CONTENT", "PRICE", "INVENTORY", "FITMENT", "VISIBILITY"],
        async create(tx) {
          const created = await tx.shopProduct.create({
            data: {
              id: createdProductId,
              slug: createdProductId,
              titleUa: "Atomic creation",
              titleEn: "Atomic creation",
            },
            select: { id: true },
          });
          return created.id;
        },
        async snapshot(_tx, id, version) {
          return {
            canonical: { productId: id, titleUa: "Atomic creation", catalogVersion: version },
            projectionSource: source(id, version, " created"),
            actorType: "TEST",
            reason: "integration create",
          };
        },
      });
      assert.equal(creation.previousVersion, "0");
      assert.equal(creation.canonicalVersion, "1");
      const createdAggregate = await client.shopProduct.findUniqueOrThrow({
        where: { id: createdProductId },
        select: { catalogVersion: true },
      });
      assert.equal(createdAggregate.catalogVersion, BigInt(1));
      assert.equal(
        await client.shopCatalogProductRevision.count({ where: { productId: createdProductId } }),
        1
      );
      assert.equal(
        await client.shopCatalogOutbox.count({ where: { productId: createdProductId } }),
        1
      );
      assert.equal(
        await client.shopCatalogPublicationReceipt.count({ where: { productId: createdProductId } }),
        creation.projectionTargets.length
      );
    } finally {
      await client.$disconnect();
    }
  }
);
