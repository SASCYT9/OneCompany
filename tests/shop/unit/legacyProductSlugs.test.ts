import test from "node:test";
import assert from "node:assert/strict";
import { legacyProductSlugCandidates } from "../../../src/lib/legacyProductSlugs";

test("renamed iPE slugs map to their `-exhaust` successor", () => {
  assert.deepEqual(legacyProductSlugCandidates("ipe-mclaren-600lt-titanium-exhaust"), [
    "ipe-mclaren-600lt-exhaust",
  ]);
  assert.deepEqual(
    legacyProductSlugCandidates("ipe-ferrari-f12-berlinetta-titanium-exhaust-system"),
    [
      "ipe-ferrari-f12-berlinetta-exhaust",
      "ipe-ferrari-f12-berlinetta-exhaust-system",
      "ipe-ferrari-f12-berlinetta-titanium-exhaust",
    ]
  );
  assert.deepEqual(legacyProductSlugCandidates("ipe-mclaren-720s-titanium"), [
    "ipe-mclaren-720s-exhaust",
  ]);
  assert.deepEqual(legacyProductSlugCandidates("ipe-porsche-911-gt3-rs-997-997-2-exhaust-system"), [
    "ipe-porsche-911-gt3-rs-997-997-2-exhaust",
  ]);
});

test("only iPE slugs are considered and a slug never maps to itself", () => {
  assert.deepEqual(legacyProductSlugCandidates("akrapovic-s-bm-t-27h"), []);
  assert.deepEqual(legacyProductSlugCandidates("brabus-titanium-exhaust"), []);
  assert.deepEqual(legacyProductSlugCandidates("ipe-mclaren-720s-exhaust"), []);
  assert.deepEqual(legacyProductSlugCandidates("ipe-titanium"), []);
  assert.deepEqual(legacyProductSlugCandidates(""), []);
});
