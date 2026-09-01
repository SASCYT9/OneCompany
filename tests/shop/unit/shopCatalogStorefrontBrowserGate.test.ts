import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("scripts/benchmark-catalog-v2-storefront-browser.ts", "utf8");

test("browser gate is clean-commit bound and remote-safe", () => {
  assert.match(source, /status", "--porcelain/);
  assert.match(source, /rev-parse", "HEAD/);
  assert.match(source, /CATALOG_STOREFRONT_BROWSER_ALLOW_REMOTE/);
});

test("browser gate enforces P4 LCP and interactive filtering", () => {
  assert.match(source, /LCP_P75_LIMIT_MS = 1_800/);
  assert.match(source, /LCP_P95_LIMIT_MS = 2_500/);
  assert.match(source, /FILTER_P95_LIMIT_MS = 1_000/);
  assert.match(source, /largest-contentful-paint/);
  assert.match(source, /select\[name=["']brand["']\]/);
  assert.match(source, /data-nextjs-dialog/);
  assert.match(source, /noConsoleErrors/);
  assert.match(source, /artifact\.status !== "PASS"/);
});
