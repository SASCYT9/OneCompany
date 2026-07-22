import assert from "node:assert/strict";
import test from "node:test";

import {
  nextOneAiQualityRevision,
  OneAiQualityRevisionConflictError,
  parseOneAiQualityMutation,
  parseOneAiQualityUndoSnapshot,
} from "../../../src/lib/admin/oneAiQualityMutation";

const application = {
  scope: "auto",
  vehicleType: "car",
  make: " BMW ",
  model: "M3",
  chassisCode: " g80 ",
  yearFrom: 2021,
  yearTo: 2026,
  engine: "S58",
  opfGpf: "with",
};

test("parses and normalizes a single-product fitment draft", () => {
  const parsed = parseOneAiQualityMutation({
    action: "save_draft",
    expectedRevision: 7,
    application,
  });

  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.value.expectedRevision, 7);
  assert.equal(parsed.value.application?.make, "BMW");
  assert.equal(parsed.value.application?.chassisCode, "G80");
  assert.equal(parsed.value.application?.opfGpf, "with");
});

test("verified and universal fitment require manager evidence", () => {
  const verified = parseOneAiQualityMutation({
    action: "verify_and_reindex",
    expectedRevision: 2,
    application,
  });
  const universal = parseOneAiQualityMutation({
    action: "mark_universal",
    expectedRevision: 2,
  });

  assert.deepEqual(verified, {
    ok: false,
    error: "Verified fitment requires evidence.excerpt",
  });
  assert.deepEqual(universal, {
    ok: false,
    error: "Universal fitment requires evidence.excerpt",
  });
});

test("accepts evidenced verification actions", () => {
  const verified = parseOneAiQualityMutation({
    action: "verify_and_reindex",
    expectedRevision: 2,
    application,
    evidence: {
      excerpt: "Supplier fitment table, row 42",
      sourceRef: "supplier:2026-07",
    },
  });
  const universal = parseOneAiQualityMutation({
    action: "mark_universal",
    expectedRevision: 2,
    evidence: { excerpt: "Manufacturer marks this item universal" },
  });

  assert.equal(verified.ok, true);
  assert.equal(universal.ok, true);
});

test("non-application actions fail closed on extra application data", () => {
  const parsed = parseOneAiQualityMutation({
    action: "mark_universal",
    expectedRevision: 2,
    evidence: { excerpt: "Supplier specification" },
    application,
  });

  assert.deepEqual(parsed, {
    ok: false,
    error: "mark_universal does not accept an application payload",
  });
});

test("block and needs-source actions require an auditable reason", () => {
  for (const action of ["block_strict", "needs_source"] as const) {
    assert.deepEqual(parseOneAiQualityMutation({ action, expectedRevision: 3 }), {
      ok: false,
      error: `${action} requires a reason`,
    });
  }
});

test("rejects invalid revision, scope pairing and year ranges", () => {
  assert.equal(
    parseOneAiQualityMutation({
      action: "save_draft",
      expectedRevision: 0,
      application,
    }).ok,
    false
  );
  assert.equal(
    parseOneAiQualityMutation({
      action: "save_draft",
      expectedRevision: "1",
      application,
    }).ok,
    false
  );
  assert.equal(
    parseOneAiQualityMutation({
      action: "save_draft",
      expectedRevision: 1,
      application: { ...application, scope: "moto" },
    }).ok,
    false
  );
  assert.equal(
    parseOneAiQualityMutation({
      action: "save_draft",
      expectedRevision: 1,
      application: { ...application, yearFrom: 2026, yearTo: 2021 },
    }).ok,
    false
  );
  assert.equal(
    parseOneAiQualityMutation({
      action: "save_draft",
      expectedRevision: 1,
      application: { ...application, make: { value: "BMW" } },
    }).ok,
    false
  );
  assert.equal(
    parseOneAiQualityMutation({
      action: "verify_and_reindex",
      expectedRevision: 1,
      application,
      evidence: { excerpt: { value: "not schema-bound" } },
    }).ok,
    false
  );
});

test("optimistic revision helper increments only the expected revision", () => {
  assert.equal(nextOneAiQualityRevision(11, 11), 12);

  assert.throws(
    () => nextOneAiQualityRevision(12, 11),
    (error: unknown) => {
      assert.equal(error instanceof OneAiQualityRevisionConflictError, true);
      if (!(error instanceof OneAiQualityRevisionConflictError)) return false;
      assert.equal(error.expectedRevision, 11);
      assert.equal(error.currentRevision, 12);
      return true;
    }
  );
});

test("optimistic revision helper rejects malformed revisions", () => {
  assert.throws(() => nextOneAiQualityRevision(0, 0), TypeError);
  assert.throws(() => nextOneAiQualityRevision(1.5, 1), TypeError);
});

test("undo accepts exactly one prior revision selector", () => {
  const byId = parseOneAiQualityMutation({
    action: "undo",
    expectedRevision: 9,
    targetRevisionId: "revision_4",
    reason: "Restore the last manager-verified state",
  });
  const byNumber = parseOneAiQualityMutation({
    action: "undo",
    expectedRevision: 9,
    targetRevision: 4,
  });

  assert.equal(byId.ok, true);
  assert.equal(byNumber.ok, true);
  if (byId.ok) {
    assert.equal(byId.value.targetRevisionId, "revision_4");
    assert.equal(byId.value.targetRevision, null);
  }
  if (byNumber.ok) {
    assert.equal(byNumber.value.targetRevisionId, null);
    assert.equal(byNumber.value.targetRevision, 4);
  }
});

test("undo fails closed on ambiguous targets and mutation payloads", () => {
  assert.deepEqual(
    parseOneAiQualityMutation({
      action: "undo",
      expectedRevision: 9,
    }),
    {
      ok: false,
      error: "undo requires exactly one targetRevisionId or targetRevision",
    }
  );
  assert.equal(
    parseOneAiQualityMutation({
      action: "undo",
      expectedRevision: 9,
      targetRevisionId: "revision_4",
      targetRevision: 4,
    }).ok,
    false
  );
  assert.deepEqual(
    parseOneAiQualityMutation({
      action: "undo",
      expectedRevision: 9,
      targetRevision: 4,
      application,
    }),
    {
      ok: false,
      error: "undo does not accept an application payload",
    }
  );
  assert.deepEqual(
    parseOneAiQualityMutation({
      action: "undo",
      expectedRevision: 9,
      targetRevision: 4,
      evidence: { excerpt: "Do not trust client-supplied restore evidence" },
    }),
    {
      ok: false,
      error: "undo does not accept an evidence payload",
    }
  );
});

test("undo snapshot restores admin and indexer canonical application contracts", () => {
  const adminSnapshot = parseOneAiQualityUndoSnapshot(
    {
      status: "READY",
      qualityFlags: [],
      applications: [
        {
          productId: "product_1",
          variantId: "variant_1",
          scope: "auto",
          vehicleType: "car",
          make: "BMW",
          model: "M3",
          chassisCode: "g80",
          yearFrom: 2021,
          yearTo: 2026,
          opfGpf: "with",
          verificationStatus: "VERIFIED",
          isUniversal: false,
        },
      ],
    },
    "product_1"
  );
  const indexerSnapshot = parseOneAiQualityUndoSnapshot(
    {
      targetStatus: "NEEDS_REVIEW",
      qualityFlags: ["fitment_needs_review"],
      applications: [
        {
          productId: "product_1",
          variantId: null,
          scope: "auto",
          vehicleType: "car",
          make: "BMW",
          model: "M3",
          chassisCode: "F80",
          opfGpf: "unknown",
          fitmentStatus: "inferred",
          isUniversal: false,
        },
      ],
    },
    "product_1"
  );

  assert.equal(adminSnapshot.ok, true);
  assert.equal(indexerSnapshot.ok, true);
  if (adminSnapshot.ok) {
    assert.equal(adminSnapshot.value.applications[0].chassisCode, "G80");
    assert.equal(adminSnapshot.value.applications[0].verificationStatus, "VERIFIED");
  }
  if (indexerSnapshot.ok) {
    assert.equal(indexerSnapshot.value.status, "NEEDS_REVIEW");
    assert.equal(indexerSnapshot.value.applications[0].verificationStatus, "NEEDS_REVIEW");
  }
});

test("undo snapshot rejects cross-product or contradictory blocked state", () => {
  const crossProduct = parseOneAiQualityUndoSnapshot(
    {
      status: "READY",
      applications: [
        {
          productId: "product_2",
          scope: "auto",
          make: "BMW",
          verificationStatus: "VERIFIED",
        },
      ],
    },
    "product_1"
  );
  const contradictoryBlock = parseOneAiQualityUndoSnapshot(
    {
      status: "BLOCKED",
      qualityFlags: ["blocked_strict:manager"],
      applications: [
        {
          productId: "product_1",
          scope: "auto",
          make: "BMW",
          verificationStatus: "VERIFIED",
        },
      ],
    },
    "product_1"
  );
  const validBlock = parseOneAiQualityUndoSnapshot(
    {
      status: "BLOCKED",
      qualityFlags: ["blocked_strict:manager"],
      applications: [],
    },
    "product_1"
  );

  assert.equal(crossProduct.ok, false);
  assert.equal(contradictoryBlock.ok, false);
  assert.equal(validBlock.ok, true);
  if (validBlock.ok) assert.equal(validBlock.value.strictBlocked, true);
});
