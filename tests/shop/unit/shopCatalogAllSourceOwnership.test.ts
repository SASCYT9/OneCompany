import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
test("catalog ownership gate fails closed on source, partition, identity, and entrypoint drift", () => { const source = readFileSync("scripts/audit-catalog-v2-all-source-ownership.ts", "utf8"); assert.match(source, /source set changed without an ownership adapter/); assert.match(source, /contains unowned records/); assert.match(source, /Duplicate or empty catalog product identity/); assert.match(source, /package command is missing/); assert.match(source, /flattenShopCatalogRawPayload/); });
