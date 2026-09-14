import assert from "node:assert/strict";
import test from "node:test";

// Read-only HTTP regression against the DB-less storefront and public snapshot.
// Run with SHOP_SEARCH_ALIAS_TEST_BASE_URL=http://localhost:3100.
const baseUrl = process.env.SHOP_SEARCH_ALIAS_TEST_BASE_URL;
if (baseUrl && !["localhost", "127.0.0.1"].includes(new URL(baseUrl).hostname)) {
  throw new Error("Search alias regression must use a local storefront");
}
const fiSku = "AD-Q8RS-CBOE";
const fiM3Skus = ["BN-82M-CBE + TIP63101S*4", "BN-G82MF-CBE + TIP70114S*4 + CAB-BTB*2"];
type SearchResponse = {
  data: Array<{ type?: string; partNumber?: string; brand?: string; name?: string }>;
  meta?: { totalItems: number };
};

async function search(endpoint: "search" | "suggest", query: string, locale = "ua") {
  const params = new URLSearchParams({ q: query, locale, scope: "auto", limit: "100" });
  const response = await fetch(`${baseUrl}/api/shop/stock/${endpoint}?${params}`, {
    signal: AbortSignal.timeout(30_000),
  });
  assert.equal(response.status, 200, `${endpoint}: ${query}`);
  return (await response.json()) as SearchResponse;
}

const queries = [
  "fi rsq8",
  "rsq8 fi",
  "RSQ8 Fi Exhaust",
  "RSQ8 Exhaust Fi",
  "Fi RSQ8 Exhaust",
  "Fi Exhaust RSQ8",
  "Exhaust Fi RSQ8",
  "Exhaust RSQ8 Fi",
  "RS Q8 Fi",
  "Fi RS-Q8",
  "RS Q 8 Fi-Exhaust",
  "FiExhaust RSQ 8",
  "Frequency Intelligent Exhaust RS Q8",
  "фі ауді RSQ8",
  "ауди RS Q8 фи",
  "AD-Q8RS-CBOE",
];

for (const locale of ["ua", "en"]) {
  for (const query of [
    "Fi m3",
    "m3 fi",
    "Fi Exhaust BMW M3",
    "M 3 FiExhaust",
    "БМВ М3 фі",
    "BMW M-3 Fi-Exhaust",
  ]) {
    test(`Fi M3 HTTP ${locale}: ${query}`, { skip: !baseUrl }, async () => {
      for (const endpoint of ["search", "suggest"] as const) {
        const result = await search(endpoint, query, locale);
        const products = result.data.filter((item) => !item.type || item.type === "product");
        assert.deepEqual(
          products.map((item) => item.partNumber).sort(),
          [...fiM3Skus].sort(),
          `${endpoint}: ${query}`
        );
        assert.ok(products.every((item) => item.brand?.toLowerCase() === "fi exhaust"));
      }
    });
  }
  for (const query of queries) {
    test(`Fi RSQ8 HTTP ${locale}: ${query}`, { skip: !baseUrl }, async () => {
      const results = await Promise.all([
        search("search", query, locale),
        search("suggest", query, locale),
      ]);
      for (const result of results) {
        const products = result.data.filter((item) => !item.type || item.type === "product");
        assert.equal(products[0]?.partNumber, fiSku, `${locale}: ${query}`);
        assert.ok(
          products.every((item) => item.brand?.toLowerCase() === "fi exhaust"),
          query
        );
      }
    });
  }
}

test(
  "S Q8 HTTP aliases preserve SQ8 results without including the RSQ8-only Fi product",
  { skip: !baseUrl },
  async () => {
    for (const endpoint of ["search", "suggest"] as const) {
      const baseline = await search(endpoint, "SQ8");
      for (const query of ["S Q8", "S-Q8", "S Q 8"]) {
        const result = await search(endpoint, query);
        assert.deepEqual(result.data, baseline.data, `${endpoint}: ${query}`);
        assert.equal(
          result.data.some((item) => item.partNumber === fiSku),
          false,
          query
        );
      }
    }
  }
);

test(
  "an unknown product word cannot fall back to unrelated RSQ8 products",
  { skip: !baseUrl },
  async () => {
    for (const endpoint of ["search", "suggest"] as const) {
      const result = await search(endpoint, "fi rsq8 nonexistentproductword");
      assert.equal(result.data.length, 0, endpoint);
    }
  }
);
