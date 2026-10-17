import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ADRO_PRODUCT_LINES } from "../../../src/app/[locale]/shop/data/adroHomeData";
import { BRABUS_COLLECTION_CARDS } from "../../../src/app/[locale]/shop/data/brabusCollectionsList";
import { DO88_COLLECTION_CARDS } from "../../../src/app/[locale]/shop/data/do88CollectionsList";
import { URBAN_COLLECTION_CARDS } from "../../../src/app/[locale]/shop/data/urbanCollectionsList";
import {
  BRAND_HOME_HEAD,
  adroLineHead,
  brabusCollectionHead,
  do88CollectionHead,
  urbanCollectionHead,
  type HeadCopy,
} from "../../../src/lib/seoHubHeadCopy";

const locales = ["ua", "en"] as const;

function allHubHeads(): Array<[string, HeadCopy]> {
  const heads: Array<[string, HeadCopy]> = [];
  for (const locale of locales) {
    for (const [brand, copy] of Object.entries(BRAND_HOME_HEAD)) {
      heads.push([`${locale} ${brand}`, copy[locale]]);
    }
    for (const card of URBAN_COLLECTION_CARDS) {
      heads.push([`${locale} urban ${card.collectionHandle}`, urbanCollectionHead(locale, card)]);
    }
    for (const card of BRABUS_COLLECTION_CARDS) {
      heads.push([
        `${locale} brabus ${card.collectionHandle}`,
        brabusCollectionHead(locale, card.collectionHandle, card.title),
      ]);
    }
    for (const card of [{ categoryHandle: "all", title: "All Parts" }, ...DO88_COLLECTION_CARDS]) {
      heads.push([
        `${locale} do88 ${card.categoryHandle}`,
        do88CollectionHead(locale, card.categoryHandle, card),
      ]);
    }
    for (const line of ADRO_PRODUCT_LINES) {
      heads.push([`${locale} adro ${line.id}`, adroLineHead(locale, line)]);
    }
  }
  return heads;
}

test("hub titles and descriptions fit the metadata limits and name the site once", () => {
  const heads = allHubHeads();
  assert.equal(heads.length, 122);
  for (const [key, head] of heads) {
    // buildPageMetadata cuts titles over 95 and descriptions over 165 with "…".
    assert.ok(head.title.length <= 95, `${key}: title ${head.title.length}`);
    assert.ok(head.description.length <= 165, `${key}: description ${head.description.length}`);
    assert.match(head.title, / \| One Company$/, key);
    assert.doesNotMatch(`${head.title} ${head.description}`, /OneCompany/, key);
  }
});

test("Ukrainian brand titles say where to buy, and every hub names its brand", () => {
  for (const [brand, copy] of Object.entries(BRAND_HOME_HEAD)) {
    assert.match(copy.ua.title, /Україн/, brand);
  }
  // Live 2026-10-17: "Brabus | One Company", "DO88 Performance | One Company".
  assert.equal(
    BRAND_HOME_HEAD.brabus.ua.title,
    "Тюнінг Brabus в Україні — обвіси, диски, вихлоп | One Company"
  );
  assert.equal(
    BRAND_HOME_HEAD.do88.ua.title,
    "Інтеркулери та радіатори do88 — купити в Україні | One Company"
  );
});

test("collection hubs name the car once and drop the doubled 'Програма'", () => {
  for (const card of URBAN_COLLECTION_CARDS) {
    const { title } = urbanCollectionHead("ua", card);
    assert.ok(title.includes(card.title), title);
    assert.doesNotMatch(title, /(Range Rover|Land Rover|Mercedes-Benz) \1/, title);
  }
  assert.equal(
    urbanCollectionHead("ua", { title: "Defender 90 / 110 / 130", brand: "Land Rover" }).title,
    "Обвіси Urban для Land Rover Defender 90 / 110 / 130 | One Company"
  );
  assert.equal(
    urbanCollectionHead("ua", { title: "Range Rover L460", brand: "Range Rover" }).title,
    "Обвіси Urban для Range Rover L460 | One Company"
  );
  // Live 2026-10-17: "Програма BRABUS Програма G-Class." in the G-Class meta.
  for (const card of BRABUS_COLLECTION_CARDS) {
    const head = brabusCollectionHead("ua", card.collectionHandle, card.title);
    assert.doesNotMatch(head.description, /Програма\s+BRABUS\s+Програма/i, card.collectionHandle);
  }
  assert.equal(
    brabusCollectionHead("ua", "g-class", "G-Class Programme").title,
    "Тюнінг Brabus для Mercedes G-Class — купити в Україні | One Company"
  );
  assert.equal(
    do88CollectionHead("ua", "intercoolers", { title: "Intercoolers" }).title,
    "Інтеркулери do88 — купити в Україні | One Company"
  );
});

test("brand homes and collection routes take their head copy from the shared module", () => {
  const brandPages = [
    "akrapovic",
    "ilmberger",
    "eventuri",
    "csf",
    "ohlins",
    "girodisc",
    "ipe",
    "brabus",
    "do88",
    "racechip",
    "burger",
    "adro",
    "urban",
  ];
  for (const brand of brandPages) {
    const page = readFileSync(`src/app/[locale]/shop/${brand}/page.tsx`, "utf8");
    assert.match(page, new RegExp(`BRAND_HOME_HEAD\\.${brand}\\[resolvedLocale\\]`), brand);
  }
  for (const [brand, builder] of [
    ["brabus", "brabusCollectionHead"],
    ["do88", "do88CollectionHead"],
    ["adro", "adroLineHead"],
    ["urban", "urbanCollectionHead"],
  ]) {
    const page = readFileSync(
      `src/app/[locale]/shop/${brand}/collections/[handle]/page.tsx`,
      "utf8"
    );
    assert.match(page, new RegExp(`${builder}\\(resolvedLocale`), brand);
  }
});
