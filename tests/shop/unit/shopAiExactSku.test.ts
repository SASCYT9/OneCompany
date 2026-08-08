import assert from "node:assert/strict";
import test from "node:test";

import { getShopAiExactSkuLookupToken } from "../../../src/lib/shopAiExactSku";

test("exact SKU baseline normalizes only structured part-code queries", () => {
  assert.equal(getShopAiExactSkuLookupToken(" S-BM/T/33 "), "sbmt33");
  assert.equal(getShopAiExactSkuLookupToken("ABC-123"), "abc123");
  assert.equal(getShopAiExactSkuLookupToken("exhaust"), null);
  assert.equal(getShopAiExactSkuLookupToken("BMW M3 2018"), null);
  assert.equal(getShopAiExactSkuLookupToken("find ABC-123"), null);
  assert.equal(getShopAiExactSkuLookupToken("Знайди товар за артикулом S-PO/TI/5H"), "spoti5h");
  assert.equal(getShopAiExactSkuLookupToken("SKU: ABC-123"), "abc123");
  assert.equal(getShopAiExactSkuLookupToken("SKU URB-HOO-25358201-V1"), "urbhoo25358201v1");
  assert.equal(getShopAiExactSkuLookupToken("SKU ABC-123 XYZ-987"), null);
  assert.equal(getShopAiExactSkuLookupToken("SKU WBA8D9G50JNU12345"), null);
});
