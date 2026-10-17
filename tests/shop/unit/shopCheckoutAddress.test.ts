import assert from "node:assert/strict";
import test from "node:test";
import { missingShopCheckoutFields, shopCountryUsesPostcode } from "../../../src/lib/shopCheckoutAddress";
import {
  getShopCountryRegions,
  isShopCountryRegion,
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
  // Either language is accepted, other countries' regions are not, and no CLDR
  // footnote marks ("Île-de-France²") reach the list.
  assert.equal(isShopCountryRegion("UA", "Київська область"), true);
  assert.equal(isShopCountryRegion("UA", "kyiv oblast"), true);
  assert.equal(isShopCountryRegion("DE", "Київська область"), false);
  assert.ok(getShopCountryRegions("FR", "en").some((region) => region.name === "Île-de-France"));
  const marked = ["FR", "CI", "MK", "NP"].flatMap((code) =>
    getShopCountryRegions(code, "en").filter((region) => /[²³¹†‡*]/u.test(region.name))
  );
  assert.deepEqual(marked, []);
});

test("checkout demands every field except where the country has none", () => {
  assert.deepEqual(
    missingShopCheckoutFields({ countryCode: "DE", countryHasRegions: true }),
    ["lastName", "phone", "line2", "region", "postcode"]
  );
  assert.deepEqual(
    missingShopCheckoutFields({
      lastName: "Chan",
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
