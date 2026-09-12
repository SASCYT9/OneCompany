import assert from "node:assert/strict";
import test from "node:test";
import {
  buildStockInitialSearch,
  buildStockPaginationHref,
  parseStockPage,
  stockPageSearchParams,
  stockSearchCacheKey,
} from "../../../src/lib/shopStockInitialSearch";
import { generateMetadata } from "../../../src/app/[locale]/shop/catalog/metadata";
import { getDo88MakeEntries } from "../../../src/app/[locale]/shop/do88/do88FitmentData";

test("initial HTML search stays bounded and matches the existing default regional context", () => {
  for (const [currency, country] of [
    ["EUR", "Germany"],
    ["USD", "United States"],
    ["UAH", "Ukraine"],
  ] as const) {
    const params = buildStockInitialSearch(
      new URLSearchParams("all=true&limit=999999&debug=true&country=DE&locale=xx&page=2"),
      "en",
      currency
    );
    assert.equal(params.get("country"), country);
    assert.equal(params.get("currency"), currency);
    assert.equal(params.get("locale"), "en");
    assert.equal(params.get("page"), "2");
    assert.equal(params.get("scope"), "auto");
    for (const key of ["all", "limit", "debug"]) assert.equal(params.has(key), false);
  }
});

test("initial search preserves supported filters and the single-brand selection", () => {
  const params = buildStockInitialSearch(
    stockPageSearchParams({
      brand: ["BMW,Akrapovic", "do88"],
      q: " S-FE/T/1 ",
      minPrice: " 20,5 ",
      maxPrice: "100",
      scope: "moto",
      make: "Ducati",
      year: "2024",
      engine: " V4 ",
      stock: "inStock",
      sort: "price_desc",
      strict: "1",
      opfGpf: "without",
      page: "3",
    }),
    "ua",
    "EUR"
  );
  assert.equal(params.get("brand"), "BMW");
  assert.equal(params.get("q"), " S-FE/T/1 ");
  assert.equal(params.get("minPrice"), "20.5");
  assert.equal(params.get("scope"), "moto");
  assert.equal(params.get("engine"), "V4");
  assert.equal(params.get("strict"), "1");
  assert.equal(params.get("page"), "3");
  assert.equal(
    stockSearchCacheKey(params),
    stockSearchCacheKey(new URLSearchParams([...params].reverse()))
  );
});

test("pagination URLs preserve filters, normalize page one and reject invalid page numbers", () => {
  const source = new URLSearchParams("brand=KW&page=3&scope=moto");
  assert.equal(
    buildStockPaginationHref("en", source, 2),
    "/en/shop/catalog?brand=KW&scope=moto&page=2"
  );
  assert.equal(buildStockPaginationHref("ua", source, 1), "/ua/shop/catalog?brand=KW&scope=moto");
  for (const value of [null, "0", "-1", "1.5", "NaN", "Infinity", "99999999999999999"])
    assert.equal(parseStockPage(value), 1);
});

test("unfiltered pages have distinct canonical and reciprocal hreflang; filters stay noindex", async () => {
  for (const locale of ["ua", "en"]) {
    const page = await generateMetadata({
      params: Promise.resolve({ locale }),
      searchParams: Promise.resolve({ page: "2" }),
    });
    assert.equal(
      page.alternates?.canonical,
      `https://onecompany.global/${locale}/shop/catalog?page=2`
    );
    assert.equal(
      page.alternates?.languages?.en,
      "https://onecompany.global/en/shop/catalog?page=2"
    );
    assert.equal(
      page.alternates?.languages?.uk,
      "https://onecompany.global/ua/shop/catalog?page=2"
    );
    assert.equal(page.robots, undefined);
    const filtered = await generateMetadata({
      params: Promise.resolve({ locale }),
      searchParams: Promise.resolve({ page: "2", brand: ["KW", "do88"] }),
    });
    assert.equal(
      filtered.alternates?.canonical,
      `https://onecompany.global/${locale}/shop/catalog`
    );
    assert.deepEqual(filtered.robots, { index: false, follow: true });
    const tracking = await generateMetadata({
      params: Promise.resolve({ locale }),
      searchParams: Promise.resolve({ utm_source: "test", view: "list" }),
    });
    assert.equal(tracking.robots, undefined);
  }
});

test("do88 vehicle URLs cannot crash on unsupported brands or inherited object keys", () => {
  assert.ok(getDo88MakeEntries("Porsche").length > 0);
  for (const make of ["", "Unknown", "constructor", "__proto__", "toString"]) {
    assert.deepEqual(getDo88MakeEntries(make), []);
    assert.doesNotThrow(() => getDo88MakeEntries(make).map((entry) => entry.model));
  }
});
