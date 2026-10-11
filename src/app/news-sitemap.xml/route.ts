import { buildNewsSitemapEntries, renderNewsSitemapXml } from "@/lib/blogFeed";
import { siteConfig } from "@/lib/seo";
import { readSiteContent } from "@/lib/siteContentServer";

/**
 * Google News sitemap. Lists only editorial articles (posts with structured
 * sections) published within the last two days, as Google's news sitemap
 * guidelines require; Instagram promo posts are deliberately left out. The
 * file is regenerated every few minutes, so articles drop out on their own.
 */
export const dynamic = "force-static";
export const revalidate = 600;

export async function GET() {
  const content = await readSiteContent();
  const entries = buildNewsSitemapEntries(content.blog.posts, siteConfig.locales);
  return new Response(renderNewsSitemapXml(entries), {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
