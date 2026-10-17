import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  missingShopCheckoutFields,
  shopCheckoutCustomerName,
  shopCountryUsesPostcode,
} from "../../../src/lib/shopCheckoutAddress";
import { resolveShopCountry } from "../../../src/lib/shopCountries";
import { buildShopSettingsRuntimeFromPayload } from "../../../src/lib/shopAdminSettings";
import { buildCheckoutSettingsPreview } from "../../../src/lib/shopCheckout";
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

test("a failed region list load offers a retry instead of a free-text region", () => {
  const checkout = readFileSync("src/app/[locale]/shop/checkout/ShopCheckoutClient.tsx", "utf8");
  // The server accepts only listed regions, so free text would be a dead end.
  assert.doesNotMatch(checkout, /\[regionListKey\]: null/);
  assert.match(checkout, /setRegionListFailed\(regionListKey\)/);
  assert.match(checkout, /onClick=\{\(\) => setRegionListFailed\(null\)\}/);
  assert.match(checkout, /Спробувати ще раз/);
});

test("region rules match one oblast in Ukrainian or English, never every Ukrainian name", () => {
  const settings = buildShopSettingsRuntimeFromPayload({
    defaultCurrency: "UAH",
    enabledCurrencies: ["UAH"],
    currencyRates: { EUR: 1, USD: 1.15, UAH: 50 },
    shippingZones: [
      { id: "kyiv-oblast", name: "Kyiv Oblast", countries: ["Ukraine", "UA"], regions: ["Kyiv Oblast"], baseRate: 100, perItemRate: 0, currency: "UAH", enabled: true },
    ],
    taxRegions: [],
  } as never);
  const zoneFor = (region: string) =>
    buildCheckoutSettingsPreview(settings, {
      currency: "UAH",
      subtotal: 1000,
      itemCount: 1,
      shippingAddress: { country: "Ukraine", city: "Test", line1: "Test", region },
    }).shippingZone?.id ?? null;
  // The Ukrainian site submits the Ukrainian name of the same subdivision.
  assert.equal(zoneFor("Київська область"), "kyiv-oblast");
  assert.equal(zoneFor("Kyiv Oblast"), "kyiv-oblast");
  // Another oblast, or Kyiv city, must not fall into the Kyiv Oblast rule.
  assert.equal(zoneFor("Львівська область"), null);
  assert.equal(zoneFor("Київ"), null);

  // A rule written in Cyrillic matches its own oblast only (no shared blank value).
  const cyrillic = buildShopSettingsRuntimeFromPayload({
    defaultCurrency: "UAH",
    enabledCurrencies: ["UAH"],
    currencyRates: { EUR: 1, USD: 1.15, UAH: 50 },
    shippingZones: [
      { id: "lviv", name: "Львів", countries: ["Ukraine", "UA"], regions: ["Львівська область"], baseRate: 80, perItemRate: 0, currency: "UAH", enabled: true },
    ],
    taxRegions: [],
  } as never);
  const cyrillicZone = (region: string) =>
    buildCheckoutSettingsPreview(cyrillic, {
      currency: "UAH",
      subtotal: 1000,
      itemCount: 1,
      shippingAddress: { country: "Ukraine", city: "Test", line1: "Test", region },
    }).shippingZone?.id ?? null;
  assert.equal(cyrillicZone("Львівська область"), "lviv");
  assert.equal(cyrillicZone("Lviv Oblast"), "lviv");
  assert.equal(cyrillicZone("Київська область"), null);
});

test("country rules match by name or ISO code, whichever the rule uses", () => {
  const zoneFor = (countries: string[], country: string) =>
    buildCheckoutSettingsPreview(
      buildShopSettingsRuntimeFromPayload({
        defaultCurrency: "EUR",
        enabledCurrencies: ["EUR"],
        currencyRates: { EUR: 1, USD: 1.15, UAH: 50 },
        shippingZones: [
          { id: "zone", name: "Zone", countries, baseRate: 30, perItemRate: 0, currency: "EUR", enabled: true },
        ],
        taxRegions: [],
      } as never),
      { currency: "EUR", subtotal: 1000, itemCount: 1, shippingAddress: { country, city: "Berlin", line1: "Test" } }
    ).shippingZone?.id ?? null;
  assert.equal(zoneFor(["DE"], "Germany"), "zone");
  assert.equal(zoneFor(["Germany"], "DE"), "zone");
  assert.equal(zoneFor(["DE"], "Austria"), null);
});
