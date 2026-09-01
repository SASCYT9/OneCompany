import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { createShopCatalogReleaseMarker, evaluateShopCatalogReleaseActivation, SHOP_CATALOG_OWNERSHIP_FINGERPRINT, type ShopCatalogReleaseEvidence } from "../../../src/lib/shopCatalogReleaseActivationGuard";

const secret = "catalog-release-secret-that-is-at-least-32-bytes";
const commit = "a".repeat(40);
const now = new Date("2026-08-31T12:00:00.000Z");
function marker(overrides: Record<string, unknown> = {}) {
  const payload = { version: 2, commitSha: commit, generatedAt: "2026-08-31T11:00:00.000Z", expiresAt: "2026-08-31T13:00:00.000Z", ownershipFingerprint: SHOP_CATALOG_OWNERSHIP_FINGERPRINT, sourceCoverageFingerprint: "b".repeat(64), sourcesReady: 14, projectionLag: 0, shadow: { sampledRequests: 1000, mismatches: 0, errorRate: 0, windowHours: 24 }, performance: { scaleP95Ms: 100, publicationP95Ms: 1000 }, rollout: { maxCanaryPercentage: 5, fullSsrApproved: false, approvedBy: "Catalog Owner" }, ...overrides };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${createHmac("sha256", secret).update(Buffer.from(encoded, "base64url")).digest("base64url")}`;
}

test("catalog reader stays unaffected outside requested production activation", () => {
  assert.equal(evaluateShopCatalogReleaseActivation({ nodeEnv: "production", readerMode: "off" }).allowed, true);
  assert.equal(evaluateShopCatalogReleaseActivation({ nodeEnv: "development", readerMode: "ssr" }).allowed, true);
});
test("signed canary evidence permits only its authorized percentage", () => {
  assert.equal(evaluateShopCatalogReleaseActivation({ nodeEnv: "production", readerMode: "canary", canaryPercentage: 5, deployedCommit: commit, marker: marker(), secret, now }).allowed, true);
  const exceeded = evaluateShopCatalogReleaseActivation({ nodeEnv: "production", readerMode: "canary", canaryPercentage: 6, deployedCommit: commit, marker: marker(), secret, now });
  assert.equal(exceeded.allowed, false);
  assert.match(exceeded.reasons.join(" "), /exceeds signed maximum 5/);
  assert.equal(evaluateShopCatalogReleaseActivation({ nodeEnv: "production", readerMode: "canary", canaryPercentage: Number.NaN, deployedCommit: commit, marker: marker(), secret, now }).allowed, false);
});
test("full SSR requires separate explicit signed approval", () => {
  assert.equal(evaluateShopCatalogReleaseActivation({ nodeEnv: "production", readerMode: "ssr", deployedCommit: commit, marker: marker(), secret, now }).allowed, false);
  assert.equal(evaluateShopCatalogReleaseActivation({ nodeEnv: "production", readerMode: "ssr", deployedCommit: commit, marker: marker({ rollout: { maxCanaryPercentage: 100, fullSsrApproved: true, approvedBy: "Catalog Owner" } }), secret, now }).allowed, false);
  assert.equal(evaluateShopCatalogReleaseActivation({ nodeEnv: "production", readerMode: "ssr", deployedCommit: commit, marker: marker({ shadow: { sampledRequests: 1000, mismatches: 0, errorRate: 0, windowHours: 72 }, rollout: { maxCanaryPercentage: 100, fullSsrApproved: true, approvedBy: "Catalog Owner" } }), secret, now }).allowed, true);
});
test("activation fails closed for stale ownership, mismatch, lag, weak samples, and SLO failures", () => {
  const result = evaluateShopCatalogReleaseActivation({ nodeEnv: "production", readerMode: "canary", canaryPercentage: 1, deployedCommit: commit, marker: marker({ ownershipFingerprint: "c".repeat(64), sourcesReady: 13, projectionLag: 1, shadow: { sampledRequests: 999, mismatches: 1, errorRate: 0.01, windowHours: 1 }, performance: { scaleP95Ms: 201, publicationP95Ms: 2001 }, rollout: { maxCanaryPercentage: 5, fullSsrApproved: false, approvedBy: "" } }), secret, now });
  assert.equal(result.allowed, false); assert.ok(result.reasons.length >= 8);
});
test("activation rejects tampering, old marker versions, and commit mismatch", () => {
  const signed = marker();
  assert.equal(evaluateShopCatalogReleaseActivation({ nodeEnv: "production", readerMode: "canary", canaryPercentage: 1, deployedCommit: "d".repeat(40), marker: signed, secret, now }).allowed, false);
  assert.equal(evaluateShopCatalogReleaseActivation({ nodeEnv: "production", readerMode: "canary", canaryPercentage: 1, deployedCommit: commit, marker: `${signed}x`, secret, now }).allowed, false);
  assert.equal(evaluateShopCatalogReleaseActivation({ nodeEnv: "production", readerMode: "canary", canaryPercentage: 1, deployedCommit: commit, marker: marker({ version: 1 }), secret, now }).allowed, false);
  assert.equal(evaluateShopCatalogReleaseActivation({ nodeEnv: "production", readerMode: "canary", canaryPercentage: 1, deployedCommit: commit, marker: marker({ shadow: null, performance: null, rollout: null }), secret, now }).allowed, false);
});
test("official marker builder signs valid bounded rollout evidence", () => {
  const payload = JSON.parse(Buffer.from(marker().split(".")[0]!, "base64url").toString("utf8")) as ShopCatalogReleaseEvidence;
  const signed = createShopCatalogReleaseMarker({ evidence: payload, secret, now });
  assert.equal(evaluateShopCatalogReleaseActivation({ nodeEnv: "production", readerMode: "canary", canaryPercentage: 5, deployedCommit: commit, marker: signed, secret, now }).allowed, true);
  assert.throws(() => createShopCatalogReleaseMarker({ evidence: { ...payload, projectionLag: 1 }, secret, now }), /projection version lag/);
  assert.throws(() => createShopCatalogReleaseMarker({ evidence: payload, secret: "weak", now }), /32 bytes/);
});
