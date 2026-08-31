import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
test("Burger uses shared persistence and guarded resumable CLI", () => { const adapter = readFileSync("src/lib/shopCatalogBurgerCompatibility.server.ts", "utf8"), cli = readFileSync("scripts/backfill-catalog-v2-burger.ts", "utf8"); assert.match(adapter, /persistVehicleCompatibilityInTransaction/); assert.match(adapter, /engineRelevant: normalization.engineRelevant/); assert.match(cli, /option\("after"\)/); assert.match(cli, /--limit must be between 1 and 50/); assert.match(cli, /disabled in production/); assert.match(cli, /CATALOG_BURGER_BACKFILL_ALLOW_WRITE/); });
