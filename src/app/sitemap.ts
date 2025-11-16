import type { MetadataRoute } from "next";
import { absoluteUrl, buildLocalizedPath, siteConfig } from "@/lib/seo";

const staticSlugs = ["", "/auto", "/moto", "/about", "/contact", "/brands", "/categories"];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  const entries = siteConfig.locales.flatMap((locale) =>
    staticSlugs.map((slug) => {
      const path = buildLocalizedPath(locale, slug);
      return {
        url: absoluteUrl(path),
        lastModified,
        changeFrequency: slug === "" ? "daily" : "weekly",
        priority: slug === "" ? 1 : 0.7,
      } satisfies MetadataRoute.Sitemap[number];
    })
  );

  return entries;
}
