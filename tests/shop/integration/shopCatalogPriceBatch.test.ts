import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import { coordinateShopCatalogPriceBatchInTransaction, type ShopPriceBatchEntry } from "../../../src/lib/shopCatalogPriceBatch.server";
import { buildShopCatalogAdminSnapshot } from "../../../src/lib/shopCatalogAdminSnapshot.server";
import { coordinateShopCatalogProductMutationInTransaction } from "../../../src/lib/shopCatalogMutationCoordinator.server";
import { projectionSourceFromRevision } from "../../../src/lib/shopCatalogProjectionSource.server";
import { buildShopCatalogProjection } from "../../../src/lib/shopCatalogProjection.server";
import { persistShopCatalogPriceProjectionBuild, persistShopCatalogProjectionBuild } from "../../../src/lib/shopCatalogProjectionPersistence.server";
import { publishShopCatalogPriceBatch } from "../../../src/lib/shopCatalogPricePublicationBatch.server";
import { claimShopCatalogOutbox, processShopCatalogOutboxJob } from "../../../src/lib/shopCatalogOutboxWorker.server";

const url = process.env.MONOBANK_TEST_DATABASE_URL;
test("price batch preserves complete canonical state, rolls back stale input, and uses fewer queries", { skip: !url }, async () => {
  const target = new URL(url!);
  assert.ok(["localhost", "127.0.0.1"].includes(target.hostname) && target.pathname.startsWith("/monobank_test"));
  const db = new PrismaClient({ datasources: { db: { url } }, log: [{ emit: "event", level: "query" }] });
  let queryCount = 0;
  db.$on("query", () => { queryCount++; });
  const ids = Array.from({ length: 10 }, () => randomUUID());
  const actor = { type: "system", id: "test-price-batch", reason: "Synthetic only" };
  try {
    for (const id of ids) await db.shopProduct.create({ data: {
      id, slug: id, sku: id, titleUa: "Synthetic", titleEn: "Synthetic", brand: "Urban Automotive", tags: ["retained"],
      isPublished: false, priceEur: 100, priceSourceCurrency: "EUR",
      longDescUa: "Retain original description", priceEurEurope: 123,
      media: { create: { src: "https://example.invalid/synthetic.jpg", position: 1 } },
      options: { create: { name: "Synthetic option", position: 1, values: ["retained"] } },
      metafields: { create: { namespace: "test", key: "retained", value: "original" } },
      variants: { create: [{ sku: id + "-priced", position: 1, priceEur: 50, priceSourceCurrency: "EUR", inventoryQty: 7 }, { sku: id + "-inherited", position: 2 }] },
    } });
    const before = await db.shopProduct.findMany({ where: { id: { in: ids } }, include: { variants: true, media: true, options: true, metafields: true } });
    const entries: ShopPriceBatchEntry[] = before.map(row => ({
      catalogVersion: row.catalogVersion.toString(),
      product: { id: row.id, sku: row.sku, before: { priceEur: 100, priceSourceCurrency: "EUR" }, after: { priceEur: 101, priceSourceCurrency: "EUR" } },
      variants: row.variants.map(variant => ({ id: variant.id, sku: variant.sku, before: { priceEur: variant.priceEur == null ? null : Number(variant.priceEur), priceSourceCurrency: variant.priceSourceCurrency }, after: variant.priceEur == null ? {} : { priceEur: 51 } })),
    }));
    const stale = structuredClone(entries);
    stale[9].catalogVersion = "99";
    await assert.rejects(db.$transaction(tx => coordinateShopCatalogPriceBatchInTransaction(tx, stale, actor), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }), /version changed/);
    assert.equal(await db.shopCatalogProductRevision.count({ where: { productId: { in: ids } } }), 0);
    assert.ok((await db.shopProduct.findMany({ where: { id: { in: ids } } })).every(row => Number(row.priceEur) === 100));
    await assert.rejects(db.$transaction(async tx => {
      const failReceipt = new Proxy(tx, { get(target, property) {
        if (property === "$executeRaw") return async (query: Prisma.Sql) => {
          if (query.text.includes('INSERT INTO "ShopCatalogPublicationReceipt"')) throw new Error("Injected publication failure");
          return target.$executeRaw(query);
        };
        return Reflect.get(target, property);
      } });
      return coordinateShopCatalogPriceBatchInTransaction(failReceipt, entries, actor);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 120000 }), /Injected publication failure/);
    assert.equal(await db.shopCatalogProductRevision.count({ where: { productId: { in: ids } } }), 0);
    assert.equal(await db.shopCatalogOutbox.count({ where: { productId: { in: ids } } }), 0);
    assert.ok((await db.shopProduct.findMany({ where: { id: { in: ids } } })).every(row => row.catalogVersion === BigInt(0) && Number(row.priceEur) === 100));
    queryCount = 0;
    const result = await db.$transaction(tx => coordinateShopCatalogPriceBatchInTransaction(tx, entries, actor), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 120000 });
    const bulkQueries = queryCount;
    assert.equal(result.length, 10);
    const after = await db.shopProduct.findMany({ where: { id: { in: ids } }, include: { variants: true, media: true, options: true, metafields: true } });
    for (const row of after) {
      assert.equal(row.catalogVersion, BigInt(1)); assert.equal(Number(row.priceEur), 101); assert.equal(Number(row.priceEurEurope), 123);
      assert.equal(row.longDescUa, "Retain original description"); assert.deepEqual(row.tags, ["retained"]);
      assert.equal(row.variants.find(variant => variant.position === 2)!.priceEur, null);
      assert.equal(row.variants.find(variant => variant.position === 1)!.inventoryQty, 7);
      assert.equal(row.media[0].id, before.find(original => original.id === row.id)!.media[0].id);
    }
    const revisions = await db.shopCatalogProductRevision.findMany({ where: { productId: { in: ids } } });
    assert.equal(revisions.length, 10);
    for (const revision of revisions) {
      const snapshot = revision.snapshot as unknown as { canonical: { product: { priceEur: string; options: unknown[]; metafields: unknown[] } } };
      assert.equal(Number(snapshot.canonical.product.priceEur), 101); assert.equal(snapshot.canonical.product.options.length, 1); assert.equal(snapshot.canonical.product.metafields.length, 1);
      await persistShopCatalogProjectionBuild(buildShopCatalogProjection(projectionSourceFromRevision({ productId: revision.productId, catalogVersion: revision.version, revisionId: revision.id, revisionVersion: revision.version, contentHash: revision.contentHash, createdAt: revision.createdAt, snapshot: revision.snapshot })));
    }
    assert.equal(await db.shopCatalogOutbox.count({ where: { id: { in: result.map(row => row.outboxId) } } }), 10);
    queryCount = 0;
    await db.$transaction(async tx => {
      for (const row of after) await coordinateShopCatalogProductMutationInTransaction(tx, { productId: row.id, expectedCatalogVersion: "1", changeDomains: ["PRICE"], mutateAndSnapshot: async (client, version) => {
        await client.shopProduct.update({ where: { id: row.id }, data: { priceEur: 102 } });
        return buildShopCatalogAdminSnapshot(client, row.id, version, actor);
      } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 120000 });
    const legacyQueries = queryCount;
    assert.ok(bulkQueries < legacyQueries / 2, `batch ${bulkQueries} queries vs individual ${legacyQueries}`);
    console.log(JSON.stringify({ bulkQueries, legacyQueries, reduction: legacyQueries / bulkQueries }));
    const jobs = await db.shopCatalogOutbox.findMany({ where: { productId: { in: ids }, canonicalVersion: BigInt(2) }, select: { id: true } });
    const worker = "synthetic-ten-price-publication";
    const claimed = await claimShopCatalogOutbox({ workerId: worker, outboxIds: jobs.map(job => job.id), limit: 10 });
    await db.shopCatalogProjection.deleteMany({ where: { productId: { in: [ids[0], ids[5]] }, locale: "en" } });
    const parallel = await Promise.all([
      publishShopCatalogPriceBatch(claimed.slice(0, 5), worker),
      publishShopCatalogPriceBatch(claimed.slice(5), worker),
    ]);
    const published = parallel.flatMap(batch => batch ?? []);
    assert.equal(published?.length, 8);
    assert.ok(published?.every(row => row.status === "COMPLETED"));
    const fallbacks = claimed.filter(job => [ids[0], ids[5]].some(id => id === job.productId));
    const recovered = await Promise.all(fallbacks.map(async fallback => {
      assert.equal((await db.shopCatalogOutbox.findUniqueOrThrow({ where: { id: fallback.id } })).status, "PROCESSING");
      return processShopCatalogOutboxJob({ job: fallback, workerId: worker, handlers: { PRICE: async ({ job }) => {
      const revision = job.revision!;
      await persistShopCatalogPriceProjectionBuild(buildShopCatalogProjection(projectionSourceFromRevision({ productId: revision.productId,
        catalogVersion: revision.version, revisionId: revision.id, revisionVersion: revision.version, contentHash: revision.contentHash,
        createdAt: revision.createdAt, snapshot: revision.snapshot })));
      } } });
    }));
    assert.ok(recovered.every(result => result.status === "COMPLETED"));
    assert.equal(await db.shopCatalogOutbox.count({ where: { id: { in: jobs.map(job => job.id) }, status: "COMPLETED" } }), 10);
    assert.equal(await db.shopCatalogPublicationReceipt.count({ where: { productId: { in: ids }, target: "PRICE", status: "PUBLISHED", appliedVersion: BigInt(2) } }), 10);
    await assert.rejects(db.$transaction(tx => coordinateShopCatalogPriceBatchInTransaction(tx, entries, actor), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }), /version changed/);
    const bad = structuredClone(entries); bad[0].product.after.stock = "IN_STOCK";
    await assert.rejects(db.$transaction(tx => coordinateShopCatalogPriceBatchInTransaction(tx, bad, actor)), /Unexpected price write/);
  } finally {
    await db.shopProduct.updateMany({ where: { id: { in: ids } }, data: { isPublished: false } });
    await db.$disconnect();
  }
});
