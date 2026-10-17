import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const STRICT = "src/app/(strict-http)/[locale]";
const STREAMED = "src/app/[locale]";

const redirectRoutes = [
  ...["akrapovic", "adro", "csf", "do88", "girodisc", "ilmberger", "ipe", "ohlins", "racechip"].map(
    (store) => `shop/${store}/products/page.tsx`
  ),
  "shop/brand/[brand]/page.tsx",
  "shop/ohlins/collections/[handle]/page.tsx",
  "shop/ipe/collections/[handle]/page.tsx",
  "categories/[slug]/page.tsx",
];

test("routes that answer with a redirect or a 404 live outside the loading boundaries", () => {
  // Live 2026-10-17: under [locale]/loading.tsx these answered 200 with a
  // meta refresh, and unknown collection handles or categories a soft 404.
  assert.ok(!existsSync(`${STRICT}/loading.tsx`));
  assert.ok(!existsSync(`${STRICT}/shop/loading.tsx`));
  for (const route of redirectRoutes) {
    assert.ok(existsSync(`${STRICT}/${route}`), route);
    assert.ok(!existsSync(`${STREAMED}/${route}`), `${route} must not also exist under [locale]`);
    const source = readFileSync(`${STRICT}/${route}`, "utf8");
    // Legacy URLs move for good: 308, not 307.
    assert.match(source, /permanentRedirect\(/, route);
    assert.doesNotMatch(source, /\bredirect\(/, route);
  }
});
