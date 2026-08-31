import assert from "node:assert/strict";
import test from "node:test";

import {
  buildShopCatalogSourceRecordCoverage,
  flattenShopCatalogRawPayload,
} from "../../../src/lib/shopCatalogSourceCoverage";

test("raw source flattening retains every scalar and repeated array ordinal", () => {
  const leaves = flattenShopCatalogRawPayload({
    sku: "RC-1",
    applications: [
      { make: "BMW", engine: "S55" },
      { make: "BMW", engine: "S58" },
    ],
    media: [],
  });
  assert.deepEqual(
    leaves.map(({ fieldPath, ordinal, value }) => ({ fieldPath, ordinal, value })),
    [
      { fieldPath: "applications.engine", ordinal: 0, value: "S55" },
      { fieldPath: "applications.make", ordinal: 0, value: "BMW" },
      { fieldPath: "applications.engine", ordinal: 1, value: "S58" },
      { fieldPath: "applications.make", ordinal: 1, value: "BMW" },
      { fieldPath: "media", ordinal: 0, value: [] },
      { fieldPath: "sku", ordinal: 0, value: "RC-1" },
    ]
  );
});

test("activation requires every raw leaf mapped, quarantined with issue, or ignored with reason", () => {
  const rawPayload = { sku: "RC-1", obsolete: true, engine: "S55" };
  const incomplete = buildShopCatalogSourceRecordCoverage({
    recordKey: "racechip:RC-1",
    rawPayload,
    provenance: [
      { fieldPath: "sku", ordinal: 0, mappingStatus: "MAPPED", canonicalEntityId: "p1", canonicalField: "sku" },
      { fieldPath: "obsolete", ordinal: 0, mappingStatus: "IGNORED_WITH_REASON" },
    ],
  });
  assert.equal(incomplete.activationReady, false);
  assert.equal(incomplete.coveragePercent, 66.67);
  assert.deepEqual(incomplete.missing, [{ fieldPath: "engine", ordinal: 0 }]);
  assert.match(incomplete.invalid[0]!.reason, /ignored_without_reason/);

  const complete = buildShopCatalogSourceRecordCoverage({
    recordKey: "racechip:RC-1",
    rawPayload,
    provenance: [
      { fieldPath: "sku", ordinal: 0, mappingStatus: "MAPPED", canonicalEntityId: "p1", canonicalField: "sku" },
      { fieldPath: "obsolete", ordinal: 0, mappingStatus: "IGNORED_WITH_REASON", reason: "supplier legacy flag" },
      { fieldPath: "engine", ordinal: 0, mappingStatus: "QUARANTINED", issueCount: 1 },
    ],
  });
  assert.equal(complete.activationReady, true);
  assert.equal(complete.coveragePercent, 100);
  assert.equal(complete.mappedLeafCount, 1);
  assert.equal(complete.quarantinedLeafCount, 1);
  assert.equal(complete.ignoredLeafCount, 1);
});

test("coverage fingerprint is stable across object key order", () => {
  const provenance = [
    { fieldPath: "a", ordinal: 0, mappingStatus: "IGNORED_WITH_REASON" as const, reason: "test" },
    { fieldPath: "b", ordinal: 0, mappingStatus: "IGNORED_WITH_REASON" as const, reason: "test" },
  ];
  const left = buildShopCatalogSourceRecordCoverage({ recordKey: "x", rawPayload: { a: 1, b: 2 }, provenance });
  const right = buildShopCatalogSourceRecordCoverage({ recordKey: "x", rawPayload: { b: 2, a: 1 }, provenance });
  assert.equal(left.fingerprint, right.fingerprint);
});
