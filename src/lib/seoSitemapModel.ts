import type { MetadataRoute } from "next";
import { categoryData } from "@/lib/categoryData";
import { EVENTURI_SHARED_V8_INTAKE_LEGACY_SLUGS } from "@/lib/eventuriSharedIntake";
import { absoluteUrl, buildAlternateLinks, buildLocalizedPath, siteConfig } from "@/lib/seo";
import { localizedStaticSlugs } from "@/lib/seoIndexPolicy";
import {
  buildShopStorefrontProductPathForProduct,
  resolveShopStorefrontSegment,
} from "@/lib/shopStorefrontRouting";

/**
 * Sitemap model shared by the `/sitemap.xml` index and the child sitemaps under
 * `/sitemaps/<id>.xml`.
 *
 * Why split: one 21 MB / 35k-URL file hides which part of the catalog Google
 * refuses to index. One child file per storefront or brand lets Search Console
 * report indexing per group, and keeps every file far below the 50k URL limit.
 *
 * Every product URL emitted here is the canonical storefront URL (the same one
 * the page declares as `rel=canonical`), so the sitemap never lists a URL that
 * answers with a redirect.
 */

/** Products per child file. Each product yields one entry per locale (x2). */
export const SITEMAP_PRODUCTS_PER_FILE = 2500;

/** Brand groups smaller than this are merged into the shared `other` group. */
export const SITEMAP_MIN_BRAND_GROUP_SIZE = 300;

export const SITEMAP_PAGES_ID = "pages";
export const SITEMAP_BLOG_ID = "blog";

export type SitemapProductInput = {
  slug: string;
  brand?: string | null;
  vendor?: string | null;
  tags?: string[] | null;
  productType?: string | null;
  updatedAt?: Date | string | null;
};

export type SitemapProductChunk = {
  /** URL-safe id, served at `/sitemaps/<id>.xml`. */
  id: string;
  products: SitemapProductInput[];
};

const EXCLUDED_PRODUCT_SLUGS = new Set<string>(EVENTURI_SHARED_V8_INTAKE_LEGACY_SLUGS);

/**
 * Slugs that must not be listed: they 308 to another product URL or are
 * folded into a shared page, so listing them wastes crawl budget and shows up
 * in Search Console as "page with redirect".
 */
export function isSitemapExcludedProductSlug(slug: string): boolean {
  return EXCLUDED_PRODUCT_SLUGS.has(slug);
}

function toKey(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Group key: the storefront segment, or the brand for products without one. */
export function resolveSitemapGroupKey(product: SitemapProductInput): string {
  const segment = resolveShopStorefrontSegment({
    brand: product.brand,
    vendor: product.vendor,
    tags: product.tags ?? [],
  });
  if (segment) return toKey(segment) || "other";
  return toKey(product.brand) || toKey(product.vendor) || "other";
}

/**
 * Split products into stable, deterministic chunks. Ordering is by slug, so a
 * newly added product only shifts the chunk it lands in, not the whole group.
 */
export function planProductSitemapChunks(
  products: readonly SitemapProductInput[],
  options: { perFile?: number; minBrandGroupSize?: number } = {}
): SitemapProductChunk[] {
  const perFile = options.perFile ?? SITEMAP_PRODUCTS_PER_FILE;
  const minBrandGroupSize = options.minBrandGroupSize ?? SITEMAP_MIN_BRAND_GROUP_SIZE;

  const groups = new Map<string, SitemapProductInput[]>();
  for (const product of products) {
    if (!product.slug || isSitemapExcludedProductSlug(product.slug)) continue;
    const key = resolveSitemapGroupKey(product);
    const bucket = groups.get(key);
    if (bucket) bucket.push(product);
    else groups.set(key, [product]);
  }

  // Merge small non-storefront brands so the index does not list hundreds of
  // tiny files. Storefront segments always keep their own group.
  const merged = new Map<string, SitemapProductInput[]>();
  for (const [key, bucket] of groups) {
    const isStorefront = bucket.some(
      (product) =>
        resolveShopStorefrontSegment({
          brand: product.brand,
          vendor: product.vendor,
          tags: product.tags ?? [],
        }) !== null
    );
    const target = !isStorefront && bucket.length < minBrandGroupSize ? "other" : key;
    const existing = merged.get(target);
    if (existing) existing.push(...bucket);
    else merged.set(target, bucket);
  }

  const chunks: SitemapProductChunk[] = [];
  for (const key of [...merged.keys()].sort((a, b) => a.localeCompare(b))) {
    const sorted = [...(merged.get(key) ?? [])].sort((a, b) => a.slug.localeCompare(b.slug));
    for (let index = 0; index * perFile < sorted.length; index += 1) {
      chunks.push({
        id: `${key}-${index + 1}`,
        products: sorted.slice(index * perFile, (index + 1) * perFile),
      });
    }
  }
  return chunks;
}

function toDate(value: Date | string | null | undefined): Date | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** Newest `updatedAt` in a chunk, used as the index `<lastmod>`. */
export function resolveChunkLastModified(chunk: SitemapProductChunk): Date | undefined {
  let latest: Date | undefined;
  for (const product of chunk.products) {
    const date = toDate(product.updatedAt);
    if (date && (!latest || date > latest)) latest = date;
  }
  return latest;
}

/**
 * `changeFrequency` and `priority` are intentionally omitted: Google ignores
 * both, and only an accurate `lastModified` is used as a recrawl hint.
 */
export function buildProductSitemapEntries(
  products: readonly SitemapProductInput[]
): MetadataRoute.Sitemap {
  return siteConfig.locales.flatMap((locale) =>
    products.map((product) => {
      const path = buildShopStorefrontProductPathForProduct(locale, {
        slug: product.slug,
        brand: product.brand ?? "",
        vendor: product.vendor ?? undefined,
        tags: product.tags ?? [],
      });
      const pageSlug = path.replace(`/${locale}`, "");
      const lastModified = toDate(product.updatedAt);
      return {
        url: absoluteUrl(path),
        ...(lastModified ? { lastModified } : {}),
        alternates: { languages: buildAlternateLinks(pageSlug) },
      } satisfies MetadataRoute.Sitemap[number];
    })
  );
}

/** Static pages and category pages (no products, no blog). */
export function buildStaticSitemapEntries(): MetadataRoute.Sitemap {
  const staticEntries = siteConfig.locales.flatMap((locale) =>
    localizedStaticSlugs.map((slug) => ({
      url: absoluteUrl(buildLocalizedPath(locale, slug)),
      alternates: { languages: buildAlternateLinks(slug) },
    }))
  );

  const categoryEntries = siteConfig.locales.flatMap((locale) =>
    categoryData.map((category) => {
      const pageSlug = `/${category.segment}/categories/${category.slug}`;
      return {
        url: absoluteUrl(buildLocalizedPath(locale, pageSlug)),
        alternates: { languages: buildAlternateLinks(pageSlug) },
      };
    })
  );

  return [...staticEntries, ...categoryEntries];
}

/** `/sitemaps/<id>.xml` -> `<id>`; returns null when the id is not a valid slug. */
export function parseSitemapChildId(raw: string): string | null {
  const id = raw.replace(/\.xml$/i, "");
  return /^[a-z0-9][a-z0-9-]{0,80}$/.test(id) ? id : null;
}

export function buildSitemapChildUrl(id: string): string {
  return absoluteUrl(`/sitemaps/${id}.xml`);
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function renderSitemapIndexXml(
  items: ReadonlyArray<{ loc: string; lastModified?: Date }>
): string {
  const body = items
    .map((item) => {
      const lastmod = item.lastModified
        ? `<lastmod>${item.lastModified.toISOString()}</lastmod>`
        : "";
      return `<sitemap><loc>${escapeXml(item.loc)}</loc>${lastmod}</sitemap>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</sitemapindex>\n`;
}

export function renderUrlsetXml(entries: MetadataRoute.Sitemap): string {
  const body = entries
    .map((entry) => {
      const languages = entry.alternates?.languages ?? {};
      const links = Object.entries(languages)
        .map(
          ([lang, href]) =>
            `<xhtml:link rel="alternate" hreflang="${escapeXml(lang)}" href="${escapeXml(String(href))}" />`
        )
        .join("");
      const lastmod = entry.lastModified
        ? `<lastmod>${new Date(entry.lastModified).toISOString()}</lastmod>`
        : "";
      return `<url><loc>${escapeXml(entry.url)}</loc>${links}${lastmod}</url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${body}\n</urlset>\n`;
}
