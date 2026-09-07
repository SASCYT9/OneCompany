import assert from "node:assert/strict";
import test from "node:test";

import {
  buildShopCatalogSourceRevisionCoverageManifest,
  evaluateShopCatalogSelectorPublication,
} from "../../../src/lib/shopCatalogSourceRevisionCoverage";

const selectorFingerprint = "a".repeat(64);
const requiredSourceIds = ["fi", "kw", "burger"];

function manifest(
  overrides: Partial<Parameters<typeof buildShopCatalogSourceRevisionCoverageManifest>[0]> = {}
) {
  return buildShopCatalogSourceRevisionCoverageManifest({
    projectionVersion: 12,
    selectorFingerprint,
    sources: [
      {
        sourceId: "fi",
        revision: "fi-v2",
        expectedRecords: 2,
        observedRecords: 2,
        readyRecords: 2,
      },
      {
        sourceId: "kw",
        revision: "kw-v4",
        expectedRecords: 3,
        observedRecords: 3,
        readyRecords: 3,
      },
      {
        sourceId: "burger",
        revision: "burger-v9",
        expectedRecords: 1,
        observedRecords: 1,
        readyRecords: 1,
      },
    ],
    ...overrides,
  });
}

test("records one immutable revision and deterministic counts per source", () => {
  const value = manifest();
  assert.deepEqual(
    value.sources.map((source) => source.sourceId),
    ["burger", "fi", "kw"]
  );
  assert.equal(value.sources[1]!.revision, "fi-v2");
  assert.equal(value.sources[1]!.coveragePercent, 100);
  assert.equal(
    value.sources.every((source) => source.complete),
    true
  );
  assert.match(value.fingerprint, /^[a-f0-9]{64}$/);
  assert.equal(
    manifest({ sources: [...value.sources].reverse() as never[] }).fingerprint,
    value.fingerprint
  );
});

test("partial source revision blocks selector publication", () => {
  const value = manifest({
    sources: [
      {
        sourceId: "fi",
        revision: "fi-v3",
        expectedRecords: 2,
        observedRecords: 1,
        readyRecords: 1,
      },
      {
        sourceId: "kw",
        revision: "kw-v4",
        expectedRecords: 3,
        observedRecords: 3,
        readyRecords: 3,
      },
      {
        sourceId: "burger",
        revision: "burger-v9",
        expectedRecords: 1,
        observedRecords: 1,
        readyRecords: 1,
      },
    ],
  });
  const decision = evaluateShopCatalogSelectorPublication({ manifest: value, requiredSourceIds });
  assert.equal(decision.status, "BLOCKED");
  assert.equal(decision.sourceCoverageFingerprint, null);
  assert.match(decision.reasons.join("\n"), /fi@fi-v3 coverage is incomplete/);
});

test("publication blocks missing and unexpected source entries", () => {
  const value = manifest({
    sources: [
      {
        sourceId: "fi",
        revision: "fi-v2",
        expectedRecords: 2,
        observedRecords: 2,
        readyRecords: 2,
      },
      {
        sourceId: "kw",
        revision: "kw-v4",
        expectedRecords: 3,
        observedRecords: 3,
        readyRecords: 3,
      },
      {
        sourceId: "extra",
        revision: "extra-v1",
        expectedRecords: 1,
        observedRecords: 1,
        readyRecords: 1,
      },
    ],
  });
  const decision = evaluateShopCatalogSelectorPublication({ manifest: value, requiredSourceIds });
  assert.equal(decision.status, "BLOCKED");
  assert.match(decision.reasons.join("\n"), /missing required source coverage: burger/);
  assert.match(decision.reasons.join("\n"), /unexpected source coverage: extra/);
});

test("invalid counts and duplicate source revisions fail during manifest construction", () => {
  assert.throws(
    () =>
      manifest({
        sources: [
          {
            sourceId: "fi",
            revision: "fi-v2",
            expectedRecords: 1,
            observedRecords: 2,
            readyRecords: 2,
          },
        ],
      }),
    /observedRecords cannot exceed expectedRecords/
  );
  assert.throws(
    () =>
      manifest({
        sources: [
          {
            sourceId: "fi",
            revision: "fi-v2",
            expectedRecords: 1,
            observedRecords: 1,
            readyRecords: 1,
          },
          {
            sourceId: "FI",
            revision: "fi-v3",
            expectedRecords: 1,
            observedRecords: 1,
            readyRecords: 1,
          },
        ],
      }),
    /duplicate source coverage entry: fi/
  );
});

test("all required source revisions allow publication", () => {
  const value = manifest();
  const decision = evaluateShopCatalogSelectorPublication({ manifest: value, requiredSourceIds });
  assert.equal(decision.status, "READY");
  assert.equal(decision.sourceCoverageFingerprint, value.fingerprint);
  assert.deepEqual(decision.reasons, []);
});
