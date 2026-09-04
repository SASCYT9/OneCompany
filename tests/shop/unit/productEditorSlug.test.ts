import assert from "node:assert/strict";
import test from "node:test";
import { productEditorSlug } from "../../../src/lib/admin/productEditorSlug";

test("a Ukrainian-only product title generates a usable URL", () => {
  assert.equal(productEditorSlug("Карбоновий спойлер"), "karbonovyy-spoyler");
  assert.equal(productEditorSlug("Підвіска KW V3 — BMW M3"), "pidviska-kw-v3-bmw-m3");
});

test("URL generation handles accents, punctuation and existing ASCII slugs", () => {
  assert.equal(productEditorSlug("  Coupé / M3  "), "coupe-m3");
  assert.equal(productEditorSlug("kw-v3-bmw-m3"), "kw-v3-bmw-m3");
  assert.equal(productEditorSlug("!!!"), "");
});
