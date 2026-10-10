import Image from "next/image";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/navigation";
import { readSiteContent } from "@/lib/siteContentServer";
import { blogAuthorName, formatBlogDate, getBlogSocialCover } from "@/lib/blogPresentation";
import {
  absoluteUrl,
  buildLocalizedPath,
  buildPageMetadata,
  resolveLocale,
  type SupportedLocale,
} from "@/lib/seo";
import { BlogCarousel } from "./BlogCarousel";
import { ArticleSchema, BreadcrumbSchema, ProductSchema } from "@/components/seo/StructuredData";

// ISR: cache rendered HTML for 1 hour. Public content, no per-user data on server.
export const dynamic = "force-static";
export const revalidate = 3600;
export const dynamicParams = false;

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateStaticParams() {
  const content = await readSiteContent();
  return content.blog.posts
    .filter((post) => post.status === "published")
    .map((post) => ({ slug: post.slug }));
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

const slugQueryVariant: Record<string, { ua: string; en: string }> = {
  "darwinpro-bmw8-widetrack": { ua: "карбоновий боді-кит BMW", en: "BMW carbon body kit" },
  "3d-design-bmw-exhaust-tips": { ua: "насадки вихлопу BMW", en: "BMW exhaust tips" },
  "urban-range-rover-widetrack": { ua: "тюнінг Range Rover", en: "Range Rover tuning" },
  "brabus-performance": { ua: "Brabus тюнінг", en: "Brabus tuning" },
  "ct-carbon-rsq8": { ua: "Audi RSQ8 карбон", en: "Audi RSQ8 carbon kit" },
  "ipe-exhaust-valvetronic": { ua: "valvetronic вихлоп", en: "valvetronic exhaust" },
  "eventuri-intake": { ua: "впуск Eventuri", en: "Eventuri intake" },
  "adro-bmw-g8x-carbon": { ua: "карбоновий тюнінг BMW G8X", en: "BMW G8X carbon tuning" },
  "akrapovic-titanium": { ua: "титановий вихлоп Akrapovic", en: "Akrapovic titanium exhaust" },
  "onecompany-premium-import": { ua: "преміум імпорт тюнінгу", en: "premium tuning import" },
};

const productSignals = [
  "akrapovic",
  "eventuri",
  "ipe",
  "ct carbon",
  "darwinpro",
  "brabus",
  "adro",
  "3d design",
  "urban",
];

const toExcerpt = (value: string, fallback: string, max = 170, avoid?: string) => {
  const lines = value
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);

  const allLines = value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const avoidNorm = avoid ? normalizeSnippet(avoid) : "";

  const candidate =
    allLines.find((line) => {
      if (!avoidNorm) return true;
      const lineNorm = normalizeSnippet(line);
      return lineNorm && lineNorm !== avoidNorm && !lineNorm.startsWith(avoidNorm);
    }) ??
    lines ??
    fallback;

  const normalized = (candidate || fallback).replace(/\s+/g, " ").trim();
  if (normalized.length <= max) {
    return normalized;
  }
  return `${normalized.slice(0, max - 1).trimEnd()}…`;
};

const buildCommercialSnippet = (locale: SupportedLocale, caption: string, title: string) => {
  const base = toExcerpt(caption, title, 138, title);
  return locale === "ua"
    ? `${base} Офіційні поставки та підбір під замовлення від OneCompany.`
    : `${base} Official supply and tailored sourcing by OneCompany.`;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const l = resolveLocale(locale);
  const content = await readSiteContent();
  const post = content.blog.posts.find((item) => item.slug === slug && item.status === "published");

  if (!post) {
    notFound();
    return buildPageMetadata(l, `blog/${slug}`, {
      title: l === "ua" ? "Публікація · OneCompany" : "Post · OneCompany",
      description: l === "ua" ? "Публікація блогу" : "Blog post",
    });
  }

  const socialCover = getBlogSocialCover(post);
  const localizedTitle = getLocalized(post.title, l);
  const localizedCaption = getLocalized(post.caption, l);
  const queryVariant =
    slugQueryVariant[post.slug]?.[l] ??
    (l === "ua" ? "кейс тюнінгу авто та мото" : "auto and moto tuning case");

  const metadata = buildPageMetadata(l, `blog/${post.slug}`, {
    title: post.seoTitle
      ? getLocalized(post.seoTitle, l)
      : `${localizedTitle} | ${queryVariant} | One Company`,
    description: post.description
      ? getLocalized(post.description, l)
      : buildCommercialSnippet(l, localizedCaption, localizedTitle),
    image: socialCover?.src,
    type: "article",
  });
  return {
    ...metadata,
    authors: [{ name: blogAuthorName, url: absoluteUrl(buildLocalizedPath(l, "/about")) }],
    openGraph: {
      ...metadata.openGraph,
      type: "article",
      publishedTime: post.date,
      modifiedTime: post.updatedAt ?? post.date,
      authors: [absoluteUrl(buildLocalizedPath(l, "/about"))],
      ...(socialCover
        ? {
            images: [
              {
                url: socialCover.src.startsWith("http")
                  ? socialCover.src
                  : absoluteUrl(socialCover.src),
                width: socialCover.width,
                height: socialCover.height,
                alt: post.cover ? getLocalized(post.cover.alt, l) : localizedTitle,
              },
            ],
          }
        : {}),
    },
    twitter: {
      ...metadata.twitter,
      card: "summary_large_image",
      ...(socialCover
        ? {
            images: [
              socialCover.src.startsWith("http") ? socialCover.src : absoluteUrl(socialCover.src),
            ],
          }
        : {}),
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const l = resolveLocale(locale);
  const t = await getTranslations("blog");
  const content = await readSiteContent();
  const post = content.blog.posts.find((item) => item.slug === slug && item.status === "published");

  if (!post) {
    notFound();
  }

  const captionText = getLocalized(post.caption, l);
  const captionParagraphs = captionText.split("\n").filter(Boolean);
  const lastPara = captionParagraphs[captionParagraphs.length - 1] ?? "";
  const hasHashtagLine = lastPara.startsWith("#");
  const bodyParagraphs = hasHashtagLine ? captionParagraphs.slice(0, -1) : captionParagraphs;

  const mediaItems = post.media;
  const hasMultipleMedia = mediaItems.length > 1;
  const localizedTitle = getLocalized(post.title, l);
  const postUrl = absoluteUrl(buildLocalizedPath(l, `/blog/${post.slug}`));
  const articleDescription = toExcerpt(captionText, localizedTitle, 170, localizedTitle);
  const socialCover = getBlogSocialCover(post);
  const coverPath = socialCover?.src;
  const coverImage = coverPath
    ? coverPath.startsWith("http")
      ? coverPath
      : absoluteUrl(coverPath)
    : undefined;
  const breadcrumbs = [
    { name: l === "ua" ? "Головна" : "Home", url: absoluteUrl(buildLocalizedPath(l)) },
    { name: l === "ua" ? "Блог" : "Blog", url: absoluteUrl(buildLocalizedPath(l, "/blog")) },
    { name: localizedTitle, url: postUrl },
  ];
  const shouldRenderProductSchema = false;
  const productImage = coverImage ?? absoluteUrl("/branding/og-image.png");

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <BreadcrumbSchema items={breadcrumbs} />
      <ArticleSchema
        id="blog-post-article-schema"
        headline={localizedTitle}
        description={articleDescription}
        url={postUrl}
        image={coverImage}
        imageWidth={socialCover?.width}
        imageHeight={socialCover?.height}
        articleType={post.sections ? "NewsArticle" : "Article"}
        datePublished={post.date}
        dateModified={post.updatedAt ?? post.date}
        locale={l}
      />
      {shouldRenderProductSchema && (
        <ProductSchema
          name={localizedTitle}
          description={articleDescription}
          image={productImage}
          brand="OneCompany"
          category={l === "ua" ? "Авто та мото тюнінг" : "Auto and moto tuning"}
          url={postUrl}
        />
      )}
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -left-40 top-0 h-[600px] w-[600px] rounded-full bg-[radial-gradient(circle,rgba(255,179,71,0.06),transparent_65%)] blur-[120px]" />
        <div className="absolute right-0 top-60 h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle,rgba(92,188,255,0.04),transparent_60%)] blur-[120px]" />
      </div>

      {/* ── Back button ── */}
      <div className="relative z-10 mx-auto max-w-6xl px-4 pt-28 sm:px-6">
        <Link
          href="/blog"
          aria-label={l === "ua" ? "Повернутися до блогу OneCompany" : "Back to OneCompany blog"}
          className="inline-flex items-center gap-2 rounded-full border border-foreground/15 bg-foreground/5 px-4 py-2 text-[11px] uppercase tracking-[0.35em] text-foreground/65 dark:text-foreground/50 backdrop-blur-md transition-all hover:border-foreground/30 hover:text-foreground/95 dark:text-foreground/80"
        >
          ← {t("back")}
        </Link>
      </div>

      {/* ── Two-column layout ── */}
      <div className="relative z-10 mx-auto max-w-6xl px-4 pt-8 sm:px-6 lg:pt-10">
        <div className="flex flex-col gap-8 lg:flex-row lg:gap-12">
          {/* ── LEFT: Image carousel ── */}
          <div className="w-full lg:w-[55%] xl:w-[58%]">
            {mediaItems.length > 0 && (
              <div className="lg:sticky lg:top-28">
                {hasMultipleMedia ? (
                  <BlogCarousel
                    media={mediaItems.map((item) => ({
                      type: item.type,
                      src: item.src,
                      poster: item.poster,
                      alt: item.alt ?? localizedTitle,
                    }))}
                  />
                ) : (
                  <div
                    className={`relative overflow-hidden rounded-2xl border border-foreground/10 bg-foreground/[0.03] lg:rounded-3xl ${post.sections ? "aspect-video" : "aspect-4/5 sm:aspect-3/4"}`}
                  >
                    {mediaItems[0].type === "image" ? (
                      <Image
                        src={mediaItems[0].src}
                        alt={
                          post.cover
                            ? getLocalized(post.cover.alt, l)
                            : (mediaItems[0].alt ?? localizedTitle)
                        }
                        fill
                        sizes="(max-width: 1024px) 100vw, 55vw"
                        className={post.sections ? "object-contain" : "object-cover"}
                        priority
                        unoptimized={mediaItems[0].src.startsWith("http")}
                        loader={mediaItems[0].src.startsWith("http") ? ({ src }) => src : undefined}
                      />
                    ) : (
                      <video
                        src={mediaItems[0].src}
                        poster={mediaItems[0].poster}
                        controls
                        autoPlay
                        muted
                        loop
                        playsInline
                        preload="metadata"
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                )}
                {post.cover?.credit ? (
                  <p className="mt-3 text-xs text-foreground/60">
                    {getLocalized(post.cover.credit, l)}
                  </p>
                ) : null}
              </div>
            )}
          </div>

          {/* ── RIGHT: Article text ── */}
          <div className="w-full lg:w-[45%] xl:w-[42%]">
            <article>
              {/* Meta */}
              {post.location && (
                <div className="flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-[0.4em] text-foreground/55 dark:text-foreground/30">
                  <span>{getLocalized(post.location, l)}</span>
                </div>
              )}

              {/* Title */}
              <h1 className="mt-5 font-display text-2xl font-light leading-tight tracking-tight sm:text-3xl lg:text-4xl">
                {localizedTitle}
              </h1>

              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-foreground/70">
                <span>
                  {l === "ua" ? "Матеріал:" : "By:"}{" "}
                  <Link href="/about" rel="author" className="underline underline-offset-4">
                    {blogAuthorName}
                  </Link>
                </span>
                <span>
                  {l === "ua" ? "Опубліковано:" : "Published:"}{" "}
                  <time dateTime={post.date}>{formatBlogDate(post.date, l)}</time>
                </span>
                {post.updatedAt && post.updatedAt !== post.date ? (
                  <span>
                    {l === "ua" ? "Оновлено:" : "Updated:"}{" "}
                    <time dateTime={post.updatedAt}>{formatBlogDate(post.updatedAt, l)}</time>
                  </span>
                ) : null}
              </div>

              {/* Divider */}
              <div className="my-6 h-px bg-linear-to-r from-foreground/20 via-foreground/10 to-transparent" />

              {/* Body text */}
              <div className="space-y-4">
                {bodyParagraphs.map((p, i) => {
                  const isList = p.startsWith("—") || p.startsWith("-");
                  return (
                    <p
                      key={i}
                      className={
                        isList
                          ? "pl-4 text-[15px] leading-relaxed text-foreground/70 dark:text-foreground/55 border-l border-foreground/10 sm:text-base"
                          : "text-[15px] leading-relaxed text-foreground/75 dark:text-foreground/60 sm:text-base sm:leading-relaxed"
                      }
                    >
                      {p}
                    </p>
                  );
                })}
              </div>

              {post.sections?.map((section, index) => (
                <section key={index} className="mt-7 space-y-4">
                  <h2 className="font-display text-xl leading-snug text-foreground">
                    {getLocalized(section.heading, l)}
                  </h2>
                  {section.paragraphs.map((paragraph, i) => (
                    <p
                      key={i}
                      className="text-[15px] leading-relaxed text-foreground/75 dark:text-foreground/60 sm:text-base"
                    >
                      {getLocalized(paragraph, l)}
                    </p>
                  ))}
                  {section.table ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <caption className="sr-only">{getLocalized(section.heading, l)}</caption>
                        <thead>
                          <tr>
                            {(l === "ua"
                              ? ["Артикул", "Компонент", "Сумісність"]
                              : ["Part number", "Component", "Fitment"]
                            ).map((label) => (
                              <th
                                key={label}
                                scope="col"
                                className="border-b border-foreground/20 py-3 pr-3"
                              >
                                {label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {section.table.map((row, i) => (
                            <tr key={i}>
                              {row.map((cell, j) => (
                                <td key={j} className="border-b border-foreground/10 py-3 pr-3">
                                  {getLocalized(cell, l)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </section>
              ))}

              {post.sections ? (
                <Link
                  href="/contact#selection-form"
                  className="mt-7 inline-flex rounded-full border border-foreground/20 px-5 py-3 text-sm transition-colors hover:bg-foreground/10"
                >
                  {l === "ua" ? "Надіслати запит на підбір" : "Request a parts consultation"} →
                </Link>
              ) : null}
              {post.disclosure ? (
                <p className="mt-8 text-sm leading-relaxed text-foreground/65">
                  {getLocalized(post.disclosure, l)}
                </p>
              ) : null}
              {post.sources?.length ? (
                <section className="mt-6">
                  <h2 className="text-base font-medium">{l === "ua" ? "Джерела" : "Sources"}</h2>
                  <ul className="mt-3 space-y-2 text-sm">
                    {post.sources.map((source) => (
                      <li key={source.url}>
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-foreground/75 underline underline-offset-4 hover:text-foreground"
                        >
                          {getLocalized(source.title, l)}
                        </a>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {/* Tags */}
              {post.tags?.length ? (
                <div className="mt-8 flex flex-wrap gap-2">
                  {post.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-foreground/10 bg-foreground/5 px-3 py-1.5 text-[10px] uppercase tracking-[0.25em] text-foreground/55 dark:text-foreground/35 transition-colors hover:border-foreground/15 hover:text-foreground/70 dark:text-foreground/55"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              ) : null}

              {/* CTA / Instagram */}
              <div className="mt-10 rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-6 text-center">
                <p className="text-[10px] uppercase tracking-[0.5em] text-foreground/45 dark:text-foreground/25">
                  {l === "ua" ? "Стежте за нами" : "Follow us"}
                </p>
                <a
                  href={content.blog.instagramUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={
                    l === "ua" ? "Відкрити Instagram OneCompany" : "Open OneCompany Instagram"
                  }
                  className="group mt-4 inline-flex items-center gap-3 rounded-full border border-foreground/15 bg-foreground/5 px-5 py-2.5 text-[11px] uppercase tracking-[0.25em] text-foreground/85 dark:text-foreground/70 transition-all duration-300 hover:border-primary hover:bg-primary hover:text-primary-foreground"
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
    </div>
  );
}
