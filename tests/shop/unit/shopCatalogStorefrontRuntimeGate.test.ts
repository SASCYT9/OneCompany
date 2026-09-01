import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const gate = readFileSync("scripts/benchmark-catalog-v2-storefront-runtime.ts", "utf8");
const catalog = readFileSync("src/app/[locale]/shop/catalog/CatalogV2Server.tsx", "utf8");

test("runtime gate is clean-commit bound and remote-safe", () => {
  assert.match(gate, /status", "--porcelain/);
  assert.match(gate, /rev-parse", "HEAD/);
  assert.match(gate, /CATALOG_STOREFRONT_RUNTIME_ALLOW_REMOTE/);
  assert.match(gate, /\["localhost", "127\.0\.0\.1", "\[::1\]"\]/);
});

test("runtime gate enforces P4 SSR, TTFB, and response budgets", () => {
  assert.match(gate, /TTFB_P95_LIMIT_MS = 300/);
  assert.match(gate, /FIRST_RESPONSE_GZIP_LIMIT = 100 \* 1024/);
  assert.match(gate, /meaningfulProductHtmlBeforeHydration/);
  assert.match(gate, /data-catalog-product-id=/);
  assert.match(gate, /gzipSync\(representative\.body, \{ level: 9 \}\)/);
  assert.match(gate, /artifact\.status !== "PASS"/);
});

test("Catalog V2 emits stable server markers without changing product data", () => {
  assert.match(catalog, /data-catalog-v2="true"/);
  assert.match(catalog, /data-catalog-product-id=\{item\.productId\}/);
});
