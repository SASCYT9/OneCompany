import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("publication gate is disposable-only and verifies the full visibility chain", () => {
  const benchmark = readFileSync("scripts/benchmark-catalog-v2-publication.ts", "utf8");
  const runner = readFileSync("scripts/run-catalog-v2-publication-docker.ts", "utf8");
  assert.match(benchmark, /searchParams\.get\("application_name"\) !== "catalog-publication-gate"/);
  assert.match(benchmark, /coordinateShopCatalogProductMutationWithClient/);
  assert.match(benchmark, /runShopCatalogOutboxRuntime/);
  assert.match(benchmark, /status\?\.status !== "PUBLISHED"/);
  assert.match(benchmark, /p95Ms: 2_000, p99Ms: 5_000/);
  assert.match(benchmark, /contentionWinners !== 1/);
  assert.match(runner, /pgvector\/pgvector:0\.8\.2-pg17/);
  assert.match(runner, /migrate", "deploy"/);
  assert.match(runner, /finally/);
  assert.match(runner, /docker, \["rm", "--force"/);
});
