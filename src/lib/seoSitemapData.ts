import type { MetadataRoute } from "next";
import { URBAN_COLLECTION_CARDS } from "@/app/[locale]/shop/data/urbanCollectionsList";
import { absoluteUrl, buildAlternateLinks, buildLocalizedPath, siteConfig } from "@/lib/seo";
import {
  buildStaticSitemapEntries,
  planProductSitemapChunks,
  type SitemapProductChunk,
} from "@/lib/seoSitemapModel";
import { computeRacechipNoindexSlugs } from "@/lib/seoRacechipConsolidation";
import { readSiteContent } from "@/lib/siteContentServer";
import { listShopProductSlugsForSitemap } from "@/lib/shopCatalogServer";

export async function loadProductSitemapChunks(): Promise<SitemapProductChunk[]> {
  const products = await listShopProductSlugsForSitemap();
  // Variants that answer `noindex` must not be advertised in the sitemap. The set
  // is derived from the list that was just loaded: a second call to
  // getRacechipNoindexSlugs() would issue a duplicate full product query on a
  // cold cache. The product pages build the same set from the same function.
  const racechipNoindex = computeRacechipNoindexSlugs(products);
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
        lastModified: new Date(post.updatedAt ?? post.date),
        alternates: { languages: buildAlternateLinks(pageSlug) },
      } satisfies MetadataRoute.Sitemap[number];
    })
  );
}
