import Image from "next/image";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/navigation";
import { readSiteContent } from "@/lib/siteContentServer";
import { buildPageMetadata, resolveLocale, type SupportedLocale } from "@/lib/seo";
import { BlogCarousel } from "./BlogCarousel";

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

const formatDate = (value: string, locale: SupportedLocale) => {
  const formatter = new Intl.DateTimeFormat(locale === "ua" ? "uk-UA" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return formatter.format(new Date(value));
};

const getLocalized = (value: { ua: string; en: string }, locale: SupportedLocale) => {
  return value[locale] || value.ua || value.en;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const l = resolveLocale(locale);
  const content = await readSiteContent();
  const post = content.blog.posts.find((item) => item.slug === slug);

  if (!post) {
    return buildPageMetadata(l, `blog/${slug}`, {
      title: l === "ua" ? "Публікація · OneCompany" : "Post · OneCompany",
      description: l === "ua" ? "Публікація блогу" : "Blog post",
    });
  }

  const cover = post.media.find((item) => item.type === "image");
  return buildPageMetadata(l, `blog/${post.slug}`, {
    title: getLocalized(post.title, l),
    description: getLocalized(post.caption, l),
    image: cover?.src,
    type: "article",
  });
}

export default async function BlogPostPage({ params }: Props) {
  const { locale, slug } = await params;
  const l = resolveLocale(locale);
  const t = await getTranslations("blog");
  const content = await readSiteContent();
  const post = content.blog.posts.find(
    (item) => item.slug === slug && item.status === "published"
  );

  if (!post) {
    notFound();
  }

  const captionText = getLocalized(post.caption, l);
  const captionParagraphs = captionText.split("\n").filter(Boolean);
  const lastPara = captionParagraphs[captionParagraphs.length - 1] ?? "";
  const hasHashtagLine = lastPara.startsWith("#");
  const bodyParagraphs = hasHashtagLine ? captionParagraphs.slice(0, -1) : captionParagraphs;

  const images = post.media.filter((m) => m.type === "image");
  const hasMultipleImages = images.length > 1;

  return (
    <main id="main-content" className="relative min-h-screen bg-black text-white">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -left-40 top-0 h-[600px] w-[600px] rounded-full bg-[radial-gradient(circle,_rgba(255,179,71,0.06),_transparent_65%)] blur-[120px]" />
        <div className="absolute right-0 top-60 h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle,_rgba(92,188,255,0.04),_transparent_60%)] blur-[120px]" />
      </div>

      {/* ── Back button ── */}
      <div className="relative z-10 mx-auto max-w-6xl px-4 pt-28 sm:px-6">
        <Link
          href="/blog"
          className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-[11px] uppercase tracking-[0.35em] text-white/50 backdrop-blur-md transition-all hover:border-white/30 hover:text-white/80"
        >
          ← {t("back")}
        </Link>
      </div>

      {/* ── Two-column layout ── */}
      <div className="relative z-10 mx-auto max-w-6xl px-4 pt-8 sm:px-6 lg:pt-10">
        <div className="flex flex-col gap-8 lg:flex-row lg:gap-12">

          {/* ── LEFT: Image carousel ── */}
          <div className="w-full lg:w-[55%] xl:w-[58%]">
            {images.length > 0 && (
              <div className="lg:sticky lg:top-28">
                {hasMultipleImages ? (
                  <BlogCarousel
                    images={images.map((img) => ({
                      src: img.src,
                      alt: img.alt ?? getLocalized(post.title, l),
                    }))}
                  />
                ) : (
                  <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] sm:aspect-[3/4] lg:rounded-3xl">
                    <Image
                      src={images[0].src}
                      alt={images[0].alt ?? getLocalized(post.title, l)}
                      fill
                      sizes="(max-width: 1024px) 100vw, 55vw"
                      className="object-cover"
                      priority
                      unoptimized={images[0].src.startsWith("http")}
                      loader={images[0].src.startsWith("http") ? ({ src }) => src : undefined}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── RIGHT: Article text ── */}
          <div className="w-full lg:w-[45%] xl:w-[42%]">
            <article>
              {/* Meta */}
              <div className="flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-[0.4em] text-white/30">
                <time dateTime={post.date}>{formatDate(post.date, l)}</time>
                {post.location && (
                  <>
                    <span className="h-1 w-1 rounded-full bg-white/20" />
                    <span>{getLocalized(post.location, l)}</span>
                  </>
                )}
              </div>

              {/* Title */}
              <h1 className="mt-5 font-display text-2xl font-light leading-tight tracking-tight sm:text-3xl lg:text-4xl">
                {getLocalized(post.title, l)}
              </h1>

              {/* Divider */}
              <div className="my-6 h-px bg-gradient-to-r from-white/20 via-white/10 to-transparent" />

              {/* Body text */}
              <div className="space-y-4">
                {bodyParagraphs.map((p, i) => {
                  const isList = p.startsWith("—") || p.startsWith("-");
                  return (
                    <p
                      key={i}
                      className={
                        isList
                          ? "pl-4 text-[15px] leading-relaxed text-white/55 border-l border-white/10 sm:text-base"
                          : "text-[15px] leading-relaxed text-white/60 sm:text-base sm:leading-relaxed"
                      }
                    >
                      {p}
                    </p>
                  );
                })}
              </div>

              {/* Tags */}
              {post.tags?.length ? (
                <div className="mt-8 flex flex-wrap gap-2">
                  {post.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5 text-[10px] uppercase tracking-[0.25em] text-white/35 transition-colors hover:border-white/15 hover:text-white/55"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              ) : null}

              {/* CTA / Instagram */}
              <div className="mt-10 rounded-2xl border border-white/8 bg-white/[0.02] p-6 text-center">
                <p className="text-[10px] uppercase tracking-[0.5em] text-white/25">
                  {l === "ua" ? "Стежте за нами" : "Follow us"}
                </p>
                <a
                  href={content.blog.instagramUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="group mt-4 inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-[11px] uppercase tracking-[0.25em] text-white/70 transition-all duration-300 hover:border-white hover:bg-white hover:text-black"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                  </svg>
                  {content.blog.instagramHandle}
                </a>
              </div>
            </article>
          </div>
        </div>
      </div>

      {/* Bottom spacer */}
      <div className="h-24" />
    </main>
  );
}
