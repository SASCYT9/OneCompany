import assert from "node:assert/strict";
import { registerHooks } from "./testHooks.mjs";
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

const artifactModule = import("../../../src/lib/shopCatalogSelectorArtifact.server");

const state = {
  canonicalVersion: "7",
  projectionVersion: BigInt(7),
  fingerprint: "a".repeat(64),
};
const checkpoint = { status: "COMPLETED", projectionSchemaVersion: 1 };
const projection = {
  activePublishedProducts: 10,
  localeCompleteProducts: 10,
  versionMismatchRows: 0,
  policyProducts: 10,
  policyClauseMismatchProducts: 0,
  unverifiedClauseProducts: 0,
  unknownConstraintProducts: 0,
};

test("selector artifact is ready only after one complete released projection", async () => {
  const { evaluateShopCatalogSelectorArtifactReadiness } = await artifactModule;
  assert.deepEqual(
    evaluateShopCatalogSelectorArtifactReadiness({ state, checkpoint, projection }),
    { ready: true, reason: "ready", projectionVersion: "7", fingerprint: "a".repeat(64) }
  );
});

test("partial or stale projection fails closed", async () => {
  const { evaluateShopCatalogSelectorArtifactReadiness } = await artifactModule;
  for (const patch of [
    { state: null, reason: "state_missing" },
    { state: { ...state, canonicalVersion: "6" }, reason: "state_version_mismatch" },
    { checkpoint: { ...checkpoint, status: "RUNNING" }, reason: "rebuild_incomplete" },
    {
      projection: { ...projection, localeCompleteProducts: 9 },
      reason: "projection_locale_incomplete",
    },
    {
      projection: { ...projection, versionMismatchRows: 1 },
      reason: "projection_version_mismatch",
    },
    {
      projection: { ...projection, policyProducts: 4 },
      reason: "projection_policy_incomplete",
    },
    {
      projection: { ...projection, unverifiedClauseProducts: 1 },
      reason: "projection_clause_unverified",
    },
    {
      projection: { ...projection, unknownConstraintProducts: 1 },
      reason: "projection_constraint_unknown",
    },
  ] as const) {
    const result = evaluateShopCatalogSelectorArtifactReadiness({
      state: patch.state === null ? null : (patch.state ?? state),
      checkpoint: patch.checkpoint ?? checkpoint,
      projection: patch.projection ?? projection,
    });
    assert.equal(result.ready, false);
    assert.equal(result.reason, patch.reason);
  }
});

test("missing policy rows and invalid release markers fail closed", async () => {
  const { evaluateShopCatalogSelectorArtifactReadiness } = await artifactModule;
  assert.equal(
    evaluateShopCatalogSelectorArtifactReadiness({
      state: { ...state, fingerprint: null },
      checkpoint,
      projection,
    }).reason,
    "state_fingerprint_invalid"
  );
  assert.equal(
    evaluateShopCatalogSelectorArtifactReadiness({
      state,
      checkpoint,
      projection: { ...projection, policyProducts: 0 },
    }).reason,
    "projection_policy_missing"
  );
  assert.equal(
    evaluateShopCatalogSelectorArtifactReadiness({
      state,
      checkpoint,
      projection: { ...projection, policyClauseMismatchProducts: 1 },
    }).reason,
    "projection_policy_incomplete"
  );
});
