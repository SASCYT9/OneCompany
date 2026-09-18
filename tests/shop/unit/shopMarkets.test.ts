import assert from "node:assert/strict";
import test from "node:test";
import { SHOP_COUNTRIES } from "../../../src/lib/shopCountries";
import { isEuVatCountry } from "../../../src/lib/shopEuVat";
import {
  addMissingShopMarketZones,
  groupShopCountriesByMarket,
  resolveShopMarket,
  SHOP_MARKETS,
  type ShopMarket,
} from "../../../src/lib/shopMarkets";

test("America means US only, with legacy address names accepted", () => {
  for (const country of ["US", "USA", "United States", "United States of America"]) {
    assert.equal(resolveShopMarket(country), "america");
  }
  for (const country of ["CA", "Canada", "MX", "Brazil", "PR", "", "unknown"]) {
    assert.equal(resolveShopMarket(country), "other");
  }
});

test("Ukraine is separate; the Europe commercial market does not imply EU VAT", () => {
  assert.equal(resolveShopMarket("Ukraine"), "ukraine");
  assert.equal(resolveShopMarket("UA"), "ukraine");
  for (const country of ["DE", "Germany", "Poland", "UK", "Switzerland", "Moldova"]) {
    assert.equal(resolveShopMarket(country), "europe");
  }
  assert.equal(isEuVatCountry("DE"), true);
  assert.equal(isEuVatCountry("UK"), false);
  assert.equal(isEuVatCountry("CH"), false);
});

test("country grouping retains every existing country once and respects filtered results", () => {
  const groups = groupShopCountriesByMarket(SHOP_COUNTRIES);
  assert.deepEqual(
    groups.map((group) => group.id),
    ["ukraine", "europe", "america", "other"]
  );
  const codes = groups.flatMap((group) => group.countries.map((country) => country.code));
  assert.equal(codes.length, SHOP_COUNTRIES.length);
  assert.equal(new Set(codes).size, SHOP_COUNTRIES.length);
  assert.deepEqual(
    groups.find((group) => group.id === "america")?.countries.map((c) => c.code),
    ["US"]
  );
  const filtered = groupShopCountriesByMarket(
    SHOP_COUNTRIES.filter((country) => country.code === "PL")
  );
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, "europe");
  assert.equal(filtered[0].countries[0].code, "PL");
  assert.deepEqual(groupShopCountriesByMarket([]), []);
});

type Zone = { id: string; countriesText: string; baseRate: number; enabled: boolean };
const createZone = (market: ShopMarket): Zone => ({
  id: market.shippingZoneId,
  countriesText: market.countries.join(", "),
  baseRate: 0,
  enabled: false,
});

test("zone preparation preserves existing overrides and inserts drafts before worldwide", () => {
  const existing: Zone[] = [
    { id: "ua-standard", countriesText: "UA, Ukraine", baseRate: 0, enabled: true },
    { id: "de-express", countriesText: "DE, Germany", baseRate: 42, enabled: true },
    { id: "worldwide-standard", countriesText: " * ", baseRate: 50, enabled: true },
  ];
  const before = structuredClone(existing);
  const next = addMissingShopMarketZones(existing, createZone);
  assert.deepEqual(existing, before);
  assert.deepEqual(
    next.map((zone) => zone.id),
    ["ua-standard", "de-express", "europe-standard", "us-standard", "worldwide-standard"]
  );
  assert.equal(next[0], existing[0]);
  assert.equal(next[1], existing[1]);
  assert.equal(next[4], existing[2]);
  assert.equal(next[2].enabled, false);
  assert.equal(next[3].enabled, false);
  assert.deepEqual(addMissingShopMarketZones(next, createZone), next);
});

test("empty configuration can prepare all three zones without a wildcard or US territories", () => {
  const next = addMissingShopMarketZones<Zone>([], createZone);
  assert.equal(next.length, 3);
  assert.ok(next.every((zone) => !zone.enabled));
  assert.ok(next.every((zone) => !zone.countriesText.includes("*")));
  const america = SHOP_MARKETS.find((market) => market.id === "america")!;
  assert.deepEqual(america.countries, ["US", "USA", "United States", "United States of America"]);
});
