import assert from "node:assert/strict";
import test from "node:test";
import {
  SITEMAP_BLOG_ID,
  SITEMAP_PAGES_ID,
  buildSitemapChildUrl,
  buildStaticSitemapEntries,
  renderSitemapIndexXml,
  renderUrlsetXml,
} from "../../../src/lib/seoSitemapModel";
import { verifySitemapArtifactXml } from "../../../src/lib/seoSitemapVerify";

const child = (id: string) => ({ loc: buildSitemapChildUrl(id) });

test("a sitemap index with the pages and blog children passes", () => {
  const xml = renderSitemapIndexXml([
    child(SITEMAP_PAGES_ID),
    child(SITEMAP_BLOG_ID),
    child("brabus"),
    { loc: buildSitemapChildUrl("remus-1"), lastModified: new Date("2026-10-01T00:00:00Z") },
  ]);
  const summary = verifySitemapArtifactXml(xml);
  assert.equal(summary.kind, "index");
  assert.equal(summary.kind === "index" ? summary.children : 0, 4);
  assert.ok(summary.kind === "index" && summary.staticPageUrls > 0);
});

test("an index without the pages or blog child is rejected", () => {
  assert.throws(
    () =>
      verifySitemapArtifactXml(renderSitemapIndexXml([child(SITEMAP_PAGES_ID), child("brabus")])),
    /missing the "blog" child/
  );
  assert.throws(
    () => verifySitemapArtifactXml(renderSitemapIndexXml([child(SITEMAP_BLOG_ID)])),
    /missing the "pages" child/
  );
});

test("malformed or duplicate index entries are rejected", () => {
  const base = [child(SITEMAP_PAGES_ID), child(SITEMAP_BLOG_ID)];
  assert.throws(
    () =>
      verifySitemapArtifactXml(renderSitemapIndexXml([...base, child("brabus"), child("brabus")])),
    /Duplicate child sitemap/
  );
  assert.throws(
    () =>
      verifySitemapArtifactXml(
        renderSitemapIndexXml([...base, { loc: "https://onecompany.global/other/brabus.xml" }])
      ),
    /Unexpected child sitemap URL/
  );
  assert.throws(
    () => verifySitemapArtifactXml(renderSitemapIndexXml([])),
    /lists no child sitemaps/
  );
});

test("a flat urlset is still validated for host, query strings, duplicates and hreflang", () => {
  const entries = buildStaticSitemapEntries();
  assert.equal(verifySitemapArtifactXml(renderUrlsetXml(entries)).kind, "urlset");

  assert.throws(
    () => verifySitemapArtifactXml(renderUrlsetXml([...entries, entries[0]])),
    /Duplicate sitemap URL/
  );
  assert.throws(
    () =>
      verifySitemapArtifactXml(renderUrlsetXml([{ ...entries[0], url: "https://example.com/ua" }])),
    /Unexpected sitemap host/
  );
  assert.throws(
    () =>
      verifySitemapArtifactXml(
        renderUrlsetXml([{ ...entries[0], url: `${entries[0].url}?utm=1` }])
      ),
    /Query\/hash URL/
  );
  assert.throws(
    () =>
      verifySitemapArtifactXml(renderUrlsetXml([{ ...entries[0], alternates: { languages: {} } }])),
    /missing uk hreflang/
  );
});
