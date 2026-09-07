import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("src/app/[locale]/shop/components/AdroHomeSignature.tsx", "utf8");
const collage = source.slice(
  source.indexOf("{/* Row 1 — 4 photos */}"),
  source.indexOf("{/* Row 2 — photo, TEXT CARD (span 2), photo */}")
);

test("ADRO below-fold collage does not eagerly fetch its four photos", () => {
  assert.equal(collage.indexOf('loading="eager"'), -1);
  // The four cells share one mapped JSX template, so one lazy attribute
  // covers all four rendered photos.
  assert.equal((collage.match(/loading=\"lazy\"/g) ?? []).length, 1);
});
