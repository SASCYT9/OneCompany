import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
test("Akrapovic uses scope-aware shared persistence and guarded CLI", () => {
  const adapter = readFileSync("src/lib/shopCatalogAkrapovicCompatibility.server.ts", "utf8"), cli = readFileSync("scripts/backfill-catalog-v2-akrapovic.ts", "utf8");
  assert.match(adapter, /scope: normalization\.scope/); assert.match(adapter, /persistVehicleCompatibilityInTransaction/);
  assert.match(cli, /--limit must be between 1 and 50/); assert.match(cli, /option\("after"\)/); assert.match(cli, /disabled in production/); assert.match(cli, /CATALOG_AKRAPOVIC_BACKFILL_ALLOW_WRITE/);
});
