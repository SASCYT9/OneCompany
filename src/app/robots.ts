import type { MetadataRoute } from "next";
import { absoluteUrl, siteConfig } from "@/lib/seo";
import { noindexPrefixes } from "@/lib/seoIndexPolicy";

/**
 * Model-training crawlers re-render tens of thousands of product pages, and
 * every regeneration is billed database work. Search and answer agents that send
 * buyers (Googlebot, Bingbot, OAI-SearchBot, ChatGPT-User, PerplexityBot) are
 * not listed and keep the default rule.
 */
const AI_TRAINING_CRAWLERS = [
  "GPTBot",
  "CCBot",
  "ClaudeBot",
  "anthropic-ai",
  "Bytespider",
  "Amazonbot",
  "meta-externalagent",
  "Applebot-Extended",
  "Google-Extended",
] as const;

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
      {
        userAgent: [...AI_TRAINING_CRAWLERS],
        disallow: "/",
      },
    ],
    host: siteConfig.url,
    sitemap: sitemapUrl,
  };
}
