import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  assertCatalogScaleMeasurement,
  buildCatalogScaleMeasurement,
  type CatalogExplainResult,
} from "../../../src/lib/shopCatalogScaleGate";

function explain(ms: number, nodeType = "Index Scan"): CatalogExplainResult {
  return {
    Plan: { "Node Type": nodeType, "Relation Name": "scale_projection" },
    "Planning Time": 0.2,
    "Execution Time": ms,
  };
}

test("scale gate computes warm p95 and accepts indexed SLO-compliant plans", () => {
  const measurement = buildCatalogScaleMeasurement({
    scenario: "listing",
    cold: explain(120),
    warm: [10, 12, 11, 14, 13].map((ms) => explain(ms)),
  });
  assert.equal(measurement.warmP95Ms, 14);
  assert.deepEqual(measurement.sequentialRelations, []);
  assert.doesNotThrow(() =>
    assertCatalogScaleMeasurement(measurement, new Set(["scale_projection"]))
  );
});

test("scale gate rejects O(N) plans and SLO violations", () => {
  const sequential = buildCatalogScaleMeasurement({
    scenario: "fitment",
    cold: explain(40, "Seq Scan"),
    warm: [20, 20, 20, 20, 20].map((ms) => explain(ms, "Seq Scan")),
  });
  assert.throws(
    () => assertCatalogScaleMeasurement(sequential, new Set(["scale_projection"])),
    /sequential scans/
  );

  const slow = buildCatalogScaleMeasurement({
    scenario: "search",
    cold: explain(501),
    warm: [101, 99, 98, 97, 96].map((ms) => explain(ms)),
  });
  assert.throws(() => assertCatalogScaleMeasurement(slow, new Set()), /cold query/);
});

test("scale runner is disposable-only and covers the required 100k/500k plans", () => {
  const source = readFileSync(
    new URL("../../../scripts/benchmark-catalog-v2-scale.ts", import.meta.url),
    "utf8"
  );
  const manifest = readFileSync(new URL("../../../package.json", import.meta.url), "utf8");
  const dockerRunner = readFileSync(
    new URL("../../../scripts/run-catalog-v2-scale-docker.ts", import.meta.url),
    "utf8"
  );

  assert.match(source, /DEFAULT_SIZES = \[100_000, 500_000\]/);
  assert.match(source, /CREATE TEMP TABLE scale_projection/);
  assert.match(source, /ON COMMIT DROP/);
  assert.match(source, /localhost/);
  assert.match(source, /application_name=catalog-scale-gate/);
  assert.match(source, /EXPLAIN \(ANALYZE, BUFFERS, FORMAT JSON\)/);
  assert.match(source, /listing_deep_keyset/);
  assert.match(source, /correlated_fitment/);
  assert.match(source, /brand_facet/);
  assert.match(source, /progressive_make_facet/);
  assert.doesNotMatch(source, /DELETE FROM|TRUNCATE|DROP TABLE "Shop/);
  assert.match(manifest, /shop:catalog:v2:scale/);
  assert.match(manifest, /shop:catalog:v2:scale:docker/);
  assert.match(dockerRunner, /pgvector\/pgvector:0\.8\.2-pg17/);
  assert.match(dockerRunner, /onecompany-catalog-scale-/);
  assert.match(dockerRunner, /\["rm", "--force", containerName\]/);
});
