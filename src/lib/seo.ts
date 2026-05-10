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
  meta: {
    title: string;
    description: string;
    image?: string;
    type?: "website" | "article" | "profile" | "product";
  }
): Metadata {
  const path = buildLocalizedPath(locale, slug);
  const url = absoluteUrl(path);
  const usingDefaultOg = !meta.image;
  const ogImage = meta.image
    ? meta.image.startsWith("http")
      ? meta.image
      : absoluteUrl(meta.image)
    : absoluteUrl(defaultOgImage);
  const description = normalizeMetaText(meta.description, 165);
  // 95 fits Telegram/Twitter/Facebook without visible truncation; the
  // ellipsis only appears for genuinely runaway titles.
  const title = normalizeMetaText(meta.title, 95);

  // Only attach width/height when we control the asset (the default OG image
  // we ship is 1200×630). For product/CDN images of unknown shape, omitting
  // the dimensions lets Telegram/Facebook auto-detect from the file instead
  // of believing a wrong 1200×630 claim.
  const ogImageEntry = usingDefaultOg
    ? { url: ogImage, width: 1200, height: 630, alt: title }
    : { url: ogImage, alt: title };

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
      // Tell Facebook/social platforms about the other-language version of
      // this page so they can offer a "View in English" / "Українською"
      // toggle in shared link previews.
      alternateLocale: siteConfig.locales.filter((l) => l !== locale).map((l) => localeToOg[l]),
      // Next.js Metadata silently drops the entire openGraph block when type
      // is "product" (not in its built-in enum), so we always declare
      // "website" here and let the page emit a raw <meta property="og:type"
      // content="product"> via OpenGraphProductMeta when needed.
      type: meta.type === "product" ? "website" : (meta.type ?? "website"),
      images: [ogImageEntry],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

export function buildNoIndexPageMetadata(
  locale: SupportedLocale,
  slug: string,
  meta: {
    title: string;
    description: string;
    image?: string;
    type?: "website" | "article" | "profile";
  }
): Metadata {
  return {
    ...buildPageMetadata(locale, slug, meta),
    robots: {
      index: false,
      follow: false,
      googleBot: {
        index: false,
        follow: false,
        "max-image-preview": "none",
        "max-snippet": 0,
        "max-video-preview": 0,
      },
    },
  };
}
