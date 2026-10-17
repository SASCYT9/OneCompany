import assert from "node:assert/strict";
import test from "node:test";
import { missingShopCheckoutFields, shopCountryUsesPostcode } from "../../../src/lib/shopCheckoutAddress";
import {
  getShopCountryRegions,
  shopCountryHasRegions,
} from "../../../src/lib/shopCountryRegions.server";

test("Ukraine lists its oblasts in Ukrainian on the Ukrainian site", () => {
  const regions = getShopCountryRegions("UA", "ua");
  assert.equal(regions.length, 27);
  assert.ok(regions.some((region) => region.name === "Київська область"));
  assert.ok(getShopCountryRegions("UA", "en").some((region) => region.name === "Kyiv Oblast"));
});

test("foreign regions stay in Latin script for the carrier", () => {
  const germany = getShopCountryRegions("DE", "ua");
  assert.equal(germany.length, 16);
  assert.ok(germany.some((region) => region.name === "Bavaria"));
  assert.ok(getShopCountryRegions("us", "en").some((region) => region.name === "California"));
  assert.deepEqual(getShopCountryRegions("ZZ", "en"), []);
  assert.equal(shopCountryHasRegions("ZZ"), false);
});

test("checkout demands every field except where the country has none", () => {
  assert.deepEqual(
    missingShopCheckoutFields({ countryCode: "DE", countryHasRegions: true }),
    ["phone", "line2", "region", "postcode"]
  );
  assert.deepEqual(
    missingShopCheckoutFields({
      phone: "+852 1234 5678",
      line2: "Flat 1",
      countryCode: "HK",
      countryHasRegions: false,
    }),
    []
  );
  assert.equal(shopCountryUsesPostcode("UA"), true);
  assert.equal(shopCountryUsesPostcode("AE"), false);
});
