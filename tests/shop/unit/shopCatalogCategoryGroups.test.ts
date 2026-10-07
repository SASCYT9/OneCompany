import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { registerHooks } from "./testHooks.mjs";
import type { ShopCatalogProjectionSource } from "../../../src/lib/shopCatalogProjection.server";

const serverOnlyStub = pathToFileURL(
  path.resolve("tests/shop/unit/fixtures/server-only-stub.cjs")
).href;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") return { url: serverOnlyStub, shortCircuit: true };
    return nextResolve(specifier, context);
  },
});

const projectionModule = import("../../../src/lib/shopCatalogProjection.server");
const queryModule = import("../../../src/lib/shopCatalogProjectionQuery.server");

function source(input: {
  brand: string;
  title: string;
  titleEn?: string;
  sku?: string;
  category?: { key: string; ua: string; en: string } | null;
  categoryGroupKey?: string | null;
  tags?: string[];
}): ShopCatalogProjectionSource {
  return {
    productId: `product-${input.brand}-${input.sku ?? "x"}`,
    sourceVersion: "1",
    catalogVersion: "1",
    sourceUpdatedAt: new Date("2026-10-07T00:00:00.000Z"),
    canonicalContentHash: "b".repeat(64),
    canonicalRelationCounts: { variants: 0, media: 0, applications: 0 },
    slug: `${input.brand}-${input.sku ?? "x"}`.toLowerCase(),
    sku: input.sku ?? "SKU-1",
    scopeKey: "auto",
    statusKey: "ACTIVE",
    stockKey: "inStock",
    isPublished: true,
    stableRank: 1,
    brand: { id: null, key: input.brand, labelUa: input.brand, labelEn: input.brand },
    category: input.category
      ? {
          id: `category-${input.category.key}`,
          key: input.category.key,
          labelUa: input.category.ua,
          labelEn: input.category.en,
        }
      : null,
    categoryGroupKey: input.categoryGroupKey ?? null,
    productTypeKey: null,
    productKindKey: null,
    locales: {
      ua: { title: input.title, cardCopy: null, searchTerms: [] },
      en: { title: input.titleEn ?? input.title, cardCopy: null, searchTerms: [] },
    },
    primaryMedia: null,
    tags: input.tags ?? [],
    collectionKeys: [],
    sharedSearchTerms: [],
    variants: [],
    compatibilityPolicies: [],
  } as unknown as ShopCatalogProjectionSource;
}

test("every projected product gets a storefront group even without an admin category", async () => {
  const { buildShopCatalogProjection } = await projectionModule;
  const groupOf = (input: Parameters<typeof source>[0]) =>
    buildShopCatalogProjection(source(input)).projections[0]!.categoryGroupKey;

  assert.equal(groupOf({ brand: "RaceChip", title: "RaceChip GTS 5 — Audi RS6" }), "chipTuning");
  assert.equal(
    groupOf({ brand: "Remus", title: "Remus Sport Exhaust Cat-back BMW M3", sku: "R1" }),
    "exhaust"
  );
  assert.equal(groupOf({ brand: "GiroDisc", title: "GiroDisc rotor 2-piece", sku: "G1" }), "brakes");
  assert.equal(
    groupOf({ brand: "KW Suspensions", title: "KW V3 coilover kit", sku: "K1" }),
    "suspension"
  );
  assert.equal(groupOf({ brand: "Nobody", title: "Mystery part", sku: "Z9" }), "other");
});

test("the group is derived from the taxonomy and is identical for both locales", async () => {
  const { buildShopCatalogProjection } = await projectionModule;
  const build = buildShopCatalogProjection(
    source({ brand: "Remus", title: "Вихлопна система Remus", titleEn: "Remus exhaust system" })
  );
  assert.deepEqual(
    build.projections.map((row) => row.categoryGroupKey),
    ["exhaust", "exhaust"]
  );
});

test("the admin category link is kept, only the group is added", async () => {
  const { buildShopCatalogProjection } = await projectionModule;
  const row = buildShopCatalogProjection(
    source({
      brand: "BMC",
      title: "BMC air filter",
      category: { key: "air-filters", ua: "Повітряні фільтри", en: "Air filters" },
      categoryGroupKey: "air-filters",
    })
  ).projections[0]!;
  assert.equal(row.categoryKey, "air-filters");
  assert.equal(row.categoryLabel, "Повітряні фільтри");
  assert.equal(row.categoryGroupKey, "performance");
});

test("an explicit valid group id on the source wins over keyword matching", async () => {
  const { buildShopCatalogProjection } = await projectionModule;
  const row = buildShopCatalogProjection(
    source({ brand: "Remus", title: "Remus exhaust", categoryGroupKey: "accessories" })
  ).projections[0]!;
  assert.equal(row.categoryGroupKey, "accessories");
});

test("group names and ids select by the stored group; other values keep the admin category match", async () => {
  const { buildShopCatalogProjectionFacetQuerySql, buildShopCatalogProjectionWhere } =
    await queryModule;
  for (const category of ["exhaust", "Вихлопні системи", "Exhaust systems"]) {
    const query = buildShopCatalogProjectionFacetQuerySql({ locale: "ua", category });
    assert.match(query.sql, /projection\."categoryGroupKey" = \?/);
    assert.ok(query.values.includes("exhaust"));
    assert.deepEqual(buildShopCatalogProjectionWhere({ locale: "ua", category }).AND, [
      { categoryGroupKey: "exhaust" },
    ]);
  }
  const legacy = buildShopCatalogProjectionFacetQuerySql({ locale: "ua", category: "air-filters" });
  assert.match(legacy.sql, /lower\(projection\."categoryKey"\) = lower\(/);
  assert.doesNotMatch(legacy.sql, /projection\."categoryGroupKey" = \?/);
});

test("the category facet counts the storefront group instead of the admin category", async () => {
  const { buildShopCatalogProjectionFacetQuerySql } = await queryModule;
  const { sql } = buildShopCatalogProjectionFacetQuerySql({ locale: "ua" });
  assert.match(sql, /GROUP BY projection\."categoryGroupKey"/);
  assert.doesNotMatch(sql, /GROUP BY projection\."categoryKey"/);
});

test("real supplier titles without an admin category land in the right storefront group", async () => {
  const { getShopStockCategoryGroupForProduct } = await import(
    "../../../src/lib/shopStockTaxonomy"
  );
  const cases: Array<[brand: string, title: string, expected: string]> = [
    ["Remus", "GPF-Back-System for VW Golf 8 CD R 4x GT Black Tips", "exhaust"],
    ["Remus", "RS3 Sedan, Outlet Tubes", "exhaust"],
    ["AKRAPOVIC", "AKRAPOVIC E-PO/T/4 Комплект випускних колекторів Evolution (титан) для PORSCHE 911 GT3", "exhaust"],
    ["AKRAPOVIC", "AKRAPOVIC L-PO/T/17 Лінк-пайпи (титан) для PORSCHE 718 Cayman GT4RS", "exhaust"],
    ["AKRAPOVIC", "AKRAPOVIC DI-BM/CA/11/G Задній дифузор (карбон / глянець) для BMW M5", "carbonAero"],
    ["BootMod3", "Ліцензія bootmod3 S63TU — BMW M5 F10", "chipTuning"],
    ["Brabus", "PowerXtra B40S – 800 для Mercedes – W 463A – AMG G 63", "chipTuning"],
    ["Brabus", "Шкіряні дверні панелі BRABUS на базі Rolls – Royce Ghost", "interior"],
    ["Brabus", "BRABUS Спортивні пружини – з регулюванням висоти для Mercedes – R 232", "suspension"],
    ["WheelForce", "Комплект дисків WheelForce R.2-FG Rhodium 22″ для BMW M5 G90/G99", "wheels"],
    ["Urban Automotive", "Литий диск Urban UC4 20\" Gloss Black для Volkswagen Transporter T6.1", "wheels"],
    ["Urban Automotive", "Капот Urban у зборі для Rolls-Royce Cullinan Series II", "carbonAero"],
    ["CSF", "CSF 8233B Колектор охолоджувача наддувного повітря S58 для BMW M3", "cooling"],
    ["Eventuri", "Колектор впускний карбоновий для BMW E92 M3", "performance"],
    ["Burger Motorsports", "JB4PRO пакет 450 whp для Kia Stinger / Genesis G70 3.3T", "chipTuning"],
    ["Burger Motorsports", "BMS Wheel Spacers для Toyota 4Runner 2025+ — 1″ або 1.5″", "wheels"],
  ];
  for (const [brand, title, expected] of cases) {
    const group = getShopStockCategoryGroupForProduct(
      { product: { brand, title: { ua: title, en: title } } },
      "ua"
    );
    assert.equal(group.id, expected, `${brand}: ${title}`);
  }
});

test("untitled parts of single-discipline brands fall back to the brand's group, keywords still win", async () => {
  const { getShopStockCategoryGroupForProduct } = await import(
    "../../../src/lib/shopStockTaxonomy"
  );
  const groupOf = (brand: string, title: string) =>
    getShopStockCategoryGroupForProduct(
      { product: { brand, title: { ua: title, en: title } } },
      "ua"
    ).id;
  assert.equal(groupOf("Remus", "Part: 089618 0500LR"), "exhaust");
  assert.equal(groupOf("AKRAPOVIC", "AKRAPOVIC P-HF1523 Монтажний комплект для BMW M2"), "exhaust");
  assert.equal(groupOf("AKRAPOVIC", "AKRAPOVIC 801636 Поло чоловіче Akrapovič Logo чорне, L"), "merch");
  assert.equal(groupOf("Burger Motorsports", "BMS Billet Oil Filler Cap для Subaru"), "accessories");
  assert.equal(groupOf("Brabus", "Алюмінієві штифти дверних замків для Mercedes"), "accessories");
  assert.equal(groupOf("Unknown brand", "Mystery part"), "other");
});

test("until projections are rebuilt the facet and filter keep reading the admin category", async () => {
  const { buildShopCatalogProjectionFacetQuerySql, buildShopCatalogProjectionWhere } =
    await queryModule;
  const legacy = buildShopCatalogProjectionFacetQuerySql({
    locale: "ua",
    category: "Вихлопні системи",
    categoryGroupsReady: false,
  });
  assert.doesNotMatch(legacy.sql, /categoryGroupKey/);
  assert.match(legacy.sql, /GROUP BY projection\."categoryKey"/);
  assert.match(legacy.sql, /lower\(projection\."categoryKey"\) = lower\(/);
  assert.deepEqual(
    JSON.stringify(
      buildShopCatalogProjectionWhere({
        locale: "ua",
        category: "exhaust",
        categoryGroupsReady: false,
      }).AND
    ).includes("categoryGroupKey"),
    false
  );
  const ready = buildShopCatalogProjectionFacetQuerySql({ locale: "ua", categoryGroupsReady: true });
  assert.match(ready.sql, /GROUP BY projection\."categoryGroupKey"/);
});

test("the Volkswagen Polo model is not apparel, polo shirts are", async () => {
  const { getShopStockCategoryGroupForProduct } = await import(
    "../../../src/lib/shopStockTaxonomy"
  );
  const groupOf = (brand: string, title: string) =>
    getShopStockCategoryGroupForProduct(
      { product: { brand, title: { ua: title, en: title } } },
      "ua"
    ).id;
  assert.equal(groupOf("RaceChip", "RaceChip GTS 5 — Volkswagen Polo GTI 2.0 TSI"), "chipTuning");
  assert.equal(groupOf("KW Suspensions", "KW V1 для Volkswagen Polo 6R"), "suspension");
  assert.equal(groupOf("AKRAPOVIC", "AKRAPOVIC 801636 Поло чоловіче Akrapovič Logo, L"), "merch");
});

test("a leather accessory is an accessory while leather trim stays interior", async () => {
  const { getShopStockCategoryGroupForProduct } = await import(
    "../../../src/lib/shopStockTaxonomy"
  );
  const groupOf = (title: string) =>
    getShopStockCategoryGroupForProduct(
      { product: { brand: "Brabus", title: { ua: title, en: title } } },
      "ua"
    ).id;
  assert.equal(groupOf("Шкіряний чохол для ключа BRABUS"), "accessories");
  assert.equal(groupOf("Шкіряні дверні панелі BRABUS на базі Rolls – Royce Ghost"), "interior");
  assert.equal(groupOf("Шкіряна центральна консоль для Mercedes – X 167"), "interior");
});
