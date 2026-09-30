import assert from "node:assert/strict";
import test from "node:test";
import { normalizeDo88SnapshotProduct } from "../../../src/lib/shopCatalogDo88Normalization";
import { normalizeBurgerSnapshotProduct } from "../../../src/lib/shopCatalogBurgerNormalization";
import { normalizeGirodiscSnapshotProduct } from "../../../src/lib/shopCatalogGirodiscNormalization";

function product(title: string, tags: string[]) {
  return {
    id: "source-year-fixture",
    slug: "source-year-fixture",
    sku: "TEST",
    scope: "auto",
    title: { ua: title, en: title },
    tags,
    variants: [{ id: "variant", sku: "TEST", isDefault: true }],
  };
}

test("all source adapters preserve an open-ended year instead of one year", () => {
  for (const marker of ["2021+", "2021-"]) {
    const sources = [
      normalizeDo88SnapshotProduct(
        product("BMW M3 hose", ["Vehicle Specific", "fits-make:bmw", `BMW M3 G80 (${marker})`])
      ),
      normalizeBurgerSnapshotProduct(
        product(`BMW M3 intake (${marker})`, ["brand:bmw", "model:M3", "chassis:G80", "engine:S58"])
      ),
      normalizeGirodiscSnapshotProduct(
        product(`Front rotors Ford Mustang (${marker})`, ["fits-make:ford"])
      ),
    ];
    for (const source of sources) {
      assert.ok(source.applications.length);
      assert.equal(source.applications[0].yearFrom, 2021);
      assert.equal(source.applications[0].yearTo, null);
    }
    assert.equal(
      sources[2].applications[0].generation,
      null,
      "a year cannot become a chassis code"
    );
  }
});
