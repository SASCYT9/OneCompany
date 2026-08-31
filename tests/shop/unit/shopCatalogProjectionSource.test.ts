import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import type { Prisma } from "@prisma/client";

import type { ShopCatalogProjectionSource } from "../../../src/lib/shopCatalogProjection.server";
import type { ShopCatalogProjectionRevisionRow } from "../../../src/lib/shopCatalogProjectionSource.server";

const serverOnlyStub = pathToFileURL(
  path.resolve("tests/shop/unit/fixtures/server-only-stub.cjs")
).href;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") return { url: serverOnlyStub, shortCircuit: true };
    return nextResolve(specifier, context);
  },
});

const sourceModule = import("../../../src/lib/shopCatalogProjectionSource.server");

function derivative(productId: string): ShopCatalogProjectionSource {
  return {
    productId,
    sourceVersion: "999",
    canonicalContentHash: "b".repeat(64),
    canonicalRelationCounts: { variants: 0 },
    slug: productId,
    scopeKey: "auto",
    statusKey: "ACTIVE",
    stockKey: "IN_STOCK",
    isPublished: true,
    stableRank: 1,
    brand: { key: "test", labelUa: "Тест", labelEn: "Test" },
    locales: { ua: { title: "Товар" }, en: { title: "Product" } },
  };
}

function row(productId: string, version = BigInt(3)): ShopCatalogProjectionRevisionRow {
  return {
    productId,
    catalogVersion: version,
    revisionId: `revision-${productId}`,
    revisionVersion: version,
    contentHash: "a".repeat(64),
    createdAt: new Date("2026-08-31T12:00:00.000Z"),
    snapshot: JSON.parse(
      JSON.stringify({
        schemaVersion: 1,
        canonical: { everyExistingField: "preserved outside the compact projection" },
        projectionSource: derivative(productId),
      })
    ) as Prisma.JsonValue,
  };
}

test("revision ledger overrides derivative identity, version, timestamp, and hash", async () => {
  const { projectionSourceFromRevision } = await sourceModule;
  const source = projectionSourceFromRevision(row("product-1"));
  assert.equal(source.productId, "product-1");
  assert.equal(source.sourceVersion, "3");
  assert.equal(source.catalogVersion, "3");
  assert.equal(source.canonicalContentHash, "a".repeat(64));
  assert.equal(source.sourceUpdatedAt, "2026-08-31T12:00:00.000Z");
});

test("missing lossless payload, exact revision, or projection derivative fails closed", async () => {
  const { projectionSourceFromRevision } = await sourceModule;
  assert.throws(
    () => projectionSourceFromRevision({ ...row("product-1"), revisionId: null }),
    /no exact immutable revision/
  );
  assert.throws(
    () =>
      projectionSourceFromRevision({
        ...row("product-1"),
        snapshot: JSON.parse(
          JSON.stringify({ schemaVersion: 1, projectionSource: derivative("product-1") })
        ) as Prisma.JsonValue,
      }),
    /canonical payload/
  );
  assert.throws(
    () =>
      projectionSourceFromRevision({
        ...row("product-1"),
        revisionVersion: BigInt(2),
      }),
    /expected 3/
  );
});

test("revision-backed pages are bounded and strictly ordered", async () => {
  const { RevisionBackedShopCatalogProjectionSource } = await sourceModule;
  const source = new RevisionBackedShopCatalogProjectionSource({
    async loadRows(input) {
      assert.deepEqual(input, { afterProductId: null, limit: 2 });
      return [row("product-1"), row("product-2")];
    },
  });
  assert.deepEqual(
    (await source.loadPage({ afterProductId: null, limit: 2 })).map((item) => item.productId),
    ["product-1", "product-2"]
  );

  const unordered = new RevisionBackedShopCatalogProjectionSource({
    async loadRows() {
      return [row("product-2"), row("product-1")];
    },
  });
  await assert.rejects(
    unordered.loadPage({ afterProductId: null, limit: 2 }),
    /strictly increasing/
  );
});
