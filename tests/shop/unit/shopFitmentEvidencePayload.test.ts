import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { registerTestModuleHooks } from "./testHooks.mjs";
import { extractProductFitment } from "../../../src/lib/crossShopFitment";

registerTestModuleHooks({
  mockUrl: pathToFileURL(path.resolve("tests/shop/unit/fixtures/fitment-evidence-mocks.mjs")).href,
  mockedAliases: ["@/lib/prisma"],
});

test("evidence-only catalog omits commerce data without changing extracted compatibility", async () => {
  const { getShopFitmentCatalogProducts } =
    await import("../../../src/lib/shopFitmentCatalogServer");
  const { calls } = await import("./fixtures/fitment-evidence-mocks.mjs");
  const full = await getShopFitmentCatalogProducts();
  calls.length = 0;
  const slim = await getShopFitmentCatalogProducts({ evidenceOnly: true });
  assert.deepEqual(slim.map(extractProductFitment), full.map(extractProductFitment));
  assert.deepEqual(
    slim.map((p) => p.id),
    full.map((p) => p.id)
  );
  const detail = calls.find(
    (call: { select: { variants?: unknown; priceUsd?: unknown } }) =>
      !("variants" in call.select) && "priceUsd" in call.select
  );
  assert.equal(detail.select.priceUsd, false);
  assert.equal(detail.select.image, false);
  assert.equal(detail.select.variants, undefined);
  assert.ok(detail.select.collections);
});
