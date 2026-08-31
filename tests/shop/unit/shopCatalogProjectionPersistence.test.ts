import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import type { ShopCatalogProjectionSource } from "../../../src/lib/shopCatalogProjection.server";
import { normalizeLegacyApplicationsToShopCatalogV2Policy } from "../../../src/lib/shopCatalogV2Compatibility";

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

function source(productId = "product-1", version = "7"): ShopCatalogProjectionSource {
  return {
    productId,
    sourceVersion: version,
    canonicalContentHash: "a".repeat(64),
    canonicalRelationCounts: { variants: 1, applications: 1 },
    slug: `slug-${productId}`,
    sku: `SKU-${productId}`,
    scopeKey: "auto",
    statusKey: "ACTIVE",
    stockKey: "IN_STOCK",
    isPublished: true,
    stableRank: 10,
    brand: { key: "eventuri", labelUa: "Eventuri", labelEn: "Eventuri" },
    locales: {
      ua: { title: `Товар ${productId}` },
      en: { title: `Product ${productId}` },
    },
    variants: [{ variantId: `variant-${productId}`, sku: `V-${productId}`, stableRank: 1 }],
    compatibilityPolicies: [],
  };
}

test("persistence plan maps every compact row and is deterministic", async () => {
  const { buildShopCatalogProjection } = await projectionModule;
  const { planShopCatalogProjectionPersistence } = await persistenceModule;
  const build = buildShopCatalogProjection(source());
  const first = planShopCatalogProjectionPersistence([], build);
  const second = planShopCatalogProjectionPersistence([], build);
  assert.equal(first.decision, "INSERT");
  assert.equal(first.apply, true);
  assert.equal(first.projectionRows.length, 2);
  assert.equal(first.skuRows.length, 2);
  assert.deepEqual(first, second);
});

test("persistence maps domain compatibility dimensions to Prisma enums", async () => {
  const { buildShopCatalogProjection } = await projectionModule;
  const { planShopCatalogProjectionPersistence } = await persistenceModule;
  const input = source();
  input.compatibilityPolicies = [
    normalizeLegacyApplicationsToShopCatalogV2Policy({
      target: { productId: input.productId },
      requiredDimensions: ["make", "bodyStyle", "opfGpf"],
      verification: "VERIFIED",
      applications: [{ id: "mapped-enums", make: "BMW", bodyStyle: "coupe", opfGpf: true }],
    }),
  ];
  const plan = planShopCatalogProjectionPersistence([], buildShopCatalogProjection(input));
  assert.deepEqual(plan.policyRows[0]?.requiredDimensions, ["MAKE", "BODY_STYLE", "OPF_GPF"]);
  const persistedDimensions = new Set(plan.constraintRows.map((row) => row.dimension));
  assert.equal(persistedDimensions.size, 13);
  assert.equal(persistedDimensions.has("MAKE"), true);
  assert.equal(persistedDimensions.has("BODY_STYLE"), true);
  assert.equal(persistedDimensions.has("OPF_GPF"), true);
  assert.equal(persistedDimensions.has("make"), false);
});

test("same version is idempotent only when every locale hash matches", async () => {
  const { buildShopCatalogProjection } = await projectionModule;
  const { planShopCatalogProjectionPersistence } = await persistenceModule;
  const build = buildShopCatalogProjection(source());
  const current = build.projections.map((row) => ({
    locale: row.locale,
    projectionVersion: BigInt(row.projectionVersion),
    contentHash: row.contentHash,
  }));
  assert.equal(planShopCatalogProjectionPersistence(current, build).decision, "IDEMPOTENT");
  assert.equal(
    planShopCatalogProjectionPersistence(
      current.map((row, index) => (index === 0 ? { ...row, contentHash: "b".repeat(64) } : row)),
      build
    ).decision,
    "VERSION_CONFLICT"
  );
});

test("stale versions skip and newer versions apply", async () => {
  const { buildShopCatalogProjection } = await projectionModule;
  const { planShopCatalogProjectionPersistence } = await persistenceModule;
  const current = [{ locale: "ua", projectionVersion: BigInt(8), contentHash: "x" }];
  assert.equal(
    planShopCatalogProjectionPersistence(current, buildShopCatalogProjection(source())).decision,
    "STALE_VERSION"
  );
  assert.equal(
    planShopCatalogProjectionPersistence(
      current,
      buildShopCatalogProjection(source("product-1", "9"))
    ).decision,
    "NEWER_VERSION"
  );
});

test("one rebuild page is bounded, ordered, and exposes a durable cursor", async () => {
  const { rebuildShopCatalogProjectionPage } = await persistenceModule;
  const persisted: string[] = [];
  const result = await rebuildShopCatalogProjectionPage({
    limit: 2,
    source: {
      async loadPage(input) {
        assert.deepEqual(input, { afterProductId: "product-0", limit: 2 });
        return [source("product-2"), source("product-1")];
      },
    },
    afterProductId: "product-0",
    async persist(build) {
      persisted.push(build.productId);
      return {
        productId: build.productId,
        projectionVersion: build.projectionVersion,
        decision: "INSERT",
        applied: true,
        rowCount: build.projections.length + build.skuRecords.length,
      };
    },
  });
  assert.deepEqual(persisted, ["product-1", "product-2"]);
  assert.equal(result.nextCursor, "product-2");
  assert.equal(result.appliedProducts, 2);
  assert.equal(result.batch.productCount, 2);
});

test("rebuild rejects oversized or dishonest source pages", async () => {
  const { rebuildShopCatalogProjectionPage } = await persistenceModule;
  await assert.rejects(
    rebuildShopCatalogProjectionPage({
      limit: 501,
      source: {
        async loadPage() {
          return [];
        },
      },
    }),
    /limit must be between/
  );
  await assert.rejects(
    rebuildShopCatalogProjectionPage({
      limit: 1,
      source: {
        async loadPage() {
          return [source("one"), source("two")];
        },
      },
    }),
    /more rows than requested/
  );
});
