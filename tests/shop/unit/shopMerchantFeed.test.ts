import test from "node:test";
import assert from "node:assert/strict";
import type { ShopProduct } from "../../../src/lib/shopCatalog";
import {
  buildMerchantFeedIds,
  buildMerchantFeedItemXml,
  escapeXml,
  selectMerchantCoreProducts,
} from "../../../src/lib/shopMerchantFeed";
import {
  SHOP_DIGITAL_IN_STOCK_SKUS,
  SHOP_WAREHOUSE_IN_STOCK_SKUS,
} from "../../../src/lib/shopWarehouseInventory";

const rates = { EUR: 1, USD: 1.1, UAH: 45 };

function makeProduct(overrides: Partial<ShopProduct> = {}): ShopProduct {
  return {
    slug: "remus-bundle-1-950020-1002-30",
    sku: "1-950020-1002-30",
    scope: "auto",
    brand: "Remus",
    title: { ua: "Вихлопна система Remus", en: "Remus exhaust system" },
    category: { ua: "Вихлоп", en: "Exhaust" },
    shortDescription: { ua: "Опис & деталі", en: "Description & details" },
    longDescription: { ua: "", en: "" },
    leadTime: { ua: "", en: "" },
    stock: "inStock",
    collection: { ua: "", en: "" },
    price: { eur: 2000, usd: 0, uah: 0 },
    image: "/images/remus.jpg",
    highlights: [],
    ...overrides,
  };
}

test("feed link is the canonical storefront URL used by the sitemap and page", () => {
  const xml = buildMerchantFeedItemXml(makeProduct(), "en", "EUR", rates);
  assert.match(
    xml,
    /<link>https:\/\/onecompany\.global\/en\/shop\/remus-bundle-1-950020-1002-30<\/link>/
  );

  const racechip = buildMerchantFeedItemXml(
    makeProduct({ slug: "racechip-gts5-audi-a4", brand: "RaceChip", sku: "RC-1" }),
    "ua",
    "EUR",
    rates
  );
  assert.match(
    racechip,
    /<link>https:\/\/onecompany\.global\/ua\/shop\/racechip\/products\/racechip-gts5-audi-a4<\/link>/
  );
});

test("brand plus MPN is not flagged as having no identifier", () => {
  const withIds = buildMerchantFeedItemXml(makeProduct(), "en", "EUR", rates);
  assert.match(withIds, /<g:brand>Remus<\/g:brand>/);
  assert.match(withIds, /<g:mpn>1-950020-1002-30<\/g:mpn>/);
  assert.equal(withIds.includes("identifier_exists"), false);

  const withoutMpn = buildMerchantFeedItemXml(makeProduct({ sku: "" }), "en", "EUR", rates);
  assert.match(withoutMpn, /<g:identifier_exists>false<\/g:identifier_exists>/);
});

test("price is converted to the requested currency and pre-order maps to backorder", () => {
  const xml = buildMerchantFeedItemXml(makeProduct({ stock: "preOrder" }), "en", "USD", rates);
  assert.match(xml, /<g:price>2200\.00 USD<\/g:price>/);
  assert.match(xml, /<g:availability>backorder<\/g:availability>/);
});

test("backorder items carry the availability_date Merchant Center requires", () => {
  const now = new Date("2026-10-16T09:00:00Z");
  const averageLead = buildMerchantFeedItemXml(
    makeProduct({ stock: "preOrder" }),
    "ua",
    "UAH",
    rates,
    { now }
  );
  assert.match(averageLead, /<g:availability_date>2026-11-06T00:00:00Z<\/g:availability_date>/);

  const madeToOrder = buildMerchantFeedItemXml(
    makeProduct({ stock: "preOrder", leadTime: { ua: "4–6 тижнів", en: "4-6 weeks" } }),
    "ua",
    "UAH",
    rates,
    { now }
  );
  assert.match(madeToOrder, /<g:availability_date>2026-11-27T00:00:00Z<\/g:availability_date>/);

  const inStock = buildMerchantFeedItemXml(
    makeProduct({ sku: SHOP_WAREHOUSE_IN_STOCK_SKUS[0] }),
    "ua",
    "UAH",
    rates,
    { now }
  );
  assert.equal(inStock.includes("availability_date"), false);
});

test("g:id is unique per product and within Google's 50-character limit", () => {
  const sharedSku = "RC-GTS5-VW-1-4-TSI-1395CCM-150HP-110KW-250NM";
  const longSku = "RC-GTS5-CITROEN-1-6-BLUEHDI-100-1560CCM-99HP-73KW-254NM";
  const products = [
    { sku: "1-950020-1002-30", slug: "remus-bundle-1-950020-1002-30" },
    { sku: sharedSku, slug: "racechip-gts5-vw-golf-7-1-4-tsi-150hp" },
    { sku: sharedSku, slug: "racechip-gts5-skoda-octavia-3-1-4-tsi-150hp" },
    { sku: longSku, slug: "racechip-gts5-citroen-c4-1-6-bluehdi-99hp" },
    { sku: "", slug: "product-without-sku" },
  ];
  const ids = buildMerchantFeedIds(products);

  // Every ID keeps its SKU prefix, adds a slug hash, is unique and fits 50 characters.
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.equal(id.length <= 50, true, id);
  assert.match(ids[0], /^1-950020-1002-30-[0-9a-z]+$/);
  assert.equal(ids[1].startsWith("RC-GTS5-VW-1-4-TSI"), true);
  assert.equal(ids[3].startsWith("RC-GTS5-CITROEN"), true);
  // Without a SKU, the slug is the ID.
  assert.equal(ids[4], "product-without-sku");
  // Stable: the same product always gets the same ID, whatever else is in the feed,
  // so publishing or removing a product with the same SKU never renames another item.
  assert.deepEqual(buildMerchantFeedIds(products), ids);
  assert.deepEqual(buildMerchantFeedIds([products[2], products[0]]), [ids[2], ids[0]]);
  assert.deepEqual(buildMerchantFeedIds([products[0]]), [ids[0]]);

  const item = buildMerchantFeedItemXml(makeProduct(), "ua", "UAH", rates, { id: ids[1] });
  assert.match(item, new RegExp(`<g:id>${ids[1]}</g:id>`));
  // The SKU still goes to g:mpn untouched.
  assert.match(item, /<g:mpn>1-950020-1002-30<\/g:mpn>/);
});

test("items without a resolvable price or flagged as test are skipped", () => {
  assert.equal(
    buildMerchantFeedItemXml(
      makeProduct({ price: { eur: 0, usd: 0, uah: 0 } }),
      "en",
      "EUR",
      rates
    ),
    ""
  );
  assert.equal(
    buildMerchantFeedItemXml(makeProduct({ tags: ["internal-test"] }), "en", "EUR", rates),
    ""
  );
});

test("every item carries its Nova Poshta size class as the shipping label", () => {
  const exhaust = buildMerchantFeedItemXml(makeProduct(), "ua", "UAH", rates);
  assert.match(exhaust, /<g:shipping_label>large<\/g:shipping_label>/);
  const chip = buildMerchantFeedItemXml(
    makeProduct({ productType: "Chip Tuning", brand: "RaceChip" }),
    "ua",
    "UAH",
    rates
  );
  assert.match(chip, /<g:shipping_label>small<\/g:shipping_label>/);
});

test("text fields are XML-escaped", () => {
  assert.equal(
    escapeXml(`a & b < c > "d" 'e'`),
    "a &amp; b &lt; c &gt; &quot;d&quot; &apos;e&apos;"
  );
  const xml = buildMerchantFeedItemXml(makeProduct(), "en", "EUR", rates);
  assert.match(xml, /<description>Description &amp; details<\/description>/);
});

test("feed titles match the product page title, in Ukrainian for the ua feed", () => {
  // Live 2026-10-17: Remus names are English in the database, so the ua feed
  // sent English titles to a Ukrainian Merchant Center feed.
  const product = makeProduct({
    title: {
      ua: "Sport Exhaust for VW Golf 7 Faclift AU Silencer (956017 1500) | 2x 100mm Titanium Black Tips",
      en: "Sport Exhaust for VW Golf 7 Faclift AU Silencer (956017 1500) | 2x 100mm Titanium Black Tips",
    },
    category: { ua: "Cars / Bundles", en: "Cars / Bundles" },
  });
  assert.match(
    buildMerchantFeedItemXml(product, "ua", "UAH", rates),
    /<title>Вихлопна система Remus для VW Golf 7 Faclift AU Silencer 1-950020-1002-30<\/title>/
  );
  assert.match(
    buildMerchantFeedItemXml(product, "en", "EUR", rates),
    /<title>Sport Exhaust for VW Golf 7 Faclift AU Silencer \(956017 1500\) \| 2x 100mm Titanium Black Tips 1-950020-1002-30 \| Remus<\/title>/
  );
});

test("only warehouse-confirmed items are in stock; supplier stock is a dated backorder", () => {
  // The product page shows "В наявності" only for confirmed items, so the
  // feed must not promise ready stock for supplier-reported "inStock" rows.
  const supplierStock = buildMerchantFeedItemXml(
    makeProduct({ stock: "inStock" }),
    "ua",
    "UAH",
    rates,
    { now: new Date("2026-10-18T00:00:00Z") }
  );
  assert.match(supplierStock, /<g:availability>backorder<\/g:availability>/);
  assert.match(supplierStock, /<g:availability_date>2026-11-08T00:00:00Z<\/g:availability_date>/);
  // Sold to order, so Merchant Center applies the "no returns" exception.
  assert.match(supplierStock, /<g:return_policy_label>made_to_order<\/g:return_policy_label>/);

  const confirmed = buildMerchantFeedItemXml(
    makeProduct({
      sku: SHOP_WAREHOUSE_IN_STOCK_SKUS[0],
      slug: "eventuri-confirmed",
      brand: "Eventuri",
    }),
    "ua",
    "UAH",
    rates
  );
  assert.match(confirmed, /<g:availability>in_stock<\/g:availability>/);
  assert.doesNotMatch(confirmed, /availability_date/);
  assert.doesNotMatch(confirmed, /return_policy_label/);
});

test("core feed: confirmed stock first, then curated brands in turn, up to the limit", () => {
  const product = (brand: string, sku: string) =>
    makeProduct({ brand, sku, slug: sku.toLowerCase() });
  const catalogue = [
    product("KW Suspensions", "KW-1"),
    product("Remus", "REMUS-1"),
    product("AKRAPOVIC", "AK-1"),
    product("AKRAPOVIC", "AK-2"),
    product("Akrapovič", "AK-3"),
    product("Brabus", "BR-1"),
    product("OHLINS", "OH-1"),
    product("Eventuri", SHOP_WAREHOUSE_IN_STOCK_SKUS[0]),
    product("BootMod3", SHOP_DIGITAL_IN_STOCK_SKUS[0]),
  ];

  const core = selectMerchantCoreProducts(catalogue, 5).map((item) => item.sku);
  assert.deepEqual(core, [SHOP_WAREHOUSE_IN_STOCK_SKUS[0], "AK-1", "BR-1", "OH-1", "AK-2"]);
  assert.equal(
    selectMerchantCoreProducts(catalogue, 100).length,
    6,
    "KW, Remus and digital licences stay out"
  );
});
