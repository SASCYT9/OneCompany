import assert from "node:assert/strict";
import test from "node:test";
import { getBmcOfficialProductImage } from "../../../src/lib/bmcOfficialProductImages";

test("BMC media resolves canonical hyphenated SKUs used by product detail pages", () => {
  for (const sku of ["FB409-01", "ACCDA100-220-01", "FBTW90-130PWH", "FBSA20-40"]) {
    const media = getBmcOfficialProductImage(sku);
    assert.ok(media, sku);
    assert.equal(media.status, "exact");
    assert.match(media.image, /^https:\/\/www\.bmcairfilters\.com\//);
    assert.deepEqual(media, getBmcOfficialProductImage(sku.replace(/-/g, "").toLowerCase()));
  }
});

test("BMC media preserves known generic status and rejects unknown codes", () => {
  assert.equal(getBmcOfficialProductImage("ACCDA120-260MUSCLE")?.status, "unconfirmed_code");
  assert.equal(getBmcOfficialProductImage("FBTS60-150P")?.status, "official_generic");
  assert.equal(getBmcOfficialProductImage("unknown"), null);
  assert.equal(getBmcOfficialProductImage(null), null);
});
