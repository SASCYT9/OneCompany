import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("source coverage reporting is bounded, current-record-only, and fail closed", () => {
  const report = readFileSync("src/lib/shopCatalogSourceCoverageReport.server.ts", "utf8");
  const cli = readFileSync("scripts/audit-catalog-v2-source-coverage.ts", "utf8");
  assert.match(report, /SHOP_CATALOG_SOURCE_COVERAGE_PAGE_LIMIT = 500/);
  assert.match(report, /supersededBy: null/);
  assert.match(report, /take: limit \+ 1/);
  assert.match(report, /payload_not_inline_auditable/);
  assert.match(report, /missing_current_binding/);
  assert.match(report, /quarantined_fields/);
  assert.match(report, /open_issues/);
  assert.match(cli, /CATALOG_SOURCE_COVERAGE_ALLOW_DB_READ/);
  assert.match(cli, /disabled in production/);
  assert.match(cli, /records\.every\(\(record\) => record\.activationReady\)/);
  assert.match(cli, /process\.exitCode = 2/);
});
