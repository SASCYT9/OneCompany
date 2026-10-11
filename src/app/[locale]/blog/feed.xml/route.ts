import { renderBlogRssXml } from "@/lib/blogFeed";
import { siteConfig, type SupportedLocale } from "@/lib/seo";
import { readSiteContent } from "@/lib/siteContentServer";

/**
 * RSS 2.0 feed of the published blog, one per locale:
 * /ua/blog/feed.xml and /en/blog/feed.xml. Advertised from the blog index
 * through <link rel="alternate" type="application/rss+xml"> and usable as a
 * section source in Google Publisher Center.
 */
export const dynamic = "force-static";
export const dynamicParams = false;
export const revalidate = 1800;

export function generateStaticParams() {
  return siteConfig.locales.map((locale) => ({ locale }));
}

type Context = { params: Promise<{ locale: string }> };

export async function GET(_request: Request, { params }: Context) {
  const { locale } = await params;
  if (!siteConfig.locales.includes(locale as SupportedLocale)) {
    return new Response("Not found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8", "X-Robots-Tag": "noindex" },
    });
  }

  const content = await readSiteContent();
  return new Response(renderBlogRssXml(locale as SupportedLocale, content.blog.posts), {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      // The feed is for readers and publisher tools, not a search result.
      "X-Robots-Tag": "noindex",
    },
  });
}
