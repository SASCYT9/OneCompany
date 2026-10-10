import type { MetadataRoute } from "next";
import { URBAN_COLLECTION_CARDS } from "@/app/[locale]/shop/data/urbanCollectionsList";
import { absoluteUrl, buildAlternateLinks, buildLocalizedPath, siteConfig } from "@/lib/seo";
import {
  buildStaticSitemapEntries,
  planProductSitemapChunks,
  type SitemapProductChunk,
} from "@/lib/seoSitemapModel";
import { getRacechipNoindexSlugs } from "@/lib/seoRacechipConsolidation.server";
import { readSiteContent } from "@/lib/siteContentServer";
import { listShopProductSlugsForSitemap } from "@/lib/shopCatalogServer";

export async function loadProductSitemapChunks(): Promise<SitemapProductChunk[]> {
  const [products, racechipNoindex] = await Promise.all([
    listShopProductSlugsForSitemap(),
    getRacechipNoindexSlugs(),
  ]);
  // Variants that answer `noindex` must not be advertised in the sitemap.
  return planProductSitemapChunks(
    racechipNoindex.size > 0
      ? products.filter((product) => !racechipNoindex.has(product.slug))
      : products
  );
}

export async function loadPagesSitemapEntries(): Promise<MetadataRoute.Sitemap> {
  const urbanCollectionEntries = siteConfig.locales.flatMap((locale) =>
    URBAN_COLLECTION_CARDS.map((collection) => {
      const pageSlug = `/shop/urban/collections/${collection.collectionHandle}`;
      return {
        url: absoluteUrl(buildLocalizedPath(locale, pageSlug)),
        alternates: { languages: buildAlternateLinks(pageSlug) },
      } satisfies MetadataRoute.Sitemap[number];
    })
  );
  return [...buildStaticSitemapEntries(), ...urbanCollectionEntries];
}

export async function loadBlogSitemapEntries(): Promise<MetadataRoute.Sitemap> {
  const content = await readSiteContent();
  const posts = content.blog.posts.filter((post) => post.status === "published");
  return siteConfig.locales.flatMap((locale) =>
    posts.map((post) => {
      const pageSlug = `/blog/${post.slug}`;
      return {
        url: absoluteUrl(buildLocalizedPath(locale, pageSlug)),
        lastModified: new Date(post.date),
        alternates: { languages: buildAlternateLinks(pageSlug) },
      } satisfies MetadataRoute.Sitemap[number];
    })
  );
}
