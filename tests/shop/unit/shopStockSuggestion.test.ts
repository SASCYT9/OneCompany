import test from "node:test";
import assert from "node:assert/strict";

import { shouldIncludeStockSuggestionMatch } from "../../../src/lib/shopStockSuggestion";

test("strict SKU suggestions reject unrelated products with partial text tokens", () => {
  assert.equal(
    shouldIncludeStockSuggestionMatch({
      strictSkuQuery: true,
      tokenCount: 1,
      tokenMatches: 1,
      compactQuery: "epot7",
      compactSku: "urbfro25358176v1",
    }),
    false
  );
});

test("strict SKU suggestions accept a compact SKU match", () => {
  assert.equal(
    shouldIncludeStockSuggestionMatch({
      strictSkuQuery: true,
      tokenCount: 1,
      tokenMatches: 1,
      compactQuery: "epot7",
      compactSku: "epot7",
    }),
    true
  );
});

test("text suggestions continue to accept complete token matches", () => {
  assert.equal(
    shouldIncludeStockSuggestionMatch({
      strictSkuQuery: false,
      tokenCount: 2,
      tokenMatches: 2,
      compactQuery: "bmwm3",
      compactSku: "unrelated",
    }),
    true
  );
});

test("vehicle names cannot bypass missing query words through an SKU substring", () => {
  assert.equal(
    shouldIncludeStockSuggestionMatch({
      strictSkuQuery: false,
      tokenCount: 3,
      tokenMatches: 2,
      compactQuery: "rsq8",
      compactSku: "rcgts5audirsq840tfsi",
      allowCompactSkuMatch: false,
    }),
    false
  );
  assert.equal(
    shouldIncludeStockSuggestionMatch({
      strictSkuQuery: false,
      tokenCount: 1,
      tokenMatches: 0,
      compactQuery: "sq8",
      compactSku: "rcgts5audirsq840tfsi",
      allowCompactSkuMatch: false,
    }),
    false
  );
});
