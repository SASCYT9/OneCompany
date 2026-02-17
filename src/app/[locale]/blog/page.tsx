import Image from "next/image";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/navigation";
import { readSiteContent } from "@/lib/siteContentServer";
import {
  absoluteUrl,
  buildLocalizedPath,
  buildPageMetadata,
  resolveLocale,
  type SupportedLocale,
} from "@/lib/seo";
import { BreadcrumbSchema } from '@/components/seo/StructuredData';

interface Props {
  params: Promise<{ locale: string }>;
}

const metaCopy: Record<SupportedLocale, { title: string; description: string }> = {
  ua: {
    title: "Блог · OneCompany",
    description: "Проєкти, поставки та backstage від One Company — преміальний тюнінг для авто та мото.",
  },
  en: {
    title: "Blog · OneCompany",
    description: "Projects, deliveries, and backstage from One Company — premium auto & moto tuning.",
  },
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const l = resolveLocale(locale);
  return buildPageMetadata(l, "blog", metaCopy[l]);
}

const getLocalized = (value: { ua: string; en: string }, locale: SupportedLocale) => {
  return value[locale] || value.ua || value.en;
};

const normalizeSnippet = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const getPreviewText = (caption: string, title: string, max = 180) => {
  const lines = caption
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    return title;
  }

  const titleNorm = normalizeSnippet(title);
  const candidate =
    lines.find((line) => {
      const lineNorm = normalizeSnippet(line);
      return lineNorm && lineNorm !== titleNorm && !lineNorm.startsWith(titleNorm);
    }) ?? lines[1] ?? lines[0];

  const normalized = candidate.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) {
    return normalized;
  }
  return `${normalized.slice(0, max - 1).trimEnd()}…`;
};

export default async function BlogPage({ params }: Props) {
  const { locale } = await params;
  const l = resolveLocale(locale);
  const t = await getTranslations("blog");
  const content = await readSiteContent();
  const blog = content.blog;
  const posts = blog.posts
    .filter((post) => post.status === "published")
    .sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

  /* First post is featured (hero card), rest are grid */
  const [featured, ...rest] = posts;

  const breadcrumbs = [
    { name: l === 'ua' ? 'Головна' : 'Home', url: absoluteUrl(buildLocalizedPath(l)) },
    { name: l === 'ua' ? 'Блог' : 'Blog', url: absoluteUrl(buildLocalizedPath(l, "/blog")) },
  ];

  return (
    <main id="main-content" className="relative min-h-screen bg-black pt-28 pb-24 text-white">
      <BreadcrumbSchema items={breadcrumbs} />
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -left-40 -top-20 h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle,_rgba(255,179,71,0.12),_transparent_65%)] blur-[100px]" />
        <div className="absolute right-0 top-60 h-[400px] w-[400px] rounded-full bg-[radial-gradient(circle,_rgba(92,188,255,0.10),_transparent_60%)] blur-[100px]" />
      </div>

      {/* ── Header ── */}
      <section className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-[0.5em] text-white/40">{t("latest")}</p>
          <h1 className="font-display text-4xl font-light tracking-tight sm:text-5xl lg:text-6xl">
            {t("title")}
          </h1>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-4">
          <a
            href={blog.instagramUrl}
            target="_blank"
            rel="noreferrer"
            className="group inline-flex items-center gap-2.5 rounded-full border border-white/20 bg-white/5 px-5 py-2.5 text-xs uppercase tracking-[0.3em] text-white backdrop-blur transition-all duration-300 hover:border-white hover:bg-white hover:text-black hover:shadow-[0_0_30px_rgba(255,255,255,0.15)]"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
            </svg>
            {t("follow")}
          </a>
          <span className="text-sm text-white/35 tracking-wide">{blog.instagramHandle}</span>
        </div>
      </section>

      {/* ── Featured post (hero card) ── */}
      {featured && (
        <section className="relative mx-auto mt-12 max-w-6xl px-4 sm:px-6">
          <Link
            href={`/blog/${featured.slug}`}
            className="group relative block overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] transition-all duration-500 hover:border-white/20 hover:shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
          >
            <div className="flex flex-col md:flex-row">
              {/* Image */}
              <div className="relative aspect-[4/3] w-full md:aspect-auto md:w-1/2 lg:w-[55%]">
                {featured.media[0] ? (
                  featured.media[0].type === "image" ? (
                    <Image
                      src={featured.media[0].src}
                      alt={featured.media[0].alt ?? getLocalized(featured.title, l)}
                      fill
                      sizes="(max-width: 768px) 100vw, 55vw"
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                      priority
                      unoptimized={featured.media[0].src.startsWith("http")}
                      loader={featured.media[0].src.startsWith("http") ? ({ src }) => src : undefined}
                    />
                  ) : (
                    <video
                      src={featured.media[0].src}
                      poster={featured.media[0].poster}
                      muted
                      loop
                      autoPlay
                      playsInline
                      preload="metadata"
                      className="h-full w-full object-cover"
                    />
                  )
                ) : (
                  <div className="h-full w-full bg-gradient-to-br from-white/5 via-black to-black" />
                )}
                {featured.media[0]?.type === "video" && (
                  <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/60 px-3 py-1 text-[10px] uppercase tracking-[0.25em] text-white/80 backdrop-blur-md">
                    Reel
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-black/80 hidden md:block" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent md:hidden" />
              </div>

              {/* Content */}
              <div className="relative flex flex-col justify-center gap-5 p-6 sm:p-8 md:w-1/2 lg:w-[45%] md:p-10 lg:p-14">
                {featured.location && (
                  <div className="flex items-center gap-3 text-xs uppercase tracking-[0.4em] text-white/40">
                    <span>{getLocalized(featured.location, l)}</span>
                  </div>
                )}

                <h2 className="font-display text-2xl font-light leading-tight tracking-tight sm:text-3xl lg:text-4xl">
                  {getLocalized(featured.title, l)}
                </h2>

                <p className="line-clamp-4 text-sm leading-relaxed text-white/55 sm:text-base">
                  {getPreviewText(
                    getLocalized(featured.caption, l),
                    getLocalized(featured.title, l),
                    220
                  )}
                </p>

                {featured.tags?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {featured.tags.slice(0, 4).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.25em] text-white/45"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                ) : null}

                <div className="mt-auto pt-4">
                  <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.35em] text-white/50 transition-colors duration-300 group-hover:text-white">
                    {l === "ua" ? "Читати далі" : "Read more"}
                    <span className="inline-block transition-transform duration-300 group-hover:translate-x-1">→</span>
                  </span>
                </div>
              </div>
            </div>
          </Link>
        </section>
      )}

      {/* ── Posts grid ── */}
      {rest.length > 0 && (
        <section className="relative mx-auto mt-12 max-w-6xl px-4 sm:px-6">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((post) => {
              const media = post.media[0];
              const isExternalImage =
                media?.type === "image" && media.src.startsWith("http");
              return (
                <Link
                  key={post.id}
                  href={`/blog/${post.slug}`}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] transition-all duration-500 hover:border-white/20 hover:shadow-[0_10px_40px_rgba(0,0,0,0.4)]"
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-[16/10] w-full overflow-hidden">
                    {media ? (
                      media.type === "image" ? (
                        <Image
                          src={media.src}
                          alt={media.alt ?? getLocalized(post.title, l)}
                          fill
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          className="object-cover transition-transform duration-700 group-hover:scale-105"
                          unoptimized={isExternalImage}
                          loader={isExternalImage ? ({ src }) => src : undefined}
                        />
                      ) : (
                        <video
                          src={media.src}
                          poster={media.poster}
                          muted
                          loop
                          autoPlay
                          playsInline
                          preload="metadata"
                          className="h-full w-full object-cover"
                        />
                      )
                    ) : (
                      <div className="h-full w-full bg-gradient-to-br from-white/5 via-black to-black" />
                    )}
                    {media?.type === "video" && (
                      <div className="absolute left-3 top-3 rounded-full border border-white/20 bg-black/60 px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-white/75 backdrop-blur-md">
                        Reel
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  </div>

                  {/* Card body */}
                  <div className="flex flex-1 flex-col gap-3 p-5">
                    {post.location && (
                      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.35em] text-white/35">
                        <span>{getLocalized(post.location, l)}</span>
                      </div>
                    )}

                    <h3 className="font-display text-lg font-light leading-snug tracking-tight text-white">
                      {getLocalized(post.title, l)}
                    </h3>

                    <p className="line-clamp-2 text-sm leading-relaxed text-white/45">
                      {getPreviewText(
                        getLocalized(post.caption, l),
                        getLocalized(post.title, l),
                        130
                      )}
                    </p>

                    <div className="mt-auto pt-3">
                      <span className="text-xs uppercase tracking-[0.3em] text-white/40 transition-colors group-hover:text-white">
                        {l === "ua" ? "Детальніше →" : "Read more →"}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Empty state ── */}
      {posts.length === 0 && (
        <section className="relative mx-auto mt-16 max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col items-center gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/5">
              <svg className="h-7 w-7 text-white/30" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z" />
              </svg>
            </div>
            <p className="text-white/50">{t("empty")}</p>
          </div>
        </section>
      )}
    </main>
  );
}
