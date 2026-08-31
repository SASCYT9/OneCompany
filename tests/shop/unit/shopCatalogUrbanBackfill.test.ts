import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
test("Urban uses shared policy persistence and guarded resumable CLI", () => {
  const adapter = readFileSync("src/lib/shopCatalogUrbanCompatibility.server.ts", "utf8");
  const cli = readFileSync("scripts/backfill-catalog-v2-urban.ts", "utf8");
  assert.match(adapter, /persistVehicleCompatibilityInTransaction/); assert.match(adapter, /engineRelevant: input\.normalization\.engineRelevant/);
  assert.match(cli, /--limit must be between 1 and 50/); assert.match(cli, /option\("after"\)/); assert.match(cli, /disabled in production/); assert.match(cli, /CATALOG_URBAN_BACKFILL_ALLOW_WRITE/);
});
