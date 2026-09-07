import assert from "node:assert/strict";
import test from "node:test";
import type { ShopProduct } from "../../../src/lib/shopCatalog";
import { projectCrossShopRecommendationCards } from "../../../src/lib/crossShopRecommendationCard";
import { buildShopStorefrontProductPathForProduct } from "../../../src/lib/shopStorefrontRouting";
import { localizeShopProductTitle } from "../../../src/lib/shopText";
import {
  createCachedCrossShopFitmentMatcher,
  findCrossShopFitmentMatches,
} from "../../../src/lib/crossShopFitment";

function product(
  slug: string,
  brand: string,
  model = "M3",
  chassis = "G80",
  eur = 100
): ShopProduct {
  return {
    slug,
    sku: slug,
    brand,
    scope: "auto",
    title: { ua: `BMW ${model} ${chassis}`, en: `BMW ${model} ${chassis}` },
    tags: ["fits-make:bmw", `fits-model:bmw:${model.toLowerCase()}`, `fits-chassis:${chassis}`],
    category: { ua: "", en: "" },
    collection: { ua: "", en: "" },
    shortDescription: { ua: "", en: "" },
    longDescription: { ua: "", en: "" },
    leadTime: { ua: "", en: "" },
    stock: "inStock",
    price: { eur, usd: 0, uah: 0 },
    image: "",
    highlights: [],
  };
}

test("cached matching preserves rankings, exclusions, duplicate slugs and limits", () => {
  const target = product("target", "RaceChip");
  const catalog = [
    target,
    product("a", "iPE"),
    product("a", "iPE"),
    product("b", "Öhlins", "M3", "G80", 200),
    product("c", "iPE", "M3", "G80", 300),
    product("excluded", "Brabus"),
    product("other-car", "iPE", "X5", "F15"),
  ];
  const cached = createCachedCrossShopFitmentMatcher();
  assert.ok(findCrossShopFitmentMatches(target, catalog).length > 0);
  for (const options of [
    {},
    { perBrand: 1, totalLimit: 1 },
    { minScore: 1000 },
    { totalLimit: 0 },
  ]) {
    const expected = findCrossShopFitmentMatches(target, catalog, options);
    assert.deepEqual(cached(target, catalog, options), expected);
    assert.deepEqual(cached(target, catalog.slice(), options), expected);
  }
});

test("catalog replacement refreshes fitment and removed products cannot linger", () => {
  const target = product("target", "RaceChip");
  const oldCatalog = [product("candidate", "iPE")];
  const cached = createCachedCrossShopFitmentMatcher();
  assert.ok(cached(target, oldCatalog).length > 0);
  const refreshed = [product("candidate", "iPE", "X5", "F15")];
  assert.deepEqual(cached(target, refreshed), findCrossShopFitmentMatches(target, refreshed));
  assert.deepEqual(cached(target, []), []);
});

test("cached fitment does not cache prices, matches or caller options", () => {
  const target = product("target", "RaceChip");
  const catalog = [product("a", "iPE"), product("b", "Öhlins", "M3", "G80", 200)];
  const cached = createCachedCrossShopFitmentMatcher();
  cached(target, catalog);
  catalog[0].price.eur = 1000;
  assert.deepEqual(
    cached(target, catalog, { totalLimit: 1 }),
    findCrossShopFitmentMatches(target, catalog, { totalLimit: 1 })
  );
});

test("card projection preserves both locale titles, canonical links, prices and fitment", () => {
  const target = product("target", "RaceChip");
  const candidate = product("a", "iPE");
  candidate.longDescription = {
    ua: "Довгий опис".repeat(1000),
    en: "Long description".repeat(1000),
  };
  candidate.gallery = Array.from({ length: 30 }, (_, index) => `/image-${index}.webp`);
  const groups = findCrossShopFitmentMatches(target, [candidate]);
  const cards = projectCrossShopRecommendationCards(groups);
  const card = cards[0].matches[0];
  for (const locale of ["ua", "en"] as const) {
    assert.equal(
      localizeShopProductTitle(locale, card.product),
      localizeShopProductTitle(locale, candidate)
    );
    assert.equal(
      buildShopStorefrontProductPathForProduct(locale, card.product),
      buildShopStorefrontProductPathForProduct(locale, candidate)
    );
  }
  assert.deepEqual(card.product.price, candidate.price);
  assert.deepEqual(card.fitment, groups[0].matches[0].fitment);
  assert.equal("longDescription" in card.product, false);
  assert.equal("gallery" in card.product, false);
  assert.ok(JSON.stringify(cards).length < JSON.stringify(groups).length / 10);
  assert.ok(candidate.gallery.length === 30);
});
