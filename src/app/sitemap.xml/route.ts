import {
  SITEMAP_BLOG_ID,
  SITEMAP_PAGES_ID,
  buildSitemapChildUrl,
  renderSitemapIndexXml,
  resolveChunkLastModified,
} from "@/lib/seoSitemapModel";
import { loadBlogSitemapEntries, loadProductSitemapChunks } from "@/lib/seoSitemapData";

/**
 * Sitemap index. Children live under `/sitemaps/<id>.xml` (see
 * `src/app/sitemaps/[id]/route.ts`): static pages, blog, and one file per
 * storefront/brand chunk, so Search Console reports indexing per group.
 *
 * Replaces the single `app/sitemap.ts` file. `robots.ts` still points here.
 */
export const dynamic = "force-static";
export const revalidate = 3600;

export async function GET() {
  const [chunks, blogEntries] = await Promise.all([
    loadProductSitemapChunks(),
    loadBlogSitemapEntries(),
  ]);

  const blogLastModified = blogEntries.reduce<Date | undefined>((latest, entry) => {
    const date = entry.lastModified ? new Date(entry.lastModified) : undefined;
    return date && (!latest || date > latest) ? date : latest;
  }, undefined);

  const items = [
    { loc: buildSitemapChildUrl(SITEMAP_PAGES_ID) },
    { loc: buildSitemapChildUrl(SITEMAP_BLOG_ID), lastModified: blogLastModified },
    ...chunks.map((chunk) => ({
      loc: buildSitemapChildUrl(chunk.id),
      lastModified: resolveChunkLastModified(chunk),
    })),
  ];

  return new Response(renderSitemapIndexXml(items), {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
