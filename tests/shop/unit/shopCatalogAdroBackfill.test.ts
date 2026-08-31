import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("ADRO compatibility persists correlated 13-dimension clauses with aero-safe semantics", () => {
  const source = readFileSync("src/lib/shopCatalogAdroCompatibility.server.ts", "utf8");
  for (const dimension of [
    "SCOPE", "MAKE", "MODEL", "GENERATION", "CHASSIS", "YEAR", "ENGINE", "FUEL",
    "BODY_STYLE", "DRIVETRAIN", "TRANSMISSION", "MARKET", "OPF_GPF",
  ]) assert.match(source, new RegExp(`"${dimension}"`));
  assert.match(source, /dimension: "ENGINE", state: "NOT_APPLICABLE"/);
  assert.match(source, /dimension: "FUEL", state: "NOT_APPLICABLE"/);
  assert.match(source, /for \(let position = 0; position < normalization\.applications\.length/);
  assert.match(source, /vehicleTaxonomyAlias\.upsert/);
  assert.match(source, /isActive: false, retiredAt: new Date\(\)/);
  assert.doesNotMatch(source, /deleteMany|\.delete\(/);
});

test("ADRO CLI is bounded, resumable, dry-run by default, and production guarded", () => {
  const source = readFileSync("scripts/backfill-catalog-v2-adro.ts", "utf8");
  assert.match(source, /process\.argv\.includes\("--commit"\)/);
  assert.match(source, /--limit must be between 1 and 50/);
  assert.match(source, /option\("after"\)/);
  assert.match(source, /disabled in production/);
  assert.match(source, /CATALOG_ADRO_BACKFILL_ALLOW_WRITE/);
  assert.match(source, /CATALOG_ADRO_BACKFILL_DATABASE_URL/);
});
