import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("Catalog V2 readiness endpoint is authorized, dynamic, and uncached", () => {
  const source = fs.readFileSync(new URL("../../../src/app/api/admin/shop/catalog-v2-readiness/route.ts", import.meta.url), "utf8");
  assert.match(source, /SHOP_PRODUCTS_READ/);
  assert.match(source, /assertAdminRequest/);
  assert.match(source, /private, no-store/);
  assert.match(source, /dynamic = "force-dynamic"/);
  assert.match(source, /readShopCatalogOperationalReadinessWithClient/);
});

test("operational readiness covers backlog, age, retries, dead letters, receipts, lag, and shadow", () => {
  const source = fs.readFileSync(new URL("../../../src/lib/shopCatalogOperationalReadiness.server.ts", import.meta.url), "utf8");
  for (const contract of ["oldestBacklogAgeMs", "retryAttempts", "deadLetter", "failedReceipts", "missingLocaleProjections", "maxVersionLag", "publishedProducts < 10_000", "shadow"]) {
    assert.match(source, new RegExp(contract));
  }
});
