import type { MetadataRoute } from "next";
import { absoluteUrl, buildLocalizedPath, siteConfig } from "@/lib/seo";
import { allAutomotiveBrands, allMotoBrands, getBrandSlug } from "@/lib/brands";
import { categoryData } from "@/lib/categoryData";

// Static pages with their priorities
const staticPages = [
  { slug: "", priority: 1.0, changeFrequency: "daily" as const },
  { slug: "/auto", priority: 0.9, changeFrequency: "daily" as const },
  { slug: "/moto", priority: 0.9, changeFrequency: "daily" as const },
  { slug: "/brands", priority: 0.8, changeFrequency: "weekly" as const },
  { slug: "/about", priority: 0.7, changeFrequency: "monthly" as const },
  { slug: "/contact", priority: 0.8, changeFrequency: "monthly" as const },
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
      } satisfies MetadataRoute.Sitemap[number];
    })
  );

  // All brand pages (200+ pages for great SEO coverage)
  const allBrands = [...allAutomotiveBrands, ...allMotoBrands];
  const brandEntries = siteConfig.locales.flatMap((locale) =>
    allBrands.map((brand) => {
      const slug = getBrandSlug(brand);
      const path = buildLocalizedPath(locale, `/brands/${slug}`);
      return {
        url: absoluteUrl(path),
        lastModified,
        changeFrequency: "weekly" as const,
        priority: 0.6,
      } satisfies MetadataRoute.Sitemap[number];
    })
  );

  // Category pages
  const categoryEntries = siteConfig.locales.flatMap((locale) =>
    categoryData.map((category) => {
      const path = buildLocalizedPath(locale, `/${category.segment}/categories/${category.slug}`);
      return {
        url: absoluteUrl(path),
        lastModified,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      } satisfies MetadataRoute.Sitemap[number];
    })
  );

  return [...staticEntries, ...brandEntries, ...categoryEntries];
}
