import assert from "node:assert/strict";
import test from "node:test";

import {
  assertShopKnowledgeV2OtherQuarantineCommitSafe,
  SHOP_KNOWLEDGE_V2_OTHER_QUARANTINE_REASON,
} from "../../../src/lib/shopKnowledgeV2/quarantineContract";

test("other quarantine uses an explicit exact-SKU-only reason", () => {
  assert.match(SHOP_KNOWLEDGE_V2_OTHER_QUARANTINE_REASON, /categoryGroup=other/);
  assert.match(SHOP_KNOWLEDGE_V2_OTHER_QUARANTINE_REASON, /exact-SKU identity/i);
});

test("other quarantine commit is compare-and-swap guarded", () => {
  assert.doesNotThrow(() =>
    assertShopKnowledgeV2OtherQuarantineCommitSafe({
      candidateCount: 151,
      expectedCount: 151,
      maxRecords: 500,
    })
  );
  assert.throws(
    () =>
      assertShopKnowledgeV2OtherQuarantineCommitSafe({
        candidateCount: 152,
        expectedCount: 151,
        maxRecords: 500,
      }),
    /candidate set changed/
  );
  assert.throws(
    () =>
      assertShopKnowledgeV2OtherQuarantineCommitSafe({
        candidateCount: 151,
        expectedCount: 151,
        maxRecords: 100,
      }),
    /refused 151 records/
  );
});
