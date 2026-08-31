import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Brabus uses shared vehicle persistence with engine-safe review semantics", () => {
  const source = readFileSync("src/lib/shopCatalogBrabusCompatibility.server.ts", "utf8");
  assert.match(source, /persistVehicleCompatibilityInTransaction/);
  assert.match(source, /engineRelevant: input\.normalization\.engineRelevant/);
  assert.match(source, /engineCode: null/);
  assert.match(source, /fuel: null/);
});

test("Brabus CLI is bounded, resumable, dry-run by default, and production guarded", () => {
  const source = readFileSync("scripts/backfill-catalog-v2-brabus.ts", "utf8");
  assert.match(source, /process\.argv\.includes\("--commit"\)/);
  assert.match(source, /--limit must be between 1 and 50/);
  assert.match(source, /option\("after"\)/);
  assert.match(source, /disabled in production/);
  assert.match(source, /CATALOG_BRABUS_BACKFILL_ALLOW_WRITE/);
});
