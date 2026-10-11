import { blogAuthorName, getBlogCover, isEditorialNewsPost } from "@/lib/blogPresentation";
import { absoluteUrl, buildLocalizedPath, type SupportedLocale } from "@/lib/seo";
import type { BlogPost } from "@/types/site-content";

/** Google News only wants articles from the last two days in a news sitemap. */
export const NEWS_SITEMAP_WINDOW_MS = 2 * 24 * 60 * 60 * 1000;
export const NEWS_SITEMAP_MAX_URLS = 1000;
export const BLOG_FEED_MAX_ITEMS = 50;

const FEED_COPY: Record<SupportedLocale, { title: string; description: string; language: string }> =
  {
    ua: {
      title: "One Company — блог про тюнінг авто та мото",
      description:
        "Новини, поставки та кейси тюнінгу від One Company: преміальні бренди для авто та мотоциклів.",
      language: "uk",
    },
    en: {
      title: "One Company — auto and moto tuning blog",
      description:
        "News, shipments and tuning cases from One Company: premium brands for cars and motorcycles.",
      language: "en",
    },
  };

const NEWS_LANGUAGE: Record<SupportedLocale, string> = { ua: "uk", en: "en" };

export function escapeXml(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function localized(value: { ua: string; en: string } | undefined, locale: SupportedLocale) {
  if (!value) return "";
  return (value[locale] || value.ua || value.en || "").trim();
}

function parseDate(value: string | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function publishedPosts(posts: BlogPost[]): BlogPost[] {
  return posts
    .filter((post) => post.status === "published" && parseDate(post.date))
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
}

/** Plain-text teaser: no hashtags, no line breaks, cut on a word boundary. */
export function buildPostExcerpt(text: string, max = 280): string {
  const clean = text
    .replace(/#[\p{L}\p{N}_]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.\-–—]+$/u, "")}…`;
}

function postDescription(post: BlogPost, locale: SupportedLocale) {
  return buildPostExcerpt(localized(post.description, locale) || localized(post.caption, locale));
}

function postUrl(post: BlogPost, locale: SupportedLocale) {
  return absoluteUrl(buildLocalizedPath(locale, `/blog/${post.slug}`));
}

function w3cDate(date: Date) {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function buildBlogFeedUrl(locale: SupportedLocale) {
  return absoluteUrl(buildLocalizedPath(locale, "/blog/feed.xml"));
}

export function renderBlogRssXml(locale: SupportedLocale, posts: BlogPost[]): string {
  const copy = FEED_COPY[locale];
  const items = publishedPosts(posts).slice(0, BLOG_FEED_MAX_ITEMS);
  const newest = items.reduce<Date | null>((latest, post) => {
    const date = parseDate(post.updatedAt) ?? parseDate(post.date);
    return date && (!latest || date > latest) ? date : latest;
  }, null);

  const itemXml = items.map((post) => {
    const url = postUrl(post, locale);
    const cover = getBlogCover(post);
    const coverUrl = cover ? (/^https?:\/\//i.test(cover) ? cover : absoluteUrl(cover)) : null;
    const lines = [
      "<item>",
      `<title>${escapeXml(localized(post.title, locale))}</title>`,
      `<link>${escapeXml(url)}</link>`,
      `<guid isPermaLink="true">${escapeXml(url)}</guid>`,
      `<pubDate>${parseDate(post.date)!.toUTCString()}</pubDate>`,
      `<dc:creator>${escapeXml(blogAuthorName)}</dc:creator>`,
      `<description>${escapeXml(postDescription(post, locale))}</description>`,
    ];
    if (coverUrl) {
      const size =
        post.cover && post.cover.width > 0 && post.cover.height > 0
          ? ` width="${post.cover.width}" height="${post.cover.height}"`
          : "";
      lines.push(`<media:content url="${escapeXml(coverUrl)}" medium="image"${size} />`);
    }
    for (const tag of (post.tags ?? []).slice(0, 5)) {
      lines.push(`<category>${escapeXml(tag)}</category>`);
    }
    lines.push("</item>");
    return lines.join("\n");
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:media="http://search.yahoo.com/mrss/">',
    "<channel>",
    `<title>${escapeXml(copy.title)}</title>`,
    `<link>${escapeXml(absoluteUrl(buildLocalizedPath(locale, "/blog")))}</link>`,
    `<atom:link href="${escapeXml(buildBlogFeedUrl(locale))}" rel="self" type="application/rss+xml" />`,
    `<description>${escapeXml(copy.description)}</description>`,
    `<language>${copy.language}</language>`,
    ...(newest ? [`<lastBuildDate>${newest.toUTCString()}</lastBuildDate>`] : []),
    ...itemXml,
    "</channel>",
    "</rss>",
    "",
  ].join("\n");
}

export type NewsSitemapEntry = {
  url: string;
  language: string;
  publicationDate: string;
  title: string;
};

/**
 * Editorial articles (not Instagram promo captions) from the last two days, one
 * entry per language version, newest first.
 */
export function buildNewsSitemapEntries(
  posts: BlogPost[],
  locales: readonly SupportedLocale[],
  now: Date = new Date()
): NewsSitemapEntry[] {
  const cutoff = now.getTime() - NEWS_SITEMAP_WINDOW_MS;
  const entries: NewsSitemapEntry[] = [];
  for (const post of publishedPosts(posts)) {
    if (!isEditorialNewsPost(post)) continue;
    const published = parseDate(post.date)!;
    if (published.getTime() < cutoff || published.getTime() > now.getTime()) continue;
    for (const locale of locales) {
      const title = localized(post.title, locale);
      if (!title) continue;
      entries.push({
        url: postUrl(post, locale),
        language: NEWS_LANGUAGE[locale],
        publicationDate: w3cDate(published),
        title,
      });
    }
  }
  return entries.slice(0, NEWS_SITEMAP_MAX_URLS);
}

export function renderNewsSitemapXml(entries: NewsSitemapEntry[]): string {
  const urls = entries.map((entry) =>
    [
      "<url>",
      `<loc>${escapeXml(entry.url)}</loc>`,
      "<news:news>",
      "<news:publication>",
      `<news:name>${escapeXml(blogAuthorName)}</news:name>`,
      `<news:language>${entry.language}</news:language>`,
      "</news:publication>",
      `<news:publication_date>${entry.publicationDate}</news:publication_date>`,
      `<news:title>${escapeXml(entry.title)}</news:title>`,
      "</news:news>",
      "</url>",
    ].join("\n")
  );
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">',
    ...urls,
    "</urlset>",
    "",
  ].join("\n");
}
