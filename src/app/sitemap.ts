import type { MetadataRoute } from "next";
import { absoluteUrl, buildLocalizedPath, siteConfig, buildAlternateLinks } from "@/lib/seo";
import { categoryData } from "@/lib/categoryData";

// Static pages with their priorities - ONLY pages that actually exist!
const staticPages = [
  // Main pages
  { slug: "", priority: 1.0, changeFrequency: "daily" as const },
  { slug: "/auto", priority: 0.9, changeFrequency: "daily" as const },
  { slug: "/moto", priority: 0.9, changeFrequency: "daily" as const },
  
  // Brands pages
  { slug: "/brands", priority: 0.8, changeFrequency: "weekly" as const },
  { slug: "/brands/moto", priority: 0.8, changeFrequency: "weekly" as const },
  { slug: "/brands/europe", priority: 0.7, changeFrequency: "weekly" as const },
  { slug: "/brands/usa", priority: 0.7, changeFrequency: "weekly" as const },
  { slug: "/brands/oem", priority: 0.7, changeFrequency: "weekly" as const },
  { slug: "/brands/racing", priority: 0.7, changeFrequency: "weekly" as const },
  
  // Info pages
  { slug: "/about", priority: 0.7, changeFrequency: "monthly" as const },
  { slug: "/contact", priority: 0.8, changeFrequency: "monthly" as const },
  { slug: "/partnership", priority: 0.7, changeFrequency: "monthly" as const },
  { slug: "/choice", priority: 0.6, changeFrequency: "monthly" as const },
  
  // Legal pages
  { slug: "/privacy", priority: 0.3, changeFrequency: "yearly" as const },
  { slug: "/terms", priority: 0.3, changeFrequency: "yearly" as const },
  { slug: "/cookies", priority: 0.3, changeFrequency: "yearly" as const },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  // Static pages
  const staticEntries = siteConfig.locales.flatMap((locale) =>
    staticPages.map((page) => {
      const path = buildLocalizedPath(locale, page.slug);
      return {
        url: absoluteUrl(path),
        lastModified,
        changeFrequency: page.changeFrequency,
        priority: page.priority,
        alternates: {
          languages: buildAlternateLinks(page.slug),
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
        lastModified,
        changeFrequency: "weekly" as const,
        priority: 0.7,
        alternates: {
          languages: buildAlternateLinks(pageSlug),
        },
      } satisfies MetadataRoute.Sitemap[number];
    })
  );

  return [...staticEntries, ...categoryEntries];
}
