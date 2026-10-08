import assert from "node:assert/strict";
import test from "node:test";

import {
  applyShopCategoryGroupSettingsToFacet,
  defaultShopCategoryGroupSettings,
  mergeShopCategoryGroupSettings,
  normalizeShopCategoryGroupSettingsPayload,
  resolveShopCategoryGroupIdFromSettings,
} from "@/lib/shopCategoryGroupSettings";

test("shop category group settings", async (t) => {
  await t.test("defaults cover every taxonomy group and keep `other` last", () => {
    const defaults = defaultShopCategoryGroupSettings();
    assert.ok(defaults.map((item) => item.id).includes("chipTuning"));
    const sorted = [...defaults].sort((a, b) => a.sortOrder - b.sortOrder);
    assert.equal(sorted.at(-1)?.id, "other");
  });

  await t.test("merges stored rows field by field and ignores unknown ids", () => {
    const merged = mergeShopCategoryGroupSettings([
      { id: "exhaust", titleUa: "Вихлопи", isPublished: false },
      { id: "ghost", titleUa: "X" },
    ]);
    const exhaust = merged.find((item) => item.id === "exhaust");
    assert.deepEqual({ ...exhaust }, { ...exhaust, titleUa: "Вихлопи", isPublished: false, titleEn: "Exhaust systems" });
    assert.equal(merged.some((item) => (item.id as string) === "ghost"), false);
  });

  await t.test("validates the admin payload", () => {
    assert.equal(normalizeShopCategoryGroupSettingsPayload({ groups: [{ id: "nope" }] }).errors.length, 1);
    assert.ok(
      normalizeShopCategoryGroupSettingsPayload([
        { id: "exhaust", titleUa: "A", titleEn: "B", sortOrder: 1.5 },
      ]).errors.includes("exhaust: sortOrder must be an integer")
    );
    const ok = normalizeShopCategoryGroupSettingsPayload({
      groups: [{ id: "exhaust", titleUa: " A ", titleEn: "B", sortOrder: 5, isPublished: false }],
    });
    assert.deepEqual(ok.errors, []);
    assert.equal(ok.data[0].titleUa, "A");
    assert.equal(ok.data[0].isPublished, false);
  });

  await t.test("applies labels, hides unpublished groups and orders the facet", () => {
    const settings = mergeShopCategoryGroupSettings([
      { id: "brakes", titleEn: "Brake kits", sortOrder: -1 },
      { id: "merch", isPublished: false },
    ]);
    const items = [
      { key: "exhaust", label: "Вихлопні системи", count: 100 },
      { key: "merch", label: "Мерч", count: 10 },
      { key: "brakes", label: "Гальмівна система", count: 5 },
    ];
    const result = applyShopCategoryGroupSettingsToFacet(items, settings, "en");
    assert.deepEqual(result.map((item) => item.key), ["brakes", "exhaust"]);
    assert.equal(result[0].label, "Brake kits");
  });

  await t.test("a renamed group title resolves back to its stable id", () => {
    const settings = mergeShopCategoryGroupSettings([{ id: "exhaust", titleUa: "Вихлопи" }]);
    assert.equal(resolveShopCategoryGroupIdFromSettings("вихлопи", settings), "exhaust");
    assert.equal(resolveShopCategoryGroupIdFromSettings("Nothing", settings), null);
  });

  await t.test("rejects titles that collide with another group", () => {
    const { errors } = normalizeShopCategoryGroupSettingsPayload([
      { id: "brakes", titleUa: "вихлопні системи", titleEn: "Brakes", sortOrder: 0 },
    ]);
    assert.ok(errors.some((message) => message.includes("already used")));
  });
});
