import assert from "node:assert/strict";
import { siteConfig } from "@/lib/seo";
import {
  SITEMAP_BLOG_ID,
  SITEMAP_PAGES_ID,
  buildSitemapChildUrl,
  buildStaticSitemapEntries,
  parseSitemapChildId,
  renderUrlsetXml,
} from "@/lib/seoSitemapModel";

/**
 * Post-build checks for the root sitemap, used by
 * `scripts/verify-seo-build-artifacts.ts`.
 *
 * The root file is now a sitemap index (`/sitemap.xml`); product children under
 * `/sitemaps/<id>.xml` are rendered on demand and are not part of the build
 * output. A flat `<urlset>` is still accepted so the check keeps working for a
 * build that predates the index.
 */

const MAX_ENTRIES = 50_000;

export type SitemapArtifactSummary =
  | { kind: "index"; children: number; staticPageUrls: number }
  | { kind: "urlset"; urls: number };

/** Validates a `<urlset>` document and returns its locations. */
export function validateUrlsetXml(xml: string, label = "Sitemap"): string[] {
  const urlBlocks = xml.match(/<url>[\s\S]*?<\/url>/g) ?? [];
  assert.ok(urlBlocks.length > 0, `${label} contains no URLs`);
  assert.ok(urlBlocks.length < MAX_ENTRIES, `${label} contains ${urlBlocks.length} URLs`);

  const locations = new Set<string>();
  for (const block of urlBlocks) {
    const location = block.match(/<loc>([^<]+)<\/loc>/)?.[1];
    assert.ok(location, `${label} URL is missing <loc>`);
    assert.ok(
      location.startsWith(`${siteConfig.url}/`),
      `Unexpected sitemap host in ${label}: ${location}`
    );
    assert.ok(!/[?#]/.test(location), `Query/hash URL in ${label}: ${location}`);
    assert.ok(!locations.has(location), `Duplicate sitemap URL in ${label}: ${location}`);
    locations.add(location);

    const hreflangs = new Set([...block.matchAll(/hreflang="([^"]+)"/g)].map((match) => match[1]));
    for (const required of ["uk", "en", "x-default"]) {
      assert.ok(hreflangs.has(required), `${location} is missing ${required} hreflang`);
    }
  }
  return [...locations];
}

/** Validates a `<sitemapindex>` document and returns the child ids. */
export function validateSitemapIndexXml(xml: string): string[] {
  const entries = xml.match(/<sitemap>[\s\S]*?<\/sitemap>/g) ?? [];
  assert.ok(entries.length > 0, "Sitemap index lists no child sitemaps");
  assert.ok(entries.length <= MAX_ENTRIES, `Sitemap index lists ${entries.length} children`);

  const ids = new Set<string>();
  for (const entry of entries) {
    const location = entry.match(/<loc>([^<]+)<\/loc>/)?.[1];
    assert.ok(location, "Sitemap index entry is missing <loc>");
    const match = /^https:\/\/[^/]+\/sitemaps\/([^/?#]+)\.xml$/.exec(location);
    assert.ok(match, `Unexpected child sitemap URL: ${location}`);
    const id = parseSitemapChildId(match[1]);
    assert.ok(id === match[1], `Invalid child sitemap id: ${location}`);
    assert.equal(location, buildSitemapChildUrl(id), `Child sitemap is not canonical: ${location}`);
    assert.ok(!ids.has(id), `Duplicate child sitemap: ${location}`);
    ids.add(id);
  }

  for (const required of [SITEMAP_PAGES_ID, SITEMAP_BLOG_ID]) {
    assert.ok(ids.has(required), `Sitemap index is missing the "${required}" child sitemap`);
  }
  return [...ids];
}

export function verifySitemapArtifactXml(xml: string): SitemapArtifactSummary {
  if (/<sitemapindex[\s>]/.test(xml)) {
    const ids = validateSitemapIndexXml(xml);
    // The static-pages child is pure data, so it can be checked at build time
    // exactly like a flat sitemap (host, no query strings, no duplicates,
    // hreflang). Product children depend on the live catalog and are covered by
    // the planning unit tests.
    const staticPages = validateUrlsetXml(
      renderUrlsetXml(buildStaticSitemapEntries()),
      "Static pages sitemap"
    );
    return { kind: "index", children: ids.length, staticPageUrls: staticPages.length };
  }

  return { kind: "urlset", urls: validateUrlsetXml(xml).length };
}
