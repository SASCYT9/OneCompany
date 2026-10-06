import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { prisma } from "../../../src/lib/prisma";
import { normalizeLegacyApplicationsToShopCatalogV2Policy } from "../../../src/lib/shopCatalogV2Compatibility";
import { coordinateShopCatalogProductMutation } from "../../../src/lib/shopCatalogMutationCoordinator.server";
import { projectionSourceFromRevision } from "../../../src/lib/shopCatalogProjectionSource.server";
import { buildShopCatalogProjection, type ShopCatalogProjectionSource } from "../../../src/lib/shopCatalogProjection.server";
import { persistShopCatalogPriceProjectionBuild, persistShopCatalogProjectionBuild } from "../../../src/lib/shopCatalogProjectionPersistence.server";
import { publishShopCatalogPriceBatch } from "../../../src/lib/shopCatalogPricePublicationBatch.server";
import { claimShopCatalogOutbox } from "../../../src/lib/shopCatalogOutboxWorker.server";

const url = process.env.MONOBANK_TEST_DATABASE_URL;
test("price publication preserves SKU and fitment rows and rebuilds missed content", { skip: !url }, async () => {
  const target = new URL(url!);
  assert.ok(["localhost", "127.0.0.1"].includes(target.hostname) && target.pathname.startsWith("/monobank_test"));
  assert.equal(process.env.DATABASE_URL, url);
  const id = randomUUID();
  const variantId = randomUUID();
  let version = "0";
  const source = (title: string): ShopCatalogProjectionSource => ({
    productId: id, sourceVersion: "0", catalogVersion: "0", canonicalContentHash: "a".repeat(64),
    canonicalRelationCounts: { variants: 1, applications: 1 },
    slug: id, sku: id, scopeKey: "auto", statusKey: "ACTIVE", stockKey: "IN_STOCK",
    isPublished: false, stableRank: 1, brand: { key: "test", labelUa: "Test", labelEn: "Test" },
    locales: { ua: { title }, en: { title } },
    variants: [{ variantId, sku: variantId, isDefault: true, stableRank: 1 }],
    primaryMedia: { assetId: null, url: "https://example.invalid/synthetic.jpg", width: 100, height: 100, version: null },
    compatibilityPolicies: [normalizeLegacyApplicationsToShopCatalogV2Policy({
      target: { productId: id }, requiredDimensions: ["make", "model", "year"], verification: "VERIFIED",
      applications: [{ id: "synthetic", make: "BMW", model: "M2", yearFrom: 2016, yearTo: 2020 }],
    })],
  });
  const mutate = async (title: string, domain: "CONTENT" | "PRICE") => {
    const result = await coordinateShopCatalogProductMutation({ productId: id,
      expectedCatalogVersion: version, changeDomains: [domain],
      async mutateAndSnapshot(tx) {
        const row = await tx.shopProduct.update({ where: { id }, data: { titleUa: title, titleEn: title, priceEur: Number(version) + 101 } });
        return { canonical: { productId: id, title, price: Number(row.priceEur) },
          projectionSource: source(title), actorType: "TEST", reason: "Synthetic publication" };
      },
    });
    version = result.canonicalVersion;
    const revision = await prisma.shopCatalogProductRevision.findUniqueOrThrow({ where: { productId_version: { productId: id, version: BigInt(version) } } });
    return buildShopCatalogProjection(projectionSourceFromRevision({ productId: id, catalogVersion: revision.version,
      revisionId: revision.id, revisionVersion: revision.version, contentHash: revision.contentHash,
      createdAt: revision.createdAt, snapshot: revision.snapshot }));
  };
  const children = async () => ({
    sku: await prisma.shopCatalogProjectionSku.findMany({ where: { productId: id }, orderBy: { id: "asc" } }),
    policies: await prisma.shopCatalogProjectionPolicy.findMany({ where: { productId: id }, orderBy: { id: "asc" } }),
    clauses: await prisma.shopCatalogProjectionClause.findMany({ where: { productId: id }, orderBy: { id: "asc" } }),
    constraints: await prisma.shopCatalogProjectionConstraint.findMany({ where: { productId: id }, orderBy: { id: "asc" } }),
  });
  try {
    await prisma.shopProduct.create({ data: { id, slug: id, sku: id, titleUa: "Synthetic", titleEn: "Synthetic", isPublished: false,
      variants: { create: { id: variantId, sku: variantId } } } });
    // Legacy baseline has no immutable revision at version zero.
    await persistShopCatalogProjectionBuild(buildShopCatalogProjection(source("Synthetic")));
    const baselineIds = (await children()).sku.map(row => row.id);
    const first = await mutate("Synthetic", "PRICE");
    const firstJob = await prisma.shopCatalogOutbox.findFirstOrThrow({ where: { productId: id, canonicalVersion: BigInt(1) } });
    const firstClaim = await claimShopCatalogOutbox({ workerId: "synthetic-baseline", outboxIds: [firstJob.id], limit: 1 });
    assert.equal((await publishShopCatalogPriceBatch(firstClaim, "synthetic-baseline"))?.length, 1);
    assert.deepEqual((await children()).sku.map(row => row.id), baselineIds);
    await persistShopCatalogProjectionBuild(first);
    const before = await children();
    assert.ok(before.constraints.length > 0);
    const second = await mutate("Synthetic", "PRICE");
    assert.equal((await persistShopCatalogPriceProjectionBuild(second)).applied, true);
    const after = await children();
    for (const key of ["sku", "policies", "clauses", "constraints"] as const) {
      assert.deepEqual(after[key].map(row => row.id), before[key].map(row => row.id));
      assert.ok(after[key].every(row => row.sourceVersion === BigInt(2)));
      const withoutVersion = (row: Record<string, unknown>) => Object.fromEntries(Object.entries(row).filter(([field]) => field !== "sourceVersion"));
      assert.deepEqual(after[key].map(withoutVersion), before[key].map(withoutVersion));
    }
    assert.equal((await persistShopCatalogPriceProjectionBuild(second)).decision, "IDEMPOTENT");
    assert.equal((await persistShopCatalogPriceProjectionBuild(first)).decision, "STALE_VERSION");
    const projected = await prisma.shopCatalogProjection.findMany({ where: { productId: id } });
    assert.ok(projected.every(row => row.sourceVersion === BigInt(2) && row.primaryMediaUrl === "https://example.invalid/synthetic.jpg"));
    await mutate("Synthetic", "PRICE");
    const job = await prisma.shopCatalogOutbox.findFirstOrThrow({ where: { productId: id, canonicalVersion: BigInt(3) } });
    const worker = "synthetic-price-publication";
    const claimed = await claimShopCatalogOutbox({ workerId: worker, outboxIds: [job.id], limit: 1 });
    await assert.rejects(publishShopCatalogPriceBatch(claimed, "wrong-worker"), /lease/);
    const defaultSku = (await children()).sku.find(row => row.isDefault)!;
    await prisma.shopCatalogProjectionSku.update({ where: { id: defaultSku.id }, data: { isDefault: false } });
    assert.equal(await publishShopCatalogPriceBatch(claimed, worker), null, "SKU default mismatch requires a full rebuild");
    assert.equal((await prisma.shopCatalogOutbox.findUniqueOrThrow({ where: { id: job.id } })).status, "PROCESSING");
    await prisma.shopCatalogProjectionSku.update({ where: { id: defaultSku.id }, data: { isDefault: true } });
    const originalTransaction = prisma.$transaction;
    const transaction = originalTransaction.bind(prisma);
    prisma.$transaction = ((
      callback: (tx: Prisma.TransactionClient) => Promise<unknown>,
      options?: { isolationLevel?: Prisma.TransactionIsolationLevel; timeout?: number; maxWait?: number }
    ) => transaction(tx => callback(new Proxy(tx, { get(target, property) {
      if (property === "shopCatalogOutbox") return new Proxy(target.shopCatalogOutbox, { get(model, operation) {
        if (operation === "updateMany") return async () => ({ count: 0 }); // Lease lost at final completion.
        return Reflect.get(model, operation);
      } });
      return Reflect.get(target, property);
    } })), options)) as typeof prisma.$transaction;
    try { await assert.rejects(publishShopCatalogPriceBatch(claimed, worker), /lease expired/); }
    finally { prisma.$transaction = originalTransaction; }
    assert.ok((await prisma.shopCatalogProjection.findMany({ where: { productId: id } })).every(row => row.projectionVersion === BigInt(2)));
    assert.ok((await children()).constraints.every(row => row.sourceVersion === BigInt(2)));
    assert.equal((await prisma.shopProduct.findUniqueOrThrow({ where: { id } })).publishedCatalogVersion, BigInt(1));
    assert.equal((await prisma.shopCatalogPublicationReceipt.findFirstOrThrow({ where: { productId: id, target: "PRICE" } })).appliedVersion, BigInt(1));
    assert.equal((await publishShopCatalogPriceBatch(claimed, worker))?.[0].status, "COMPLETED");
    const batchChildren = await children();
    for (const key of ["sku", "policies", "clauses", "constraints"] as const) {
      assert.deepEqual(batchChildren[key].map(row => row.id), before[key].map(row => row.id));
      assert.ok(batchChildren[key].every(row => row.sourceVersion === BigInt(3)));
    }
    assert.equal((await prisma.shopCatalogPublicationReceipt.findFirstOrThrow({ where: { productId: id, target: "PRICE" } })).appliedVersion, BigInt(3));
    assert.equal((await prisma.shopProduct.findUniqueOrThrow({ where: { id } })).publishedCatalogVersion, BigInt(3));
    await mutate("Changed content", "CONTENT"); // Deliberately unpublished before next PRICE event.
    const fourth = await mutate("Changed content", "PRICE");
    await persistShopCatalogPriceProjectionBuild(fourth);
    assert.ok((await prisma.shopCatalogProjection.findMany({ where: { productId: id } })).every(row => row.title === "Changed content" && row.projectionVersion === BigInt(5)));
    assert.notDeepEqual((await children()).sku.map(row => row.id), before.sku.map(row => row.id));
    await prisma.shopCatalogProjection.deleteMany({ where: { productId: id, locale: "en" } });
    await persistShopCatalogPriceProjectionBuild(await mutate("Changed content", "PRICE"));
    assert.equal(await prisma.shopCatalogProjection.count({ where: { productId: id } }), 2);
  } finally {
    await prisma.shopProduct.updateMany({ where: { id }, data: { isPublished: false } });
    await prisma.$disconnect();
  }
});
