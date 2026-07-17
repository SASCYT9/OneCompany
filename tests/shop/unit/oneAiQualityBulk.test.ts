import assert from "node:assert/strict";
import test from "node:test";

import {
  createOneAiQualityBulkPreviewToken,
  hashOneAiQualityBulkActor,
  parseOneAiQualityBulkApplyInput,
  parseOneAiQualityBulkPreviewInput,
  verifyOneAiQualityBulkPreviewToken,
  type OneAiQualityBulkPreviewTokenPayload,
} from "../../../src/lib/admin/oneAiQualityBulk";

const SECRET = "one-ai-quality-bulk-test-secret-at-least-32-bytes";
const NOW = new Date("2026-07-17T12:00:00.000Z").getTime();

function payload(): OneAiQualityBulkPreviewTokenPayload {
  return {
    version: 1,
    purpose: "one-ai-quality-bulk",
    issuedAt: NOW,
    expiresAt: NOW + 5 * 60_000,
    actorHash: hashOneAiQualityBulkActor("manager@example.com"),
    homogeneous: {
      scope: "auto",
      categoryGroup: "exhaust",
      productKind: "system",
    },
    products: [
      { productId: "product-1", expectedRevision: 4 },
      { productId: "product-2", expectedRevision: 7 },
    ],
    mutation: {
      action: "needs_source",
      reason: "Supplier proof is missing",
      application: null,
      evidence: null,
    },
  };
}

test("bulk preview parser permits only exact bounded homogeneous action requests", () => {
  const parsed = parseOneAiQualityBulkPreviewInput({
    productIds: ["product-1", "product-2", "product-2"],
    action: "needs_source",
    reason: "Supplier proof is missing",
  });
  assert.equal(parsed.ok, true);
  if (parsed.ok) assert.deepEqual(parsed.value.productIds, ["product-1", "product-2"]);

  assert.equal(
    parseOneAiQualityBulkPreviewInput({
      productIds: ["product-1"],
      action: "needs_source",
      reason: "Supplier proof is missing",
    }).ok,
    false
  );
  assert.equal(
    parseOneAiQualityBulkPreviewInput({
      productIds: ["product-1", "product-2"],
      action: "save_draft",
      application: {},
    }).ok,
    false
  );
  assert.equal(
    parseOneAiQualityBulkPreviewInput({
      productIds: ["product-1", "product-2"],
      action: "verify_and_reindex",
      evidence: { excerpt: "Manager certificate" },
      application: {
        applicationId: "product-specific-application",
        variantId: null,
        scope: "auto",
        vehicleType: "car",
        make: "BMW",
      },
    }).ok,
    false
  );
});

test("signed preview token is actor-bound, expiring and tamper evident", () => {
  const token = createOneAiQualityBulkPreviewToken(payload(), SECRET);
  const actorHash = hashOneAiQualityBulkActor("manager@example.com");

  const verified = verifyOneAiQualityBulkPreviewToken(token, SECRET, actorHash, NOW + 1_000);
  assert.equal(verified.ok, true);
  if (verified.ok) {
    assert.deepEqual(verified.payload.products, payload().products);
    assert.equal(verified.payload.mutation.action, "needs_source");
  }

  assert.deepEqual(
    verifyOneAiQualityBulkPreviewToken(
      token,
      SECRET,
      hashOneAiQualityBulkActor("other@example.com"),
      NOW + 1_000
    ),
    { ok: false, reason: "actor-mismatch" }
  );
  assert.deepEqual(verifyOneAiQualityBulkPreviewToken(token, SECRET, actorHash, NOW + 5 * 60_000), {
    ok: false,
    reason: "expired",
  });
  const tampered = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`;
  assert.deepEqual(verifyOneAiQualityBulkPreviewToken(tampered, SECRET, actorHash, NOW + 1_000), {
    ok: false,
    reason: "invalid-signature",
  });
});

test("bulk apply requires a bounded idempotency key and signed preview token", () => {
  const previewToken = createOneAiQualityBulkPreviewToken(payload(), SECRET);
  const parsed = parseOneAiQualityBulkApplyInput({
    previewToken,
    idempotencyKey: "bulk-request-20260717-001",
  });
  assert.equal(parsed.ok, true);
  assert.equal(
    parseOneAiQualityBulkApplyInput({
      previewToken,
      idempotencyKey: "short",
    }).ok,
    false
  );
});
