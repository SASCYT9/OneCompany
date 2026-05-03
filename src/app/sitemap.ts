import type { MetadataRoute } from "next";
import { absoluteUrl, buildLocalizedPath, siteConfig, buildAlternateLinks } from "@/lib/seo";
import { categoryData } from "@/lib/categoryData";
import { readSiteContent } from "@/lib/siteContentServer";
import { localizedStaticSlugs } from "@/lib/seoIndexPolicy";
import { getShopProductsServer } from "@/lib/shopCatalogServer";
import { getUrbanCollectionHandleForProduct } from "@/lib/urbanCollectionMatcher";
import { URBAN_COLLECTION_CARDS } from "@/app/[locale]/shop/data/urbanCollectionsList";
import { buildShopStorefrontProductPathForProduct } from "@/lib/shopStorefrontRouting";

const staticPageConfig: Record<string, { priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }> = {
  "": { priority: 1.0, changeFrequency: "daily" },
  "/shop": { priority: 0.85, changeFrequency: "daily" },
  "/shop/urban": { priority: 0.82, changeFrequency: "weekly" },
  "/shop/urban/collections": { priority: 0.8, changeFrequency: "weekly" },
  "/shop/akrapovic": { priority: 0.82, changeFrequency: "weekly" },
  "/shop/akrapovic/collections": { priority: 0.8, changeFrequency: "weekly" },
  "/shop/csf": { priority: 0.82, changeFrequency: "weekly" },
  "/shop/csf/collections": { priority: 0.8, changeFrequency: "weekly" },
  "/shop/ohlins": { priority: 0.82, changeFrequency: "weekly" },
  "/shop/ohlins/collections": { priority: 0.8, changeFrequency: "weekly" },
  "/shop/girodisc": { priority: 0.82, changeFrequency: "weekly" },
  "/shop/girodisc/catalog": { priority: 0.8, changeFrequency: "weekly" },
  "/shop/ipe": { priority: 0.82, changeFrequency: "weekly" },
  "/shop/ipe/collections": { priority: 0.8, changeFrequency: "weekly" },
  "/shop/brabus": { priority: 0.82, changeFrequency: "weekly" },
  "/shop/brabus/collections": { priority: 0.8, changeFrequency: "weekly" },
  "/shop/do88": { priority: 0.82, changeFrequency: "weekly" },
  "/shop/do88/collections": { priority: 0.8, changeFrequency: "weekly" },
  "/shop/racechip": { priority: 0.82, changeFrequency: "weekly" },
  "/shop/racechip/catalog": { priority: 0.8, changeFrequency: "weekly" },
  "/shop/burger": { priority: 0.82, changeFrequency: "weekly" },
  "/shop/adro": { priority: 0.82, changeFrequency: "weekly" },
  "/shop/adro/collections": { priority: 0.8, changeFrequency: "weekly" },
  "/auto": { priority: 0.9, changeFrequency: "daily" },
  "/moto": { priority: 0.9, changeFrequency: "daily" },
  "/brands": { priority: 0.8, changeFrequency: "weekly" },
  "/brands/moto": { priority: 0.8, changeFrequency: "weekly" },
  "/brands/europe": { priority: 0.7, changeFrequency: "weekly" },
  "/brands/usa": { priority: 0.7, changeFrequency: "weekly" },
  "/brands/oem": { priority: 0.7, changeFrequency: "weekly" },
  "/brands/racing": { priority: 0.7, changeFrequency: "weekly" },
  "/about": { priority: 0.7, changeFrequency: "monthly" },
  "/contact": { priority: 0.8, changeFrequency: "monthly" },
  "/partnership": { priority: 0.7, changeFrequency: "monthly" },
  "/choice": { priority: 0.6, changeFrequency: "monthly" },
  "/blog": { priority: 0.7, changeFrequency: "weekly" },
  "/privacy": { priority: 0.3, changeFrequency: "yearly" },
  "/terms": { priority: 0.3, changeFrequency: "yearly" },
  "/cookies": { priority: 0.3, changeFrequency: "yearly" },
  "/categories": { priority: 0.5, changeFrequency: "monthly" },
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const buildLastModified = new Date();

  // Static pages
  const staticEntries = siteConfig.locales.flatMap((locale) =>
    localizedStaticSlugs.map((slug) => {
      const pageConfig = staticPageConfig[slug] ?? { priority: 0.5, changeFrequency: "monthly" as const };
      const path = buildLocalizedPath(locale, slug);
      return {
        url: absoluteUrl(path),
        lastModified: buildLastModified,
        changeFrequency: pageConfig.changeFrequency,
        priority: pageConfig.priority,
        alternates: {
          languages: buildAlternateLinks(slug),
        },
      } satisfies MetadataRoute.Sitemap[number];
    })
  );

  // Category pages
  const categoryEntries = siteConfig.locales.flatMap((locale) =>
    categoryData.map((category) => {
      const pageSlug = `/${category.segment}/categories/${category.slug}`;
      const path = buildLocalizedPath(locale, pageSlug);
      return {
        url: absoluteUrl(path),
        lastModified: buildLastModified,
        changeFrequency: "weekly" as const,
        priority: 0.7,
        alternates: {
          languages: buildAlternateLinks(pageSlug),
        },
      } satisfies MetadataRoute.Sitemap[number];
    })
  );

  const content = await readSiteContent();
  const blogEntries = siteConfig.locales.flatMap((locale) =>
    content.blog.posts
      .filter((post) => post.status === "published")
      .map((post) => {
        const pageSlug = `/blog/${post.slug}`;
        const path = buildLocalizedPath(locale, pageSlug);
        return {
          url: absoluteUrl(path),
          lastModified: new Date(post.date),
          changeFrequency: "weekly" as const,
          priority: 0.6,
          alternates: {
            languages: buildAlternateLinks(pageSlug),
          },
        } satisfies MetadataRoute.Sitemap[number];
      })
  );

  const shopProducts = await getShopProductsServer();
  const urbanCollectionEntries = siteConfig.locales.flatMap((locale) =>
    URBAN_COLLECTION_CARDS.map((collection) => {
      const pageSlug = `/shop/urban/collections/${collection.collectionHandle}`;
      const path = buildLocalizedPath(locale, pageSlug);
      return {
        url: absoluteUrl(path),
        lastModified: buildLastModified,
        changeFrequency: "weekly" as const,
        priority: 0.76,
        alternates: {
          languages: buildAlternateLinks(pageSlug),
        },
      } satisfies MetadataRoute.Sitemap[number];
    })
  );
  const shopProductEntries = siteConfig.locales.flatMap((locale) =>
    shopProducts.map((product) => {
      // Always emit the canonical brand-prefixed product URL the storefront
      // resolves to. Otherwise Google crawls /shop/<slug>, the page returns
      // a static-friendly meta-refresh to the brand path, and the short URL
      // ends up in the index as a soft 301 (wasting crawl budget).
      const path = buildShopStorefrontProductPathForProduct(locale, product);
      const pageSlug = path.replace(`/${locale}`, '');
      return {
        url: absoluteUrl(path),
        lastModified: buildLastModified,
        changeFrequency: "weekly" as const,
        priority: 0.75,
        alternates: {
          languages: buildAlternateLinks(pageSlug),
        },
      } satisfies MetadataRoute.Sitemap[number];
    })
  );

  return [...staticEntries, ...categoryEntries, ...urbanCollectionEntries, ...shopProductEntries, ...blogEntries];
}
