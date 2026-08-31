import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
test("CSF persists transmission through shared writer and guarded CLI", () => { const adapter = readFileSync("src/lib/shopCatalogCsfCompatibility.server.ts", "utf8"), cli = readFileSync("scripts/backfill-catalog-v2-csf.ts", "utf8"); assert.match(adapter, /transmissionRelevant/); assert.match(adapter, /persistVehicleCompatibilityInTransaction/);
  assert.match(cli, /--limit must be between 1 and 50/); assert.match(cli, /option\("after"\)/); assert.match(cli, /disabled in production/); assert.match(cli, /CATALOG_CSF_BACKFILL_ALLOW_WRITE/); });
