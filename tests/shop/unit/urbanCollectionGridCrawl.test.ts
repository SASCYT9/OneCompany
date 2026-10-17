import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const grid = readFileSync(
  "src/app/[locale]/shop/components/UrbanCollectionProductGrid.tsx",
  "utf8"
);

test("every Urban collection product is in the HTML, cards past 'Показати ще' stay hidden", () => {
  // Live 2026-10-17: the Defender collection linked 17 of its 44 products; the
  // rest only appeared after a click, so crawlers never saw them.
  assert.match(grid, /products\.map\(\(product, index\) =>/);
  assert.doesNotMatch(grid, /products\.slice\(0, visibleCount\)/);
  assert.match(grid, /<article key=\{product\.slug\} hidden className="urban-product-grid__card">/);
});

test("cards shown by 'Показати ще' animate in instead of staying transparent", () => {
  // Live 2026-10-17: they mounted after the grid's in-view animation and kept
  // opacity 0, leaving an empty area under the first page.
  assert.match(grid, /index >= pageSize \? \{ initial: "hidden", animate: "show" \} : \{\}/);
});
