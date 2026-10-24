import assert from "node:assert/strict";
import test from "node:test";
import {
  SHOP_CATALOG_LANDINGS,
  SHOP_CATALOG_LANDING_BRANDS,
  SHOP_CATALOG_LANDING_MIN_PRODUCTS,
  SHOP_CATALOG_LANDING_TITLE_MAX,
  buildShopCatalogLandingCopy,
  buildShopCatalogLandingLinks,
  findNearestShopCatalogLanding,
  popularShopCatalogMakeLandings,
  findShopCatalogLanding,
  shopCatalogLandingFilters,
  shopCatalogLandingQuery,
  shopCatalogLandingSearch,
  shopCatalogLandingStatsFromResponse,
  slugifyCatalogLandingSegment,
  type ShopCatalogLanding,
} from "../../../src/lib/shopCatalogLandings";
import {
  findShopCatalogLandingUrl,
  resolveShopCatalogLandingRedirect,
  resolveShopCatalogStateUrl,
} from "../../../src/lib/shopCatalogLandingUrl";
import {
  SITEMAP_CATALOG_LANDINGS_ID,
  buildCatalogLandingSitemapEntries,
  parseSitemapChildId,
} from "../../../src/lib/seoSitemapModel";
import { buildShopStorefrontBrandPath } from "../../../src/lib/shopStorefrontRouting";

const landing = (path: string): ShopCatalogLanding => {
  const found = findShopCatalogLanding(path);
  assert.ok(found, `landing ${path} exists`);
  return found;
};

test("every landing page is a clean, unique, sufficiently stocked URL", () => {
  assert.ok(SHOP_CATALOG_LANDINGS.length > 100);
  const paths = SHOP_CATALOG_LANDINGS.map((item) => item.path);
  assert.equal(new Set(paths).size, paths.length);
  for (const item of SHOP_CATALOG_LANDINGS) {
    assert.match(item.path, /^(catalog|brand)\/[a-z0-9-]+(\/[a-z0-9-]+)?$/, item.path);
    assert.ok(item.count >= SHOP_CATALOG_LANDING_MIN_PRODUCTS, item.path);
    if (item.kind === "model" || item.kind === "category") {
      // The parent make page exists for breadcrumbs and below-threshold redirects.
      assert.ok(findShopCatalogLanding(item.path.split("/").slice(0, 2).join("/")), item.path);
    }
    if (item.kind === "brand") {
      // Every brand landing names a brand the copy knows (storefront brands included).
      assert.ok(item.brand && SHOP_CATALOG_LANDING_BRANDS[item.brand], item.path);
    }
    if (item.kind === "brandMake") assert.ok(item.brand && item.make, item.path);
  }
});

test("landing lookup normalises the URL and finds the nearest landing below the threshold", () => {
  assert.equal(landing("catalog/bmw").make, "BMW");
  assert.equal(findShopCatalogLanding("Catalog/BMW/")?.path, "catalog/bmw");
  assert.equal(findShopCatalogLanding("catalog/mercedes%2Dbenz")?.make, "Mercedes-Benz");
  assert.equal(findShopCatalogLanding("catalog/not-a-make"), null);
  assert.equal(findNearestShopCatalogLanding("catalog/bmw/not-a-model")?.path, "catalog/bmw");
  assert.equal(findNearestShopCatalogLanding("brand/remus/not-a-make")?.path, "brand/remus");
  assert.equal(findNearestShopCatalogLanding("catalog/not-a-make"), null);
});

test("landing filters are the catalog's own URL parameters", () => {
  assert.deepEqual(shopCatalogLandingFilters(landing("catalog/bmw/m3")), {
    make: "BMW",
    model: "M3",
  });
  assert.deepEqual(shopCatalogLandingFilters(landing("catalog/bmw/exhaust")), {
    category: "exhaust",
    make: "BMW",
  });
  assert.deepEqual(shopCatalogLandingFilters(landing("brand/kw")), { brand: "KW Suspensions" });
  assert.deepEqual(shopCatalogLandingFilters(landing("brand/remus/bmw")), {
    brand: "Remus",
    make: "BMW",
  });
  // The landing's filters win over conflicting URL parameters.
  assert.deepEqual(shopCatalogLandingSearch(landing("catalog/bmw"), { make: "Audi", page: "2" }), {
    make: "BMW",
    page: ["2"],
  });
  assert.deepEqual(shopCatalogLandingQuery({ page: "3" }), { page: 3, filtered: false });
  assert.deepEqual(shopCatalogLandingQuery({ sort: "price_asc" }), { page: 1, filtered: true });
});

test("catalog state stays on the landing URL only while its filters are unchanged", () => {
  const state = { href: "/ua/shop/catalog/bmw/m3", filters: { make: "BMW", model: "M3" } };
  const url = (query: string) =>
    resolveShopCatalogStateUrl("ua", new URLSearchParams(query), state);
  assert.equal(url("make=BMW&model=M3&includeFitment=true"), "/ua/shop/catalog/bmw/m3");
  assert.equal(url("make=BMW&model=M3&page=2"), "/ua/shop/catalog/bmw/m3?page=2");
  assert.equal(url("make=BMW&model=M3&page=1&view=list"), "/ua/shop/catalog/bmw/m3?view=list");
  // Another landing page's filters move to that page; others to the catalog.
  assert.equal(url("make=BMW&model=X5"), "/ua/shop/catalog/bmw/x5");
  assert.equal(url("make=BMW&model=Z1"), "/ua/shop/catalog?make=BMW&model=Z1");
  assert.equal(
    url("make=BMW&model=M3&stock=inStock"),
    "/ua/shop/catalog?make=BMW&model=M3&stock=inStock"
  );
  assert.equal(url("make=BMW"), "/ua/shop/catalog/bmw");
  assert.equal(
    resolveShopCatalogStateUrl("en", new URLSearchParams("q=jb4"), null),
    "/en/shop/catalog?q=jb4"
  );
});

test("landing copy is built from live counts and fits search result titles", () => {
  const stats = shopCatalogLandingStatsFromResponse({
    meta: { totalItems: 565 },
    filterStats: {
      categories: [
        { key: "suspension", label: "Підвіска", count: 221 },
        { key: "exhaust", label: "Вихлопні системи", count: 63 },
        { key: "performance", label: "Впуск, турбо і двигун", count: 62 },
        { key: "cooling", label: "Охолодження", count: 60 },
      ],
      brands: [
        { label: "KW Suspensions", count: 180 },
        { label: "Burger Motorsports", count: 49 },
        { label: "OHLINS", count: 40 },
        { label: "GiroDisc", count: 37 },
        { label: "AKRAPOVIC", count: 32 },
      ],
    },
  });
  const ua = buildShopCatalogLandingCopy("ua", landing("catalog/bmw/m3"), stats);
  assert.equal(ua.h1, "Тюнінг BMW M3");
  assert.equal(ua.title, "Тюнінг BMW M3 — підвіска, вихлоп, впуск і турбо | One Company");
  assert.equal(
    ua.description,
    "565 товарів для BMW M3: KW, Burger Motorsports, Öhlins і GiroDisc. Ціни в гривнях, доставка по Україні."
  );
  assert.deepEqual(ua.breadcrumbs, [
    { name: "Каталог", href: "/ua/shop/catalog" },
    { name: "BMW", href: "/ua/shop/catalog/bmw" },
    { name: "M3" },
  ]);
  const en = buildShopCatalogLandingCopy("en", landing("catalog/bmw/m3"), stats);
  assert.equal(en.h1, "BMW M3 tuning parts");
  assert.ok(en.title.startsWith("BMW M3 tuning parts — suspension"));
  assert.match(
    en.description,
    /^565 parts for BMW M3 from KW, Burger Motorsports, Öhlins and GiroDisc\./
  );

  const exhaust = buildShopCatalogLandingCopy("ua", landing("catalog/bmw/exhaust"), {
    total: 1023,
    categories: {},
    brands: { Remus: 825, AKRAPOVIC: 95, "Fi EXHAUST": 69 },
  });
  assert.equal(exhaust.h1, "Вихлопні системи для BMW");
  assert.equal(
    exhaust.title,
    "Вихлопні системи для BMW — Remus, Akrapovič, Fi Exhaust | One Company"
  );
  assert.ok(exhaust.description.startsWith("1 023 товари — вихлопні системи для BMW"));
  assert.equal(exhaust.breadcrumbs.at(-1)?.name, "Вихлопні системи");

  const remus = buildShopCatalogLandingCopy("ua", landing("brand/remus"), {
    total: 3849,
    categories: { exhaust: 3849 },
    brands: {},
  });
  assert.equal(remus.title, "Remus: вихлопні системи — купити в Україні | One Company");
  const remusBmw = buildShopCatalogLandingCopy("ua", landing("brand/remus/bmw"), {
    total: 832,
    categories: { exhaust: 832 },
    brands: {},
  });
  assert.equal(remusBmw.title, "Remus для BMW — вихлоп | One Company");
  assert.deepEqual(remusBmw.breadcrumbs[1], { name: "Remus", href: "/ua/shop/brand/remus" });
  const akrapovic = buildShopCatalogLandingCopy("ua", landing("brand/akrapovic/bmw"), null);
  // Former storefront brands have their own brand landing page now.
  assert.deepEqual(akrapovic.breadcrumbs[1], {
    name: "Akrapovič",
    href: "/ua/shop/brand/akrapovic",
  });
  assert.equal(akrapovic.title, "Akrapovič для BMW | One Company");

  for (const item of SHOP_CATALOG_LANDINGS) {
    for (const locale of ["ua", "en"] as const) {
      const copy = buildShopCatalogLandingCopy(locale, item, null);
      assert.ok(copy.title.length <= SHOP_CATALOG_LANDING_TITLE_MAX, `${locale} ${item.path}`);
      assert.ok(copy.h1.trim() && copy.description.trim(), `${locale} ${item.path}`);
    }
  }
});

test("Ukrainian counts agree with the number", () => {
  const copy = (count: number) =>
    buildShopCatalogLandingCopy("ua", landing("catalog/bmw"), {
      total: count,
      categories: {},
      brands: {},
    }).description;
  assert.ok(copy(1).startsWith("1 товар для"));
  assert.ok(copy(22).startsWith("22 товари для"));
  assert.ok(copy(25).startsWith("25 товарів для"));
  assert.ok(copy(111).startsWith("111 товарів для"));
  assert.ok(copy(2990).startsWith("2 990 товарів для"));
});

test("brand links and old KW/Fi URLs lead to the brand landing pages", () => {
  assert.equal(buildShopStorefrontBrandPath("ua", "KW Suspensions"), "/ua/shop/brand/kw");
  assert.equal(buildShopStorefrontBrandPath("en", "Fi EXHAUST"), "/en/shop/brand/fi-exhaust");
  assert.equal(buildShopStorefrontBrandPath("ua", "AKRAPOVIC"), "/ua/shop/brand/akrapovic");
  assert.equal(slugifyCatalogLandingSegment("RS5 Coupé"), "rs5-coupe");
  assert.equal(slugifyCatalogLandingSegment("Škoda"), "skoda");
});

test("landing pages have their own child sitemap in both languages", () => {
  const entries = buildCatalogLandingSitemapEntries();
  assert.equal(entries.length, SHOP_CATALOG_LANDINGS.length * 2);
  assert.ok(
    entries.some((entry) => entry.url === "https://onecompany.global/ua/shop/catalog/bmw/m3")
  );
  assert.ok(
    entries.some((entry) => entry.url === "https://onecompany.global/en/shop/brand/remus/bmw")
  );
  assert.equal(
    parseSitemapChildId(`${SITEMAP_CATALOG_LANDINGS_ID}.xml`),
    SITEMAP_CATALOG_LANDINGS_ID
  );
});

test("catalog filters that match a landing page use its address", () => {
  const find = (query: string) => findShopCatalogLandingUrl("ua", new URLSearchParams(query));
  assert.equal(find("make=BMW&includeFitment=true"), "/ua/shop/catalog/bmw");
  assert.equal(
    find("make=BMW&model=M3&page=2&view=list"),
    "/ua/shop/catalog/bmw/m3?page=2&view=list"
  );
  assert.equal(find("category=exhaust&make=BMW"), "/ua/shop/catalog/bmw/exhaust");
  assert.equal(find("brand=KW Suspensions"), "/ua/shop/brand/kw");
  assert.equal(find("brand=Remus&make=BMW"), "/ua/shop/brand/remus/bmw");
  assert.equal(find("make=BMW&sort=price_asc"), null);
  assert.equal(find("brand=AKRAPOVIC"), "/ua/shop/brand/akrapovic");
  assert.equal(find("brand=Setrab"), null);
  assert.equal(find("make=BMW&make=Audi"), null);

  const redirect = (path: string, query: string) =>
    resolveShopCatalogLandingRedirect(path, new URLSearchParams(query));
  assert.equal(redirect("/ua/shop/catalog", "make=BMW&model=M3"), "/ua/shop/catalog/bmw/m3");
  assert.equal(redirect("/en/shop/catalog", "make=BMW&page=3"), "/en/shop/catalog/bmw?page=3");
  assert.equal(redirect("/ua/shop/catalog", "make=BMW&stock=inStock"), null);
  assert.equal(redirect("/ua/shop/catalog", ""), null);
  assert.equal(redirect("/ua/shop/stock", "make=BMW"), null);
});

test("landing pages link to their neighbours and the catalog to popular makes", () => {
  const titles = (path: string) =>
    buildShopCatalogLandingLinks("ua", landing(path)).map((group) => group.title);
  assert.deepEqual(titles("catalog/bmw"), ["Моделі", "Категорії", "Бренди"]);
  assert.deepEqual(titles("catalog/bmw/m3"), ["Інші моделі BMW", "Категорії BMW"]);
  assert.deepEqual(titles("catalog/bmw/exhaust"), ["Інші категорії BMW"]);
  assert.deepEqual(titles("brand/remus"), ["Марки авто"]);
  const bmw = buildShopCatalogLandingLinks("ua", landing("catalog/bmw"));
  assert.ok(
    bmw[0].links.some((link) => link.name === "M3" && link.href === "/ua/shop/catalog/bmw/m3")
  );
  assert.ok(bmw[1].links.some((link) => link.name === "Вихлопні системи"));
  for (const item of SHOP_CATALOG_LANDINGS) {
    for (const group of buildShopCatalogLandingLinks("en", item)) {
      assert.ok(group.links.length > 0 && group.links.length <= 12, item.path);
      for (const link of group.links) {
        assert.ok(findShopCatalogLanding(link.href.replace("/en/shop/", "")), link.href);
        assert.notEqual(link.href, `/en/shop/${item.path}`, "no link to itself");
      }
    }
  }
  const popular = popularShopCatalogMakeLandings();
  assert.equal(popular.length, 12);
  assert.equal(popular[0].make, "BMW");
});
