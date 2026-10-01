import assert from "node:assert/strict";
import { test } from "node:test";
import { buildShopVariantGallery } from "../../../src/lib/shopVariantGallery";

test("changing configuration keeps all product views after the selected variant photo", () => {
  const views = ["front.jpg", "back.jpg", "installed.jpg", "detail.jpg", "kit.jpg"];
  assert.deepEqual(buildShopVariantGallery("front.jpg", views, "controller.jpg"),
    ["controller.jpg", ...views]);
  assert.deepEqual(buildShopVariantGallery("front.jpg", views, "kit.jpg"),
    ["kit.jpg", "front.jpg", "back.jpg", "installed.jpg", "detail.jpg"]);
});

test("configuration without media falls back to the product gallery", () => {
  assert.deepEqual(buildShopVariantGallery("front.jpg", ["front.jpg", "", " back.jpg "]),
    ["front.jpg", "back.jpg"]);
  assert.deepEqual(buildShopVariantGallery(null, null), []);
});
