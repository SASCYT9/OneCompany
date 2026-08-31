import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
test("iPE persists OPF through the shared writer and uses guarded resumable CLI", () => { const adapter = readFileSync("src/lib/shopCatalogIpeCompatibility.server.ts", "utf8"), cli = readFileSync("scripts/backfill-catalog-v2-ipe.ts", "utf8");
  assert.match(adapter, /opfGpfRelevant/); assert.match(adapter, /persistVehicleCompatibilityInTransaction/); assert.match(cli, /--limit must be between 1 and 50/); assert.match(cli, /option\("after"\)/); assert.match(cli, /disabled in production/); assert.match(cli, /CATALOG_IPE_BACKFILL_ALLOW_WRITE/); });
