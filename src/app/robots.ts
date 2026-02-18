import type { MetadataRoute } from "next";
import { absoluteUrl, siteConfig } from "@/lib/seo";
import { noindexPrefixes } from "@/lib/seoIndexPolicy";

export default function robots(): MetadataRoute.Robots {
  const sitemapUrl = absoluteUrl("/sitemap.xml");
  const disallowRules = noindexPrefixes.flatMap((prefix) => [prefix, `${prefix}/*`]);

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: disallowRules,
      },
    ],
    host: siteConfig.url,
    sitemap: sitemapUrl,
  };
}
