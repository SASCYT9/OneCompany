import test from "node:test";
import assert from "node:assert/strict";
import {
  SITEMAP_MIN_BRAND_GROUP_SIZE,
  buildProductSitemapEntries,
  isSitemapExcludedProductSlug,
  parseSitemapChildId,
  planProductSitemapChunks,
  renderSitemapIndexXml,
  renderUrlsetXml,
  resolveChunkLastModified,
  resolveSitemapGroupKey,
} from "../../../src/lib/seoSitemapModel";

function makeProducts(count: number, base: { brand: string; vendor?: string }, prefix: string) {
  return Array.from({ length: count }, (_, index) => ({
    slug: `${prefix}-${String(index).padStart(5, "0")}`,
    brand: base.brand,
    vendor: base.vendor,
    tags: [] as string[],
  }));
}

test("storefront brands group by segment, other brands by brand key", () => {
  assert.equal(resolveSitemapGroupKey({ slug: "a", brand: "RaceChip" }), "racechip");
  assert.equal(resolveSitemapGroupKey({ slug: "b", brand: "Remus" }), "remus");
  assert.equal(resolveSitemapGroupKey({ slug: "c", brand: "" }), "other");
});

test("chunks are split per group, deterministic and capped at perFile", () => {
  const products = [
    ...makeProducts(5, { brand: "RaceChip" }, "racechip-gts5"),
    ...makeProducts(3, { brand: "Remus" }, "remus-a"),
  ];

  const chunks = planProductSitemapChunks(products, { perFile: 2, minBrandGroupSize: 1 });
  const ids = chunks.map((chunk) => chunk.id);

  assert.deepEqual(ids, ["racechip-1", "racechip-2", "racechip-3", "remus-1", "remus-2"]);
  assert.ok(chunks.every((chunk) => chunk.products.length <= 2));
  assert.equal(chunks.flatMap((chunk) => chunk.products).length, 8);

  const again = planProductSitemapChunks([...products].reverse(), {
    perFile: 2,
    minBrandGroupSize: 1,
  });
  assert.deepEqual(
    again.map((chunk) => chunk.products.map((product) => product.slug)),
    chunks.map((chunk) => chunk.products.map((product) => product.slug))
  );
});

test("small non-storefront brands merge into one `other` group", () => {
  const products = [
    ...makeProducts(2, { brand: "TinyBrandA" }, "tiny-a"),
    ...makeProducts(2, { brand: "TinyBrandB" }, "tiny-b"),
    ...makeProducts(SITEMAP_MIN_BRAND_GROUP_SIZE, { brand: "BigBrand" }, "big"),
  ];
  const ids = planProductSitemapChunks(products, { perFile: 10_000 }).map((chunk) => chunk.id);
  assert.deepEqual(ids, ["bigbrand-1", "other-1"]);
});

test("storefront segments are never merged away even when small", () => {
  const products = makeProducts(3, { brand: "Brabus" }, "brabus");
  const ids = planProductSitemapChunks(products).map((chunk) => chunk.id);
  assert.deepEqual(ids, ["brabus-1"]);
});

test("redirecting Eventuri shared-intake slugs are excluded from the plan", () => {
  assert.equal(isSitemapExcludedProductSlug("eventuri-porsche-cayenne-carbon-intake"), true);
  assert.equal(
    isSitemapExcludedProductSlug("4-0tfsi-twin-turbo-v8-black-carbon-intake-system"),
    false
  );
  const chunks = planProductSitemapChunks(
    [
      { slug: "eventuri-porsche-cayenne-carbon-intake", brand: "Eventuri" },
      { slug: "4-0tfsi-twin-turbo-v8-black-carbon-intake-system", brand: "Eventuri" },
    ],
    { minBrandGroupSize: 1 }
  );
  assert.deepEqual(
    chunks.flatMap((chunk) => chunk.products.map((product) => product.slug)),
    ["4-0tfsi-twin-turbo-v8-black-carbon-intake-system"]
  );
});

test("product entries use the canonical storefront URL for both locales", () => {
  const entries = buildProductSitemapEntries([
    {
      slug: "racechip-gts5-audi-a4",
      brand: "RaceChip",
      tags: [],
      updatedAt: "2026-10-01T10:00:00.000Z",
    },
    { slug: "remus-bundle-1", brand: "Remus", tags: [] },
  ]);

  const urls = entries.map((entry) => entry.url);
  assert.deepEqual(urls, [
    "https://onecompany.global/ua/shop/racechip/products/racechip-gts5-audi-a4",
    "https://onecompany.global/ua/shop/remus-bundle-1",
    "https://onecompany.global/en/shop/racechip/products/racechip-gts5-audi-a4",
    "https://onecompany.global/en/shop/remus-bundle-1",
  ]);
  assert.ok(entries[0].lastModified instanceof Date);
  assert.equal(entries[1].lastModified, undefined);
  assert.ok(entries.every((entry) => !("priority" in entry) && !("changeFrequency" in entry)));
  assert.equal(entries[0].alternates?.languages?.uk, urls[0]);
});

test("chunk lastmod is the newest product updatedAt", () => {
  const last = resolveChunkLastModified({
    id: "x-1",
    products: [
      { slug: "a", updatedAt: "2026-01-01T00:00:00.000Z" },
      { slug: "b", updatedAt: new Date("2026-03-01T00:00:00.000Z") },
      { slug: "c", updatedAt: "not-a-date" },
      { slug: "d" },
    ],
  });
  assert.equal(last?.toISOString(), "2026-03-01T00:00:00.000Z");
});

test("child ids are validated and `.xml` is stripped", () => {
  assert.equal(parseSitemapChildId("racechip-1.xml"), "racechip-1");
  assert.equal(parseSitemapChildId("pages"), "pages");
  assert.equal(parseSitemapChildId("../etc/passwd"), null);
  assert.equal(parseSitemapChildId("Racechip 1"), null);
  assert.equal(parseSitemapChildId(""), null);
});

test("index and urlset XML are well formed and escape values", () => {
  const index = renderSitemapIndexXml([
    {
      loc: "https://onecompany.global/sitemaps/a&b.xml",
      lastModified: new Date("2026-10-01T00:00:00.000Z"),
    },
    { loc: "https://onecompany.global/sitemaps/pages.xml" },
  ]);
  assert.match(index, /<sitemapindex xmlns=/);
  assert.match(index, /a&amp;b\.xml/);
  assert.match(index, /<lastmod>2026-10-01T00:00:00\.000Z<\/lastmod>/);
  assert.equal((index.match(/<sitemap>/g) ?? []).length, 2);

  const urlset = renderUrlsetXml([
    {
      url: "https://onecompany.global/ua/shop/x?a=1&b=2",
      alternates: { languages: { uk: "https://onecompany.global/ua/shop/x" } },
    },
  ]);
  assert.match(urlset, /<urlset [^>]*xmlns:xhtml=/);
  assert.match(urlset, /a=1&amp;b=2/);
  assert.match(urlset, /hreflang="uk"/);
});
