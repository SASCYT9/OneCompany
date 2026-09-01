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
const readinessModule = import("../../../src/lib/shopCatalogOperationalReadiness.server");

test("operational readiness fails closed and reports exact projection/outbox state", { skip: !databaseUrl, timeout: 120_000 }, async () => {
  const client = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const prefix = `readiness-${Date.now()}`;
  try {
    const { readShopCatalogOperationalReadinessWithClient } = await readinessModule;
    const empty = await readShopCatalogOperationalReadinessWithClient(client);
    assert.equal(empty.ready, false);
    assert.match(empty.reasons.join(" "), /only 0 products/);

    await client.$executeRawUnsafe(`
      INSERT INTO "ShopProduct" (id, slug, "titleUa", "titleEn", "catalogVersion", "publishedCatalogVersion", "createdAt", "updatedAt")
      SELECT '${prefix}-' || value, '${prefix}-' || value, 'Товар ' || value, 'Product ' || value, 1, 1, NOW(), NOW()
      FROM generate_series(1, 10000) value
    `);
    await client.$executeRawUnsafe(`
      INSERT INTO "ShopCatalogProjection"
        (id, "productId", locale, "sourceVersion", "catalogVersion", "projectionVersion",
         "sourceContentHash", "canonicalRelationHash", "compatibilityHash", slug, "scopeKey",
         "statusKey", "stockKey", "isPublished", "stableRank", "brandKey", "brandLabel", title,
         "searchText", "contentHash", "builtAt", "updatedAt")
      SELECT '${prefix}-projection-' || value || '-' || locale,
             '${prefix}-' || value, locale, 1, 1, 1,
             repeat('a', 64), repeat('b', 64), repeat('c', 64), '${prefix}-' || value, 'auto',
             'ACTIVE', 'IN_STOCK', true, value, 'gate', 'Gate', 'Product ' || value,
             'product ' || value, repeat('d', 64), NOW(), NOW()
      FROM generate_series(1, 10000) value CROSS JOIN (VALUES ('ua'), ('en')) language(locale)
    `);
    const current = await readShopCatalogOperationalReadinessWithClient(client);
    assert.equal(current.ready, true);
    assert.equal(current.projection.currentProducts, 10_000);
    assert.equal(current.projection.missingLocaleProjections, 0);

    await client.shopCatalogOutbox.create({
      data: {
        dedupeKey: `${prefix}-pending`,
        entityType: "SETTINGS",
        entityId: `${prefix}-settings`,
        canonicalVersion: BigInt(1),
        changeDomains: ["SETTINGS"],
        payload: {},
      },
    });
    const blocked = await readShopCatalogOperationalReadinessWithClient(client);
    assert.equal(blocked.ready, false);
    assert.equal(blocked.outbox.backlog, 1);
    assert.match(blocked.reasons.join(" "), /backlog is 1/);
  } finally {
    await client.$disconnect();
  }
});
