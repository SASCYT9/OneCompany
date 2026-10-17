import assert from "node:assert/strict";
import test from "node:test";
import {
  missingShopCheckoutFields,
  shopCheckoutCustomerName,
  shopCountryUsesPostcode,
} from "../../../src/lib/shopCheckoutAddress";
import { resolveShopCountry } from "../../../src/lib/shopCountries";
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

test("Ukrainian country names resolve to the same country as the English ones", () => {
  assert.equal(resolveShopCountry("Україна")?.code, "UA");
  assert.equal(resolveShopCountry("  україна ")?.code, "UA");
  assert.equal(resolveShopCountry("Німеччина")?.code, "DE");
  assert.equal(resolveShopCountry("Germany")?.code, "DE");
  assert.equal(resolveShopCountry("Ukraine")?.code, "UA");
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

test("the stored customer name never drops the validated surname", () => {
  assert.equal(shopCheckoutCustomerName({ name: "Buyer", lastName: "Doe" }), "Buyer Doe");
  assert.equal(shopCheckoutCustomerName({ name: "Oleksandr  Pryklad", lastName: "Pryklad" }), "Oleksandr Pryklad");
  assert.equal(shopCheckoutCustomerName({ name: "Buyer", firstName: "John", lastName: "Doe" }), "John Doe");
  // Only a whole-word match counts as "already there".
  assert.equal(shopCheckoutCustomerName({ name: "Ivanna", lastName: "Ivan" }), "Ivanna Ivan");
  assert.equal(shopCheckoutCustomerName({ name: "Buyer" }), "Buyer");
  // A surname alone is not a name.
  assert.equal(shopCheckoutCustomerName({ lastName: "Doe" }), "");
});
