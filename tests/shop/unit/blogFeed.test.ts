import assert from "node:assert/strict";
import test from "node:test";
import robots from "../../../src/app/robots";
import {
  BLOG_FEED_MAX_ITEMS,
  buildNewsSitemapEntries,
  buildPostExcerpt,
  escapeXml,
  renderBlogRssXml,
  renderNewsSitemapXml,
} from "../../../src/lib/blogFeed";
import { isEditorialNewsPost } from "../../../src/lib/blogPresentation";
import type { BlogPost } from "../../../src/types/site-content";

function makePost(overrides: Partial<BlogPost> = {}): BlogPost {
  return {
    id: "ig-test",
    slug: "test-post",
    title: { ua: "Тестовий пост", en: "Test post" },
    caption: {
      ua: "Опис українською #onecompany #tuning",
      en: "English description #onecompany #tuning",
    },
    date: "2026-10-10T09:23:57.000Z",
    status: "published",
    tags: ["onecompany", "tuning"],
    media: [{ id: "m1", type: "image", src: "/images/blog/test.jpg" }],
    cover: {
      src: "/images/blog/test.jpg",
      width: 1080,
      height: 1350,
      alt: { ua: "Фото", en: "Photo" },
    },
    ...overrides,
  };
}

const editorial = makePost({
  id: "news-1",
  slug: "bonamici-news",
  title: { ua: "Bonamici & Triumph", en: "Bonamici <news>" },
  date: "2026-10-10T21:02:43Z",
  sections: [
    {
      heading: { ua: "Розділ", en: "Section" },
      paragraphs: [{ ua: "Текст", en: "Text" }],
    },
  ],
});

test("only posts with editorial sections count as news", () => {
  assert.equal(isEditorialNewsPost(editorial), true);
  assert.equal(isEditorialNewsPost(makePost()), false);
  assert.equal(isEditorialNewsPost(makePost({ sections: [] })), false);
});

test("RSS feed lists published posts newest first with localized titles and canonical links", () => {
  const posts = [
    makePost({ slug: "older", date: "2026-09-08T13:21:02.000Z" }),
    makePost({ slug: "draft", status: "draft", date: "2026-10-11T00:00:00.000Z" }),
    editorial,
  ];
  const xml = renderBlogRssXml("en", posts);

  assert.match(xml, /<rss version="2\.0"/);
  assert.match(xml, /<language>en<\/language>/);
  assert.match(
    xml,
    /<atom:link href="https:\/\/onecompany\.global\/en\/blog\/feed\.xml" rel="self" type="application\/rss\+xml" \/>/
  );
  assert.equal(xml.includes("draft"), false);
  assert.ok(xml.indexOf("bonamici-news") < xml.indexOf("older"), "newest first");
  assert.match(xml, /<link>https:\/\/onecompany\.global\/en\/blog\/bonamici-news<\/link>/);
  assert.match(xml, /<title>Bonamici &lt;news&gt;<\/title>/);
  assert.match(xml, /<pubDate>Sat, 10 Oct 2026 21:02:43 GMT<\/pubDate>/);
  assert.match(xml, /<lastBuildDate>Sat, 10 Oct 2026 21:02:43 GMT<\/lastBuildDate>/);
  assert.match(xml, /<media:content url="https:\/\/onecompany\.global\/images\/blog\/test\.jpg"/);

  const ua = renderBlogRssXml("ua", posts);
  assert.match(ua, /<language>uk<\/language>/);
  assert.match(ua, /<title>Тестовий пост<\/title>/);
  assert.match(ua, /https:\/\/onecompany\.global\/ua\/blog\/older/);
});

test("RSS descriptions drop hashtags and the feed is capped", () => {
  const xml = renderBlogRssXml("ua", [makePost()]);
  assert.match(xml, /<description>Опис українською<\/description>/);
  assert.equal(xml.includes("#onecompany"), false);

  const many = Array.from({ length: BLOG_FEED_MAX_ITEMS + 10 }, (_, index) =>
    makePost({
      slug: `post-${index}`,
      date: new Date(Date.UTC(2026, 0, 1) + index * 86_400_000).toISOString(),
    })
  );
  const items = renderBlogRssXml("en", many).match(/<item>/g) ?? [];
  assert.equal(items.length, BLOG_FEED_MAX_ITEMS);
});

test("excerpts cut on a word boundary and strip hashtags", () => {
  assert.equal(buildPostExcerpt("one two #tag three"), "one two three");
  const long = `${"слово ".repeat(80)}#tag`;
  const excerpt = buildPostExcerpt(long, 100);
  assert.ok(excerpt.endsWith("…"));
  assert.ok(excerpt.length <= 101);
  assert.equal(excerpt.includes("#"), false);
});

test("news sitemap carries editorial articles from the last two days in both languages", () => {
  const now = new Date("2026-10-11T12:00:00Z");
  const entries = buildNewsSitemapEntries(
    [
      editorial,
      makePost({ slug: "promo", date: "2026-10-10T09:23:57.000Z" }),
      makePost({
        ...editorial,
        id: "news-old",
        slug: "old-news",
        date: "2026-10-01T10:00:00Z",
      }),
      makePost({ ...editorial, id: "news-draft", slug: "draft-news", status: "draft" }),
      makePost({
        ...editorial,
        id: "news-future",
        slug: "future-news",
        date: "2026-10-12T10:00:00Z",
      }),
    ],
    ["ua", "en"],
    now
  );

  assert.deepEqual(
    entries.map((entry) => [entry.url, entry.language]),
    [
      ["https://onecompany.global/ua/blog/bonamici-news", "uk"],
      ["https://onecompany.global/en/blog/bonamici-news", "en"],
    ]
  );

  const xml = renderNewsSitemapXml(entries);
  assert.match(xml, /xmlns:news="http:\/\/www\.google\.com\/schemas\/sitemap-news\/0\.9"/);
  assert.match(xml, /<news:name>One Company<\/news:name>/);
  assert.match(xml, /<news:language>uk<\/news:language>/);
  assert.match(xml, /<news:publication_date>2026-10-10T21:02:43Z<\/news:publication_date>/);
  assert.match(xml, /<news:title>Bonamici &amp; Triumph<\/news:title>/);
});

test("an empty news sitemap is still a valid urlset", () => {
  const xml = renderNewsSitemapXml([]);
  assert.match(xml, /<urlset[^>]*>\n<\/urlset>/);
});

test("XML escaping covers the five entities and drops control characters", () => {
  assert.equal(
    escapeXml(`a & b < c > "d" 'e'\u0001`),
    "a &amp; b &lt; c &gt; &quot;d&quot; &apos;e&apos;"
  );
});

test("robots.txt advertises both the sitemap index and the news sitemap", () => {
  const { sitemap } = robots();
  assert.deepEqual(sitemap, [
    "https://onecompany.global/sitemap.xml",
    "https://onecompany.global/news-sitemap.xml",
  ]);
});
