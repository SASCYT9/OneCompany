import test from "node:test";
import assert from "node:assert/strict";
import {
  getShopSearchFallbackQuery,
  isOneShopSearchTypo,
} from "../../../src/lib/shopSearchRecovery";
import { buildShopSearchText } from "../../../src/lib/shopSearch";

const catalog = [
  { titleText: buildShopSearchText(["Akrapovič exhaust BMW M3"]), brandText: "akrapovic" },
  { titleText: "remus exhaust audi rsq8" },
  { titleText: "eventuri intake bmw m4" },
  { titleText: "карбоновий дифузор urban audi rsq8" },
];
test("one typo includes insertion, deletion, replacement and adjacent transposition", () => {
  for (const wrong of ["akrapovci", "akrapoviic", "akrapovi", "akrapovik"])
    assert.equal(isOneShopSearchTypo(wrong, "akrapovic"), true);
  assert.equal(isOneShopSearchTypo("akrppovik", "akrapovic"), false);
});
test("zero-result recovery uses actual catalog words in both languages", () => {
  for (const [query, expected] of [
    ["akrapovci m3", "akrapovic m3"],
    ["remys rsq8", "remus rsq8"],
    ["eventrui m4", "eventuri m4"],
    ["дифузро rsq8", "дифузор rsq8"],
    ["fi exhuast rsq8", "fi exhaust rsq8"],
  ]) {
    assert.equal(getShopSearchFallbackQuery(query, catalog), expected);
  }
});
test("recovery preserves model, chassis, SKU and short brand identities", () => {
  for (const query of [
    "fi m4",
    "rsq7",
    "m33",
    "g81",
    "S-PO/T/8X",
    "zz rsq8",
    "unknownproductword rsq8",
    "remus bmw",
  ])
    assert.equal(getShopSearchFallbackQuery(query, catalog), null);
  const ambiguous = [{ titleText: "brake brace" }];
  assert.equal(getShopSearchFallbackQuery("braxe", ambiguous), null);
});
