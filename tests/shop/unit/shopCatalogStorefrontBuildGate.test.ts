import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("scripts/measure-catalog-v2-storefront-build.ts", "utf8");

test("storefront build gate is clean-commit and production-build bound", () => {
  assert.match(source, /rev-parse", "HEAD/);
  assert.match(source, /status", "--porcelain/);
  assert.match(source, /\.next", "BUILD_ID/);
  assert.match(source, /page_client-reference-manifest\.js/);
});

test("storefront build gate enforces initial JS and legacy isolation", () => {
  assert.match(source, /INITIAL_JS_GZIP_LIMIT = 150 \* 1024/);
  assert.match(source, /gzipSync\(contents, \{ level: 9 \}\)/);
  assert.match(source, /incrementalCatalogJs/);
  assert.match(source, /legacyStockModuleIsolated: !legacyStockModulePresent/);
  assert.match(source, /artifact\.status !== "PASS"/);
});

test("storefront build gate confines manifest assets and artifacts", () => {
  assert.match(source, /\^static\\\/chunks/);
  assert.match(source, /artifacts", "catalog-v2-storefront/);
  assert.match(source, /catalog-v2-storefront-build-gate\.json/);
});
