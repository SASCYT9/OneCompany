import type { MetadataRoute } from "next";
import { absoluteUrl, buildLocalizedPath, siteConfig, buildAlternateLinks } from "@/lib/seo";
import { categoryData } from "@/lib/categoryData";
import { readSiteContent } from "@/lib/siteContentServer";
import { localizedStaticSlugs } from "@/lib/seoIndexPolicy";

const staticPageConfig: Record<string, { priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }> = {
  "": { priority: 1.0, changeFrequency: "daily" },
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

  return [...staticEntries, ...categoryEntries, ...blogEntries];
}
