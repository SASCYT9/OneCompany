import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Eventuri persistence supports universal, exact-engine, and review-only policies", () => {
  const source = readFileSync("src/lib/shopCatalogEventuriCompatibility.server.ts", "utf8");
  assert.match(source, /policyMode === "UNIVERSAL"/);
  assert.match(source, /powertrainId: item\.powertrain\.id/);
  assert.match(source, /dimension: "ENGINE", state: "UNKNOWN"/);
  assert.match(source, /dimension: "ENGINE", state: "NOT_APPLICABLE"/);
  assert.match(source, /dimension: "FUEL", state: "EXACT"/);
  assert.match(source, /normalization\.applications\.length/);
  assert.doesNotMatch(source, /deleteMany|\.delete\(/);
});

test("Eventuri CLI is bounded, resumable, dry-run by default, and production guarded", () => {
  const source = readFileSync("scripts/backfill-catalog-v2-eventuri.ts", "utf8");
  assert.match(source, /process\.argv\.includes\("--commit"\)/);
  assert.match(source, /--limit must be between 1 and 50/);
  assert.match(source, /option\("after"\)/);
  assert.match(source, /disabled in production/);
  assert.match(source, /CATALOG_EVENTURI_BACKFILL_ALLOW_WRITE/);
});
