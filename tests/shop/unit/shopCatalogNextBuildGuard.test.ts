import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("Next config keeps Catalog V2 behind the explicit off/canary/ssr reader mode", () => {
  const source = fs.readFileSync(new URL("../../../next.config.ts", import.meta.url), "utf8");
  const rewriteDecision = source.indexOf("const shouldRewriteCatalogV2ToLegacy");
  assert.ok(rewriteDecision > 0);
  assert.match(source, /\["ssr", "canary"\]\.includes\(catalogV2ReaderMode/);
  assert.doesNotMatch(source, /assertShopCatalogReleaseActivation/);
});
