import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("Next config invokes the release guard before enabling V2 route modules", () => {
  const source = fs.readFileSync(new URL("../../../next.config.ts", import.meta.url), "utf8");
  const guard = source.indexOf("assertShopCatalogReleaseActivation({");
  const rewriteDecision = source.indexOf("const shouldRewriteCatalogV2ToLegacy");
  assert.ok(guard > 0);
  assert.ok(rewriteDecision > guard);
  assert.match(source, /SHOP_CATALOG_V2_CANARY_PERCENTAGE/);
  assert.match(source, /SHOP_CATALOG_V2_RELEASE_GATE_MARKER/);
  assert.match(source, /VERCEL_GIT_COMMIT_SHA/);
});
