import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
test("GiroDisc uses shared persistence and guarded resumable CLI", () => { const adapter = readFileSync("src/lib/shopCatalogGirodiscCompatibility.server.ts", "utf8"), cli = readFileSync("scripts/backfill-catalog-v2-girodisc.ts", "utf8"); assert.match(adapter, /persistVehicleCompatibilityInTransaction/); assert.match(adapter, /engineRelevant: false/);
  assert.match(cli, /--limit must be between 1 and 50/); assert.match(cli, /option\("after"\)/); assert.match(cli, /disabled in production/); assert.match(cli, /CATALOG_GIRODISC_BACKFILL_ALLOW_WRITE/); });
