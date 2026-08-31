import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { PrismaClient } from "@prisma/client";

import { normalizeLegacyApplicationsToShopCatalogV2Policy } from "../../../src/lib/shopCatalogV2Compatibility";
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
const suggestionModule = import("../../../src/lib/shopCatalogSuggestion.server");
const publicationStatusModule = import("../../../src/lib/shopCatalogPublicationStatus.server");

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
    compatibilityPolicies: [
      normalizeLegacyApplicationsToShopCatalogV2Policy({
        target: { productId },
        requiredDimensions: ["make", "model", "year"],
        verification: "VERIFIED",
        applications: [
          {
            id: "integration-bmw-m2",
            make: "BMW",
            model: "M2",
            yearFrom: 2016,
            yearTo: 2020,
          },
        ],
      }),
    ],
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
    const { queryShopCatalogProjectionFacets } = await queryModule;
    const { queryShopCatalogSuggestions } = await suggestionModule;
    const { getShopCatalogPublicationStatusWithClient } = await publicationStatusModule;
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
      const savedStatus = await getShopCatalogPublicationStatusWithClient(client, {
        productId,
        version: "2",
      });
      assert.equal(savedStatus?.status, "SAVED");
      assert.deepEqual(savedStatus?.pendingTargets, ["CONTENT", "SEARCH"]);
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
      const publishedStatus = await getShopCatalogPublicationStatusWithClient(client, {
        productId,
        version: "2",
      });
      assert.equal(publishedStatus?.status, "PUBLISHED");
      assert.equal(publishedStatus?.maxVersionLag, "0");
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

      const vehicleQuery = await queryShopCatalogProjection({
        locale: "ua",
        brand: "test",
        make: "BMW",
        model: "M2",
        year: 2019,
        limit: 1,
      });
      assert.equal(vehicleQuery.items.length, 1);
      assert.equal(vehicleQuery.items[0]?.productId, productId);

      const facetResult = await queryShopCatalogProjectionFacets({
        locale: "ua",
        brand: "test",
        make: "BMW",
        model: "M2",
      });
      assert.equal(facetResult.source, "catalog_v2_projection");
      assert.ok(facetResult.facets.brand.some((item) => item.key === "test"));
      assert.ok(facetResult.facets.make.some((item) => item.key === "bmw"));
      assert.ok(facetResult.facets.model.some((item) => item.key === "m2"));
      assert.ok(
        facetResult.facets.year.some(
          (item) => item.yearFrom === 2016 && item.yearTo === 2020 && item.count >= 1
        )
      );

      const suggestions = await queryShopCatalogSuggestions({ locale: "ua", query: "BMW" });
      assert.ok(
        suggestions.some((item) => item.type === "vehicle" && item.make.toLowerCase() === "bmw")
      );
      assert.ok(suggestions.some((item) => item.type === "product" && item.id === productId));

      async function enqueueDrillJob(label: string, maxAttempts: number) {
        const id = `${productId}-${label}`;
        await client.shopProduct.create({
          data: { id, slug: id, titleUa: label, titleEn: label },
        });
        const mutation = await coordinateShopCatalogProductMutation({
          productId: id,
          expectedCatalogVersion: "0",
          changeDomains: ["CONTENT"],
          async mutateAndSnapshot() {
            return {
              canonical: { productId: id, titleUa: label },
              projectionSource: source(id, "0", ` ${label}`),
              actorType: "TEST",
              reason: `outbox drill ${label}`,
            };
          },
        });
        await client.shopCatalogOutbox.update({
          where: { id: mutation.outboxId },
          data: { maxAttempts },
        });
        return mutation;
      }

      const retryMutation = await enqueueDrillJob("retry-recovery", 3);
      const retryWorker = `catalog-retry-${Date.now()}`;
      const retryClaim = (await claimShopCatalogOutbox({ workerId: retryWorker, limit: 10 })).find(
        (job) => job.id === retryMutation.outboxId
      );
      assert.ok(retryClaim);
      const retryResult = await processShopCatalogOutboxJob({
        job: retryClaim,
        workerId: retryWorker,
        handlers: {
          CONTENT: async () => {
            throw new Error("simulated projection outage");
          },
          SEARCH: async () => {},
        },
      });
      assert.equal(retryResult.status, "RETRY");
      assert.equal(
        (
          await getShopCatalogPublicationStatusWithClient(client, {
            productId: retryMutation.productId,
          })
        )?.status,
        "SAVED"
      );
      await client.shopCatalogOutbox.update({
        where: { id: retryMutation.outboxId },
        data: { availableAt: new Date(0) },
      });
      const recoveryWorker = `catalog-recovery-${Date.now()}`;
      const recoveryClaim = (
        await claimShopCatalogOutbox({ workerId: recoveryWorker, limit: 10 })
      ).find((job) => job.id === retryMutation.outboxId);
      assert.ok(recoveryClaim);
      assert.equal(
        (
          await processShopCatalogOutboxJob({
            job: recoveryClaim,
            workerId: recoveryWorker,
            handlers: { CONTENT: async () => {}, SEARCH: async () => {} },
          })
        ).status,
        "COMPLETED"
      );
      const recovered = await client.shopCatalogOutbox.findUniqueOrThrow({
        where: { id: retryMutation.outboxId },
      });
      assert.equal(recovered.attempts, 2);
      assert.equal(recovered.status, "COMPLETED");
      assert.ok(recovered.processedAt);

      const deadMutation = await enqueueDrillJob("dead-letter", 2);
      for (const expectedStatus of ["RETRY", "DEAD_LETTER"] as const) {
        await client.shopCatalogOutbox.update({
          where: { id: deadMutation.outboxId },
          data: { availableAt: new Date(0) },
        });
        const deadWorker = `catalog-dead-${expectedStatus}-${Date.now()}`;
        const deadClaim = (await claimShopCatalogOutbox({ workerId: deadWorker, limit: 10 })).find(
          (job) => job.id === deadMutation.outboxId
        );
        assert.ok(deadClaim);
        const result = await processShopCatalogOutboxJob({
          job: deadClaim,
          workerId: deadWorker,
          handlers: {
            CONTENT: async () => {
              throw new Error("persistent projection outage");
            },
            SEARCH: async () => {},
          },
        });
        assert.equal(result.status, expectedStatus);
      }
      const deadLetter = await client.shopCatalogOutbox.findUniqueOrThrow({
        where: { id: deadMutation.outboxId },
      });
      assert.equal(deadLetter.status, "DEAD_LETTER");
      assert.equal(deadLetter.attempts, 2);
      assert.ok(deadLetter.processedAt);
      const failedStatus = await getShopCatalogPublicationStatusWithClient(client, {
        productId: deadMutation.productId,
      });
      assert.equal(failedStatus?.status, "FAILED");
      assert.match(failedStatus?.lastError ?? "", /persistent projection outage/);
      const failedReceipts = await client.shopCatalogPublicationReceipt.findMany({
        where: { productId: deadMutation.productId },
        orderBy: { target: "asc" },
      });
      assert.deepEqual(
        failedReceipts.map((receipt) => ({
          target: receipt.target,
          status: receipt.status,
          failedVersion: receipt.failedVersion,
        })),
        [
          { target: "CONTENT", status: "FAILED", failedVersion: BigInt(1) },
          { target: "SEARCH", status: "SAVED", failedVersion: null },
        ]
      );
      assert.equal(
        await client.shopCatalogProductRevision.count({
          where: { productId: deadMutation.productId },
        }),
        1
      );

      const leaseMutation = await enqueueDrillJob("lost-lease", 3);
      await client.shopCatalogOutbox.update({
        where: { id: leaseMutation.outboxId },
        data: { availableAt: new Date(0) },
      });
      const staleWorker = `catalog-stale-lease-${Date.now()}`;
      const staleClaim = (
        await claimShopCatalogOutbox({
          workerId: staleWorker,
          limit: 10,
          now: new Date(Date.now() - 120_000),
          leaseMs: 1_000,
        })
      ).find((job) => job.id === leaseMutation.outboxId);
      assert.ok(staleClaim);
      assert.equal(
        (
          await processShopCatalogOutboxJob({
            job: staleClaim,
            workerId: staleWorker,
            handlers: { CONTENT: async () => {}, SEARCH: async () => {} },
          })
        ).status,
        "LOST_LEASE"
      );
      const reclaimWorker = `catalog-reclaimed-${Date.now()}`;
      const reclaimed = (await claimShopCatalogOutbox({ workerId: reclaimWorker, limit: 10 })).find(
        (job) => job.id === leaseMutation.outboxId
      );
      assert.ok(reclaimed);
      assert.equal(
        (
          await processShopCatalogOutboxJob({
            job: reclaimed,
            workerId: reclaimWorker,
            handlers: { CONTENT: async () => {}, SEARCH: async () => {} },
          })
        ).status,
        "COMPLETED"
      );

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
        await client.shopCatalogPublicationReceipt.count({
          where: { productId: createdProductId },
        }),
        creation.projectionTargets.length
      );
    } finally {
      await client.$disconnect();
    }
  }
);
