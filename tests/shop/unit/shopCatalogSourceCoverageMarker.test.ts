import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const serverOnlyStub = pathToFileURL(
  path.resolve("tests/shop/unit/fixtures/server-only-stub.cjs")
).href;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") return { url: serverOnlyStub, shortCircuit: true };
    return nextResolve(specifier, context);
  },
});

const markerModule = import("../../../src/lib/shopCatalogSourceCoverageMarker.server");
const coverageModule = import("../../../src/lib/shopCatalogSourceRevisionCoverage");

async function manifest() {
  const { buildShopCatalogSourceRevisionCoverageManifest } = await coverageModule;
  return buildShopCatalogSourceRevisionCoverageManifest({
    projectionVersion: 7,
    selectorFingerprint: "a".repeat(64),
    sources: [
      { sourceId: "fi", revision: "fi-1", expectedRecords: 1, observedRecords: 1, readyRecords: 1 },
      { sourceId: "kw", revision: "kw-1", expectedRecords: 1, observedRecords: 1, readyRecords: 1 },
    ],
  });
}

test("marker is derived from complete source coverage and uses the existing hash slot", async () => {
  const { buildShopCatalogSourceCoverageMarker } = await markerModule;
  const value = await manifest();
  const marker = buildShopCatalogSourceCoverageMarker({
    manifest: value,
    requiredSourceIds: ["fi", "kw"],
  });
  assert.equal(marker.projectionVersion, "7");
  assert.equal(marker.sourceCoverageFingerprint, value.fingerprint);
  assert.equal(marker.markerVersion, 1);
});

test("incomplete coverage cannot produce a marker", async () => {
  const { buildShopCatalogSourceCoverageMarker } = await markerModule;
  const { buildShopCatalogSourceRevisionCoverageManifest } = await coverageModule;
  const value = buildShopCatalogSourceRevisionCoverageManifest({
    projectionVersion: 7,
    selectorFingerprint: "a".repeat(64),
    sources: [
      { sourceId: "fi", revision: "fi-1", expectedRecords: 2, observedRecords: 1, readyRecords: 1 },
      { sourceId: "kw", revision: "kw-1", expectedRecords: 1, observedRecords: 1, readyRecords: 1 },
    ],
  });
  assert.throws(
    () =>
      buildShopCatalogSourceCoverageMarker({ manifest: value, requiredSourceIds: ["fi", "kw"] }),
    /coverage is incomplete/
  );
});

test("marker publication is monotonic and same-version hash conflicts fail closed", async () => {
  const { buildShopCatalogSourceCoverageMarker, planShopCatalogSourceCoverageMarker } =
    await markerModule;
  const marker = buildShopCatalogSourceCoverageMarker({
    manifest: await manifest(),
    requiredSourceIds: ["fi", "kw"],
  });
  assert.equal(planShopCatalogSourceCoverageMarker({ current: null, marker }).decision, "INSERT");
  assert.equal(
    planShopCatalogSourceCoverageMarker({
      current: {
        canonicalVersion: "7",
        projectionVersion: "7",
        fingerprint: marker.sourceCoverageFingerprint,
      },
      marker,
    }).decision,
    "IDEMPOTENT"
  );
  assert.equal(
    planShopCatalogSourceCoverageMarker({
      current: { canonicalVersion: "8", projectionVersion: "8", fingerprint: "b".repeat(64) },
      marker,
    }).decision,
    "STALE_VERSION"
  );
  assert.equal(
    planShopCatalogSourceCoverageMarker({
      current: { canonicalVersion: "7", projectionVersion: "7", fingerprint: "b".repeat(64) },
      marker,
    }).decision,
    "VERSION_CONFLICT"
  );
});

test("invalid existing state cannot be overwritten", async () => {
  const { buildShopCatalogSourceCoverageMarker, planShopCatalogSourceCoverageMarker } =
    await markerModule;
  const marker = buildShopCatalogSourceCoverageMarker({
    manifest: await manifest(),
    requiredSourceIds: ["fi", "kw"],
  });
  assert.equal(
    planShopCatalogSourceCoverageMarker({
      current: { canonicalVersion: "7", projectionVersion: "6", fingerprint: "a".repeat(64) },
      marker,
    }).decision,
    "INCONSISTENT_CURRENT_STATE"
  );
});
