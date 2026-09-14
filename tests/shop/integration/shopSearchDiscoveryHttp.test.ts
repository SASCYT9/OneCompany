import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { getKwCardTitle } from "../../../src/lib/shopKwCardPresentation";

const baseUrl = process.env.SHOP_SEARCH_ALIAS_TEST_BASE_URL;
if (baseUrl && !["localhost", "127.0.0.1"].includes(new URL(baseUrl).hostname))
  throw new Error("Discovery regression requires a local storefront");
type Product = {
  sku: string;
  slug: string;
  brand: string;
  scope: string;
  title: { ua: string; en: string };
};
type Result = {
  data: Array<{ type?: string; name?: string; brand?: string; partNumber?: string; slug?: string }>;
  meta?: { totalItems?: number; correctedQuery?: string; fallbackApplied?: string };
};
async function search(
  endpoint: string,
  query: string,
  extra: Record<string, string> = {}
): Promise<Result> {
  const response = await fetch(
    `${baseUrl}/api/shop/stock/${endpoint}?${new URLSearchParams({ q: query, locale: "ua", scope: "auto", limit: "96", ...extra })}`,
    { signal: AbortSignal.timeout(45_000) }
  );
  assert.equal(response.status, 200, query);
  return response.json();
}
let products: Product[] = [];
if (baseUrl) {
  const root = path.resolve("public/catalog-fallback");
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
  products = Object.values(manifest.stores as Record<string, { file: string }>).flatMap((entry) =>
    JSON.parse(fs.readFileSync(path.join(root, entry.file), "utf8"))
  );
}
const regressionSkus = [
  "VELOSTERNADROKIT",
  "S-CU/T/2H",
  "S-BM/T/18H",
  "DP-ME/SS/3",
  "P-HF880",
  "96482212AA",
  "DI-PO/CA/9/G",
  "L-PO/T/13/1",
  "E-PO/T/6/1",
  "TP-T/S/28",
  "P-HF1225",
  "96482293BA",
];
const samples = new Map<string, Product>();
for (const product of products)
  if (!samples.has(product.brand) || regressionSkus.includes(product.sku))
    samples.set(regressionSkus.includes(product.sku) ? product.sku : product.brand, product);
for (const product of samples.values()) {
  test(`full title discovery: ${product.brand} ${product.sku}`, async () => {
    for (const endpoint of ["search", "suggest"]) {
      const result = await search(endpoint, product.title.ua, { scope: product.scope });
      assert.ok(
        result.data.some((item) => item.slug === product.slug || item.partNumber === product.sku),
        `${endpoint}: ${product.title.ua}`
      );
      if (endpoint === "search")
        assert.ok(
          (result.meta?.totalItems ?? 0) < 100,
          "one full title cannot match the entire catalog"
        );
    }
    const cardTitle = getKwCardTitle({
      brand: product.brand,
      title: product.title.ua,
      locale: "ua",
    });
    if (cardTitle !== product.title.ua) {
      const result = await search("search", cardTitle, { scope: product.scope });
      assert.ok(
        result.data.some((item) => item.slug === product.slug || item.partNumber === product.sku),
        cardTitle
      );
    }
  });
}
for (const [query, brand] of [
  ["akrapovci m3", "akrap"],
  ["eventrui m3", "eventuri"],
  ["remys rsq8", "remus"],
  ["fi exhuast rsq8", "fi"],
]) {
  test(`catalog typo recovery: ${query}`, { skip: !baseUrl }, async () => {
    for (const endpoint of ["search", "suggest"]) {
      const result = await search(endpoint, query);
      assert.ok(result.meta?.correctedQuery, endpoint);
      assert.ok(
        result.data.some((item) =>
          `${item.brand ?? ""} ${item.name ?? ""}`.toLowerCase().includes(brand)
        ),
        endpoint
      );
    }
  });
}
test("no match cannot silently drop an explicit brand selection", { skip: !baseUrl }, async () => {
  const result = await search("search", "fi rsq8", { brand: "Urban Automotive" });
  assert.equal(result.data.length, 0);
  assert.equal(result.meta?.fallbackApplied, null);
});

test("iPE cannot match rival exhausts through the word pipe", { skip: !baseUrl }, async () => {
  for (const endpoint of ["search", "suggest"]) {
    const result = await search(endpoint, "iPE RS6");
    assert.equal(result.data.filter((item) => item.partNumber).length, 0, endpoint);
  }
});

for (const query of ["do88 M3", "do 88 M3", "M3 DO88", "do-88 E92"]) {
  test(`alphanumeric brand remains required: ${query}`, { skip: !baseUrl }, async () => {
    for (const locale of ["ua", "en"]) {
      for (const endpoint of ["search", "suggest"]) {
        const result = await search(endpoint, query, { locale });
        const products = result.data.filter((item) => item.partNumber);
        assert.ok(products.length > 0, `${locale} ${endpoint}: ${query}`);
        assert.ok(
          products.every((item) => item.brand?.toLowerCase() === "do88"),
          `${locale} ${endpoint} must preserve the requested brand: ${query}`
        );
      }
    }
  });
}

for (const [sku, productSku] of [
  ["217-999-296", "217-999-296"],
  ["464-999-296", "464-999-296"],
  ["447-666-296", "447-666-296"],
  ["LM-URUS-CBOE + TIP-URUS-S", "LM-URUS-CBOE + TIP-URUS-S"],
  ["MB-GTR-XPOE", "MB-GTR-XPOE"],
  ["BM3-OTS-N20-N26", "BM3-OTS-BUNDLE"],
  ["BM3-LIC-S55", "BM3-LIC-S55"],
  ["BMS 6W00", "BMS 6W00"],
]) {
  test(`exact primary or variant SKU: ${sku}`, { skip: !baseUrl }, async () => {
    for (const endpoint of ["search", "suggest"]) {
      const result = await search(endpoint, sku);
      assert.ok(
        result.data.some((item) => item.partNumber === productSku),
        `${endpoint}: ${sku}`
      );
    }
  });
}
