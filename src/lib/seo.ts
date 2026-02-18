import type { Metadata } from "next";

export const siteConfig = {
  name: "One Company Global",
  description:
    "Тюнінг авто та мото Київ, Україна. Premium automotive and motorcycle tuning with expert logistics and importer support.",
  url: "https://onecompany.global",
  defaultLocale: "ua" as const,
  locales: ["ua", "en"] as const,
};

export type SupportedLocale = (typeof siteConfig.locales)[number];

const localeToOg: Record<SupportedLocale, string> = {
  ua: "uk_UA",
  en: "en_US",
};

const defaultOgImage = "/branding/og-image.png";

function normalizeMetaText(value: string, limit: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) {
    return normalized;
  }
  return `${normalized.slice(0, limit - 1).trimEnd()}…`;
}

export function resolveLocale(locale?: string): SupportedLocale {
  return siteConfig.locales.includes(locale as SupportedLocale)
    ? (locale as SupportedLocale)
    : siteConfig.defaultLocale;
}

export function absoluteUrl(path = "/"): string {
  const normalizedBase = siteConfig.url;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

export function buildLocalizedPath(locale: SupportedLocale, slug = ""): string {
  const normalizedSlug = slug ? (slug.startsWith("/") ? slug : `/${slug}`) : "";
  return `/${locale}${normalizedSlug}`;
}

export function buildAlternateLinks(slug = ""): Record<string, string> {
  const links: Record<string, string> = {};

  siteConfig.locales.forEach((locale) => {
    const hreflangCode = locale === "ua" ? "uk" : locale;
    links[hreflangCode] = absoluteUrl(buildLocalizedPath(locale, slug));
  });

  links["x-default"] = absoluteUrl(buildLocalizedPath(siteConfig.defaultLocale, slug));

  return links;
}

export function buildPageMetadata(
  locale: SupportedLocale,
  slug: string,
  meta: { title: string; description: string; image?: string; type?: "website" | "article" | "profile" }
): Metadata {
  const path = buildLocalizedPath(locale, slug);
  const url = absoluteUrl(path);
  const ogImage = meta.image
    ? (meta.image.startsWith("http") ? meta.image : absoluteUrl(meta.image))
    : absoluteUrl(defaultOgImage);
  const description = normalizeMetaText(meta.description, 165);
  const title = normalizeMetaText(meta.title, 68);

  return {
    title,
    description,
    alternates: {
      canonical: url,
      languages: buildAlternateLinks(slug),
    },
    openGraph: {
      title,
      description,
      url,
      siteName: siteConfig.name,
      locale: localeToOg[locale],
      type: meta.type ?? "website",
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}
