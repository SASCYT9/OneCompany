import assert from "node:assert/strict";
import test from "node:test";

import { getShopAiExactSkuLookupToken } from "../../../src/lib/shopAiExactSku";

test("exact SKU baseline normalizes only structured part-code queries", () => {
  assert.equal(getShopAiExactSkuLookupToken(" S-BM/T/33 "), "sbmt33");
  assert.equal(getShopAiExactSkuLookupToken("ABC-123"), "abc123");
  assert.equal(getShopAiExactSkuLookupToken("exhaust"), null);
  assert.equal(getShopAiExactSkuLookupToken("BMW M3 2018"), null);
  assert.equal(getShopAiExactSkuLookupToken("find ABC-123"), null);
});
