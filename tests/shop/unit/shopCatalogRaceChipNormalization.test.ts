import assert from "node:assert/strict";
import test from "node:test";

import {
  buildRaceChipSourceRecordDraft,
  classifyRaceChipFuel,
  normalizeRaceChipSnapshotProduct,
} from "../../../src/lib/shopCatalogRaceChipNormalization";
import { buildShopCatalogSourceRecordCoverage } from "../../../src/lib/shopCatalogSourceCoverage";

test("RaceChip normalization retains exact engine configuration and correlated vehicle identity", () => {
  const result = normalizeRaceChipSnapshotProduct({
    id: "p1",
    slug: "racechip-gts5-ford-c-max",
    sku: "RC-GTS5-FORD-1-5-TDCI",
    tags: [
      "car_make:ford",
      "car_model:c-max-ii-from-2010",
      "car_engine:1-5-tdci-1499ccm-95hp-70kw-250nm",
      "ccm:1499",
      "base_hp:95",
      "gain_hp:29",
      "gain_nm:75",
      "fits-make:ford",
      "fits-model:ford:c-max",
      "fits:ford-c-max",
      "fits-trim:ford:c-max:ii",
    ],
    variants: [{ id: "v1", sku: "RC-GTS5-FORD-1-5-TDCI-AC", isDefault: true }],
  });
  assert.equal(result.verification, "VERIFIED");
  assert.equal(result.recordKey, "p1:RC-GTS5-FORD-1-5-TDCI");
  assert.equal(result.make, "ford");
  assert.equal(result.model, "c-max");
  assert.equal(result.generation, "ii");
  assert.equal(result.yearFrom, 2010);
  assert.equal(result.yearTo, null);
  assert.equal(result.fuel, "diesel");
  assert.match(result.configurationKey, /ford\|c-max\|ii\|2010-open\|1-5-tdci/);
});

test("unknown fuel never becomes verified exact fitment while explicit hybrid takes precedence", () => {
  assert.equal(classifyRaceChipFuel("2-0-1998ccm-200hp"), null);
  assert.equal(classifyRaceChipFuel("hybrid-tdi"), "hybrid");
  const result = normalizeRaceChipSnapshotProduct({
    id: "p2",
    slug: "unknown",
    sku: "RC-UNKNOWN",
    tags: [
      "car_make:bmw",
      "car_model:m2-f87-2016-to-2020",
      "car_engine:3-0-2979ccm-370hp",
      "ccm:2979",
      "base_hp:370",
      "gain_hp:50",
      "gain_nm:80",
      "fits-make:bmw",
      "fits-model:bmw:m2",
      "fits-trim:bmw:m2:f87",
    ],
    variants: [{ id: "v2", sku: "RC-UNKNOWN-AC", isDefault: true }],
  });
  assert.equal(result.verification, "NEEDS_REVIEW");
  assert.ok(result.issues.includes("fuel_unknown_or_ambiguous"));
});

test("versioned RaceChip fuel vocabulary recognizes explicit supplier engine conventions", () => {
  assert.equal(classifyRaceChipFuel("30d-2993ccm-286hp"), "diesel");
  assert.equal(classifyRaceChipFuel("1-6-cdti-1598ccm-136hp"), "diesel");
  assert.equal(classifyRaceChipFuel("2-0-d-4d-1998ccm-124hp"), "diesel");
  assert.equal(classifyRaceChipFuel("35i-2979ccm-306hp"), "petrol");
  assert.equal(classifyRaceChipFuel("1-2-puretech-130-1199ccm"), "petrol");
  assert.equal(classifyRaceChipFuel("30d-mild-hybrid-2993ccm"), "hybrid");
});

test("RaceChip source draft accounts for every raw field and audits legacy SHOP scope", () => {
  const product = {
    id: "p3",
    slug: "racechip-audi-a4",
    sku: "RC-AUDI-A4",
    scope: "SHOP",
    tags: [
      "car_make:audi",
      "car_model:a4-b9-from-2015",
      "car_engine:2-0-tfsi-1984ccm-190hp",
      "ccm:1984",
      "base_hp:190",
      "gain_hp:45",
      "gain_nm:70",
      "fits-make:audi",
      "fits-model:audi:a4",
      "fits-trim:audi:a4:b9",
    ],
    gallery: [],
    variants: [{ id: "v3", sku: "RC-AUDI-A4-AC", isDefault: true }],
  };
  const draft = buildRaceChipSourceRecordDraft({ product, sourceRevision: "shard-1" });
  assert.equal(draft.sourceRecord.recordKey, "p3:RC-AUDI-A4");
  assert.equal(draft.sourceRecord.payloadHash.length, 64);
  const scope = draft.provenance.find((entry) => entry.fieldPath === "scope");
  assert.equal(scope?.normalizedValue, "auto");
  assert.match(scope?.reason ?? "", /LEGACY SHOP/);
  assert.equal(
    draft.provenance.find((entry) => entry.fieldPath === "variants.sku")?.canonicalEntityId,
    "v3"
  );
  const coverage = buildShopCatalogSourceRecordCoverage({
    recordKey: draft.sourceRecord.recordKey,
    rawPayload: product,
    provenance: draft.provenance.map((entry) => ({
      ...entry,
      issueCount: 0,
    })),
  });
  assert.equal(coverage.coveragePercent, 100);
  assert.equal(coverage.activationReady, true);
});
