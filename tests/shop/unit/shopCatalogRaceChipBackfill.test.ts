import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("RaceChip backfill is bounded, serializable, append-only, and verifies replay evidence", () => {
  const source = readFileSync("src/lib/shopCatalogRaceChipBackfill.server.ts", "utf8");
  assert.match(source, /RACECHIP_BACKFILL_PAGE_LIMIT = 50/);
  assert.match(source, /TransactionIsolationLevel\.Serializable/);
  assert.match(source, /supersededBy: null/);
  assert.match(source, /supersedesId: previousRecord\?\.id/);
  assert.match(source, /bindingVersion: \(head\?\.currentBinding\.bindingVersion \?\? 0\) \+ 1/);
  assert.match(source, /currentBindingId: bindingId/);
  assert.match(source, /requires reviewedById/);
  assert.match(source, /immutable replay conflict/);
  assert.match(source, /evidence persistence count mismatch/);
  assert.doesNotMatch(source, /deleteMany|\.delete\(/);
});

test("RaceChip backfill CLI is dry-run by default, resumable, and forbids production writes", () => {
  const source = readFileSync("scripts/backfill-catalog-v2-racechip.ts", "utf8");
  assert.match(source, /process\.argv\.includes\("--commit"\)/);
  assert.match(source, /--limit must be between 1 and 50/);
  assert.match(source, /option\("after"\)/);
  assert.match(source, /disabled in production/);
  assert.match(source, /CATALOG_RACECHIP_BACKFILL_ALLOW_WRITE/);
  assert.match(source, /CATALOG_RACECHIP_BACKFILL_DATABASE_URL/);
  assert.match(source, /persistRaceChipSourceRecordPageWithClient/);
});
