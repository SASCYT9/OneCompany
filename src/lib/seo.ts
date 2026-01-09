import type { Metadata } from "next";

export const siteConfig = {
  name: "onecompany",
  description:
    "Premium automotive and motorcycle performance programs with expert logistics, homologation, and importer support.",
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
  return siteConfig.locales.reduce<Record<string, string>>((acc, locale) => {
    // Use proper ISO language code 'uk' for Ukrainian instead of 'ua'
    const hreflangCode = locale === 'ua' ? 'uk' : locale;
    acc[hreflangCode] = absoluteUrl(buildLocalizedPath(locale, slug));
    return acc;
  }, {});
}

export function buildPageMetadata(
  locale: SupportedLocale,
  slug: string,
  meta: { title: string; description: string; image?: string; type?: "website" | "article" | "profile" }
): Metadata {
  const path = buildLocalizedPath(locale, slug);
  const url = absoluteUrl(path);
  const ogImage = meta.image ?? absoluteUrl(defaultOgImage);

  return {
    title: meta.title,
    description: meta.description,
    alternates: {
      canonical: url,
      languages: buildAlternateLinks(slug),
    },
    openGraph: {
      title: meta.title,
      description: meta.description,
      url,
      siteName: siteConfig.name,
      locale: localeToOg[locale],
      type: meta.type ?? "website",
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: meta.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: meta.title,
      description: meta.description,
      images: [ogImage],
    },
  };
}
