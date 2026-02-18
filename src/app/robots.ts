import type { MetadataRoute } from "next";
import { absoluteUrl, siteConfig } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  const sitemapUrl = absoluteUrl("/sitemap.xml");

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/api",
          "/api/*",
          "/telegram-app",
          "/telegram-app/*",
        ],
      },
    ],
    host: siteConfig.url,
    sitemap: sitemapUrl,
  };
}
