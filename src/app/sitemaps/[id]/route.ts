import {
  SITEMAP_BLOG_ID,
  SITEMAP_PAGES_ID,
  buildProductSitemapEntries,
  parseSitemapChildId,
  renderUrlsetXml,
} from "@/lib/seoSitemapModel";
import {
  loadBlogSitemapEntries,
  loadPagesSitemapEntries,
  loadProductSitemapChunks,
} from "@/lib/seoSitemapData";

/**
 * Child sitemap, served at `/sitemaps/<id>.xml`. Rendered on first request and
 * cached (ISR) so no catalog work happens at build time and new products show
 * up within the revalidation window instead of waiting for a deploy.
 */
export const dynamic = "force-static";
export const dynamicParams = true;
export const revalidate = 3600;

export function generateStaticParams() {
  return [];
}

type Context = { params: Promise<{ id: string }> };

function notFound() {
  return new Response("Not found", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8", "X-Robots-Tag": "noindex" },
  });
}

export async function GET(_request: Request, { params }: Context) {
  const { id: rawId } = await params;
  const id = parseSitemapChildId(rawId);
  if (!id) return notFound();

  let entries;
  if (id === SITEMAP_PAGES_ID) {
    entries = await loadPagesSitemapEntries();
  } else if (id === SITEMAP_BLOG_ID) {
    entries = await loadBlogSitemapEntries();
  } else {
    const chunks = await loadProductSitemapChunks();
    const chunk = chunks.find((item) => item.id === id);
    if (!chunk) return notFound();
    entries = buildProductSitemapEntries(chunk.products);
  }

  return new Response(renderUrlsetXml(entries), {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
