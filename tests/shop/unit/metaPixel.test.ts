import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildMetaPixelBootstrap } from "../../../src/components/analytics/MetaPixel";

test("Meta Pixel bootstrap initialises the pixel and sends one landing PageView", () => {
  const bootstrap = buildMetaPixelBootstrap("1234567890");
  assert.match(bootstrap, /fbq\('init', "1234567890"\);/);
  assert.equal((bootstrap.match(/fbq\('track', 'PageView'\)/g) ?? []).length, 1);
  assert.match(bootstrap, /https:\/\/connect\.facebook\.net\/en_US\/fbevents\.js/);
  // The ID is serialised, so a malformed env value cannot break out of the string.
  assert.match(
    buildMetaPixelBootstrap(`1'); alert(1); ('`),
    /fbq\('init', "1'\); alert\(1\); \('"\);/
  );
});

test("Meta Pixel loads after hydration and tracks client-side navigations itself", () => {
  const source = readFileSync("src/components/analytics/MetaPixel.tsx", "utf8");
  assert.match(source, /strategy="afterInteractive"/);
  assert.doesNotMatch(source, /lazyOnload/);
  // next/script never fires onLoad for inline scripts; route changes must not depend on it.
  assert.doesNotMatch(source, /onLoad=/);
  assert.doesNotMatch(source, /react-facebook-pixel/);
  assert.match(source, /window\.fbq\?\.\("track", "PageView"\)/);
});
