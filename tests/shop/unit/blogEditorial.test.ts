import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { validateSiteContentInput } from "../../../src/lib/adminConfigValidation";
import { formatBlogDate, getBlogCover, updateBlogMedia } from "../../../src/lib/blogPresentation";

const raw = JSON.parse(
  readFileSync(path.join(process.cwd(), "public/config/site-content.json"), "utf8")
);

test("published blog keeps editorial fields through the production content validator", () => {
  const content = validateSiteContentInput(raw);
  const published = content.blog.posts.filter((post) => post.status === "published");
  assert.ok(published.length >= 64);
  assert.equal(new Set(published.map((post) => post.slug)).size, published.length);
  for (const post of published) {
    assert.ok(Number.isFinite(Date.parse(post.date)), post.slug);
    assert.ok(getBlogCover(post), post.slug);
    assert.ok(post.cover && post.cover.width > 0 && post.cover.height > 0, post.slug);
    assert.ok(existsSync(path.join(process.cwd(), "public", post.cover.src)), post.slug);
    for (const media of post.media.filter((item) => item.type === "video"))
      assert.ok(media.poster, post.slug);
  }
  const article = published.find((post) => post.slug === "bonamici-triumph-daytona-660-th10-pst3")!;
  assert.equal(article.sections?.length, 5);
  assert.equal(article.sources?.length, 3);
  assert.ok(article.cover && article.cover.width >= 1200);
  assert.ok(article.date.startsWith("2026-10-10"));
  assert.ok(
    article.sections?.every(
      (section) =>
        section.heading.ua && section.heading.en && section.paragraphs.every((p) => p.ua && p.en)
    )
  );
  assert.equal(
    published.find((post) => post.slug === "kline-inconel-exhaust-porsche-992-2-turbo")?.date,
    "2026-09-08T13:21:02.000Z"
  );
});

test("unsafe editorial source URLs and malformed image dimensions cannot enter public content", () => {
  const badSource = structuredClone(raw);
  badSource.blog.posts.find(
    (post: { slug: string }) => post.slug === "bonamici-triumph-daytona-660-th10-pst3"
  ).sources[0].url = "javascript:alert(1)";
  assert.throws(() => validateSiteContentInput(badSource), /expected HTTPS source/);
  const badCover = structuredClone(raw);
  badCover.blog.posts.find(
    (post: { slug: string }) => post.slug === "bonamici-triumph-daytona-660-th10-pst3"
  ).cover.width = -1200;
  assert.throws(() => validateSiteContentInput(badCover), /expected positive integer/);
});

test("admin media edits retain relevant covers and discard removed or replaced sources", () => {
  const post = validateSiteContentInput(raw).blog.posts.find(
    (post) => post.slug === "bonamici-triumph-daytona-660-th10-pst3"
  )!;
  const added = { id: "additional", type: "image" as const, src: "/images/new.jpg" };
  assert.equal(updateBlogMedia(post, [...post.media, added]).cover?.src, post.cover?.src);
  const removed = updateBlogMedia(post, [added]);
  assert.equal(removed.cover, undefined);
  assert.equal(getBlogCover(removed), added.src);
  const replaced = updateBlogMedia(post, [{ ...post.media[0], src: added.src }]);
  assert.equal(replaced.cover, undefined);
  assert.equal(getBlogCover(replaced), added.src);
});

test("replacing a video also discards its extracted poster, but preserves an explicitly changed poster", () => {
  const post = validateSiteContentInput(raw).blog.posts.find(
    (post) => post.slug === "rpm-exhaust-can-am-maverick-x3"
  )!;
  const replaced = updateBlogMedia(post, [{ ...post.media[0], src: "/videos/replacement.mp4" }]);
  assert.equal(replaced.cover, undefined);
  assert.equal(replaced.media[0].poster, undefined);
  assert.equal(getBlogCover(replaced), undefined);
  const newPoster = updateBlogMedia(post, [
    { ...post.media[0], src: "/videos/replacement.mp4", poster: "/images/new-poster.jpg" },
  ]);
  assert.equal(getBlogCover(newPoster), "/images/new-poster.jpg");
});

test("dates use the same Kyiv calendar day in both locales", () => {
  assert.equal(formatBlogDate("2026-10-10T22:30:00Z", "en"), "11 October 2026");
  assert.equal(formatBlogDate("2026-10-10T22:30:00Z", "ua"), "11 жовтня 2026 р.");
});
