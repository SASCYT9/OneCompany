import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("global catalog mutations own monotonic settings and price-book versions", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const migration = readFileSync(
    "prisma/migrations/20260901010000_add_catalog_global_versions/migration.sql",
    "utf8"
  );
  const coordinator = readFileSync(
    "src/lib/shopCatalogGlobalMutationCoordinator.server.ts",
    "utf8"
  );
  assert.match(schema, /model ShopCatalogGlobalVersion/);
  assert.match(migration, /ShopCatalogGlobalVersion_non_product_check/);
  assert.match(migration, /ShopCatalogGlobalVersion_no_delete/);
  assert.match(coordinator, /FOR UPDATE/);
  assert.match(coordinator, /TransactionIsolationLevel\.Serializable/);
  assert.match(coordinator, /error\.code === "P2034"/);
  assert.match(coordinator, /error\.meta\.code === "40001"/);
  assert.match(coordinator, /shopCatalogOutbox\.create/);
  assert.match(coordinator, /shopCatalogPublicationReceipt\.upsert/);
});

test("every live ShopSettings writer publishes and legacy hardcoded rates fail closed", () => {
  const shopSettings = readFileSync("src/app/api/admin/shop/settings/route.ts", "utf8");
  const appSettings = readFileSync("src/app/api/admin/settings/app/route.ts", "utf8");
  const nbu = readFileSync("src/app/api/admin/shop/settings/currency-rates/nbu/route.ts", "utf8");
  const legacy = readFileSync("scripts/update-db-currency-rates.ts", "utf8");
  for (const route of [shopSettings, appSettings, nbu]) {
    assert.match(route, /coordinateShopCatalogGlobalMutationWithClient/);
    assert.match(route, /runShopCatalogOutboxRuntime/);
    assert.match(route, /revalidateTag\("shop-settings"/);
  }
  assert.match(legacy, /Disabled legacy hardcoded currency writer/);
  assert.ok(
    legacy.indexOf("Disabled legacy hardcoded currency writer") < legacy.indexOf("new PrismaClient")
  );
});

test("global outbox events acknowledge canonical state without product projection fanout", () => {
  const runtime = readFileSync("src/lib/shopCatalogOutboxRuntime.server.ts", "utf8");
  assert.match(runtime, /job\.entityType !== "PRODUCT"/);
  assert.match(runtime, /acknowledgeCanonicalGlobalState/);
  assert.match(runtime, /PRICE: acknowledgeCanonicalGlobalState/);
  assert.match(runtime, /SETTINGS: acknowledgeCanonicalGlobalState/);
});

test("local catalog recovery validates and atomically installs fallback and query indexes", () => {
  const recovery = readFileSync("scripts/fetch-local-catalog-fallback.mjs", "utf8");
  assert.match(recovery, /fetchJson\("catalog-fallback", "manifest\.json"\)/);
  assert.match(recovery, /fetchJson\("catalog-index", "manifest\.json"\)/);
  assert.match(recovery, /products\.length !== entry\.count/g);
  assert.match(recovery, /fs\.renameSync\(temporaryDir, targetDir\)/);
  assert.match(recovery, /fs\.renameSync\(temporaryIndexDir, targetIndexDir\)/);
  assert.ok(
    recovery.indexOf("fs.renameSync(temporaryDir, targetDir)") >
      recovery.indexOf("for (const [key, entry] of Object.entries(indexManifest.indexes))")
  );
});
