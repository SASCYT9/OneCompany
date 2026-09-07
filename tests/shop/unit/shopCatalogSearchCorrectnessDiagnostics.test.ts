import assert from "node:assert/strict";
import test from "node:test";

import {
  auditLegacySnapshotCatalog,
  diagnoseLegacySnapshotProduct,
} from "../../../src/lib/shopCatalogSearchCorrectnessDiagnostics";

function product(slug: string, tags: string[], scope = "auto") {
  return {
    slug,
    scope,
    tags,
    title: { en: slug },
    brand: "Burger Motorsports",
    vendor: "Burger Motorsports",
  };
}

test("diagnostic identifies polluted legacy BMW tags on a Kia/Hyundai product", () => {
  const result = diagnoseLegacySnapshotProduct(
    product("kia-g90", [
      "brand:Kia",
      "brand:Hyundai",
      "model:Genesis",
      "chassis:G90",
      "fits-make:bmw",
      "fits-model:bmw:m5",
      "fits-trim:bmw:m5:g90",
    ])
  );
  assert.equal(result.fitment.make, "BMW");
  assert.deepEqual(result.declaredMakes, ["Hyundai", "Kia"]);
  assert.equal(result.ambiguousMakeEvidence, true);
  assert.match(result.reason ?? "", /conflicts/);
});

test("audit reports observable snapshot coverage without claiming canonical policy evidence", () => {
  const report = auditLegacySnapshotCatalog({
    stores: {
      burger: [
        product("kia-g90", [
          "brand:Kia",
          "fits-make:bmw",
          "fits-model:bmw:m5",
          "fits-trim:bmw:m5:g90",
        ]),
        product("valid-m5", [
          "brand:BMW",
          "fits-make:bmw",
          "fits-model:bmw:m5",
          "fits-trim:bmw:m5:g90",
        ]),
        product("moto-unknown", [], "moto"),
      ],
    },
    query: { make: "BMW", model: "M5", chassis: "G90" },
  });
  assert.equal(report.evidence.canonicalPolicies, "not_observed_without_database");
  assert.equal(report.totals.total, 3);
  assert.equal(report.totals.auto, 2);
  assert.equal(report.totals.moto, 1);
  assert.equal(report.totals.missingMake, 1);
  assert.equal(report.totals.ambiguousMakeEvidence, 1);
  assert.deepEqual(
    report.queryMatches.map((item) => [item.slug, item.suspicious]),
    [
      ["kia-g90", true],
      ["valid-m5", false],
    ]
  );
});
