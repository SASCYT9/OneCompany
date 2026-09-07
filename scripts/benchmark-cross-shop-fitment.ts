// DB-less benchmark: only reads existing local fallback artifacts.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import type { ShopProduct } from "../src/lib/shopCatalog";
import { projectCrossShopRecommendationCards } from "../src/lib/crossShopRecommendationCard";
import {
  createCachedCrossShopFitmentMatcher,
  findCrossShopFitmentMatches,
  isExcludedFromCrossShop,
} from "../src/lib/crossShopFitment";

const directory = path.resolve("public/catalog-fallback");
const manifest = JSON.parse(fs.readFileSync(path.join(directory, "manifest.json"), "utf8")) as {
  stores: Record<string, { file: string }>;
};
const products = Object.values(manifest.stores).flatMap(
  ({ file }) => JSON.parse(fs.readFileSync(path.join(directory, file), "utf8")) as ShopProduct[]
);
const eligible = products.filter((product) => !isExcludedFromCrossShop(product));
const candidates = eligible.map((product) => ({
  ...product,
  options: undefined,
  bundle: undefined,
  galleryMaterials: undefined,
  externalVideos: undefined,
}));
const targets = Array.from(
  { length: 16 },
  (_, index) => eligible[Math.floor((index * eligible.length) / 16)]
);
const options = { perBrand: 3, totalLimit: 24 };
const baselineStart = performance.now();
const expected = targets.map((target) => findCrossShopFitmentMatches(target, products, options));
const baselineMs = performance.now() - baselineStart;
const cached = createCachedCrossShopFitmentMatcher();
const coldStart = performance.now();
cached(targets[0], candidates, options);
const firstCallMs = performance.now() - coldStart;
const warmStart = performance.now();
const actual = targets.map((target) => cached(target, candidates, options));
const warmMs = performance.now() - warmStart;
assert.deepEqual(
  actual.map(projectCrossShopRecommendationCards),
  expected.map(projectCrossShopRecommendationCards)
);
const originalPayloadBytes = Buffer.byteLength(JSON.stringify(expected));
const cardPayloadBytes = Buffer.byteLength(
  JSON.stringify(actual.map(projectCrossShopRecommendationCards))
);
console.log(
  JSON.stringify(
    {
      products: products.length,
      candidates: candidates.length,
      targets: targets.length,
      baselineMs: Math.round(baselineMs),
      firstCachedCallMs: Math.round(firstCallMs),
      warmMs: Math.round(warmMs),
      warmSpeedup: Number((baselineMs / warmMs).toFixed(2)),
      resultsIdentical: true,
      originalPayloadBytes,
      cardPayloadBytes,
      payloadReductionPercent: Number(
        ((1 - cardPayloadBytes / originalPayloadBytes) * 100).toFixed(1)
      ),
    },
    null,
    2
  )
);
