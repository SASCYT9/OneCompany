import { siteConfig, type SupportedLocale } from "@/lib/seo";

export const localeAgnosticPublicPrefixes = [
  "/shop",
  "/auto",
  "/moto",
  "/brands",
  "/blog",
  "/contact",
  "/about",
  "/partnership",
  "/choice",
  "/privacy",
  "/terms",
  "/cookies",
  "/categories",
] as const;

export const localizedStaticSlugs = [
  "",
  "/shop",
  "/shop/catalog",
  "/shop/akrapovic",
  "/shop/akrapovic/collections",
  "/shop/ilmberger",
  "/shop/ilmberger/collections",
  "/shop/eventuri",
  "/shop/csf",
  "/shop/csf/collections",
  "/shop/ohlins",
  "/shop/ohlins/collections",
  "/shop/girodisc",
  "/shop/girodisc/catalog",
  "/shop/ipe",
  "/shop/ipe/collections",
  "/shop/brabus",
  "/shop/brabus/collections",
  "/shop/brabus/products",
  "/shop/do88",
  "/shop/do88/collections",
  "/shop/racechip",
  "/shop/racechip/catalog",
  "/shop/burger",
  "/shop/burger/products",
  "/shop/adro",
  "/shop/adro/collections",
  "/shop/urban",
  "/shop/urban/collections",
  "/shop/urban/products",
  "/auto",
  "/moto",
  "/brands",
  "/brands/moto",
  "/brands/europe",
  "/brands/usa",
  "/brands/oem",
  "/brands/racing",
  "/about",
  "/contact",
  "/partnership",
  "/choice",
  "/blog",
  "/privacy",
  "/terms",
  "/cookies",
  "/delivery",
  "/refund",
  "/categories",
] as const;

export const noindexPrefixes = ["/admin", "/api", "/quote"] as const;

export const removedBlogSlugs = ["one-company-dtskmdmjfgf"] as const;

const legacyBrandRedirectTargets = {
  kw: "/shop/catalog?brand=KW%20Suspensions",
  fi: "/shop/catalog?brand=Fi%20EXHAUST",
  eventuri: "/shop/eventuri",
} as const;

export const indexablePatterns = [
  /^\/(ua|en)$/,
  /^\/(ua|en)\/(?:shop|auto|moto|brands|blog|contact|about|partnership|choice|privacy|terms|cookies|categories)(?:\/[a-z0-9-]+)*$/,
] as const;

export const noindexPatterns = [
  /^\/admin(?:\/.*)?$/,
  /^\/api(?:\/.*)?$/,
  /^\/quote(?:\/.*)?$/,
  /^\/(ua|en)\/admin(?:\/.*)?$/,
  /^\/(ua|en)\/shop\/(?:account|cart|checkout|stock)(?:\/.*)?$/,
] as const;

export type RedirectPattern = {
  id: string;
  description: string;
  pattern: RegExp;
};

export const redirectPatterns: readonly RedirectPattern[] = [
  {
    id: "trailing-slash-normalization",
    description: "Normalize trailing slash for all non-root URLs.",
    pattern: /^\/.+\/$/,
  },
  {
    id: "removed-blog-slug-localized",
    description: "Redirect removed localized blog slugs to locale blog index.",
    pattern: /^\/(ua|en)\/blog\/one-company-dtskmdmjfgf$/,
  },
  {
    id: "removed-blog-slug-legacy",
    description: "Redirect removed non-localized blog slug to default locale blog index.",
    pattern: /^\/blog\/one-company-dtskmdmjfgf$/,
  },
  {
    id: "legacy-brand-route-localized",
    description: "Redirect old localized brand routes to the canonical storefront pages.",
    pattern: /^\/(?:ua|en)\/(?:kw|fi|eventuri)$/,
  },
  {
    id: "legacy-brand-route-legacy",
    description: "Redirect old non-localized brand routes to default-locale storefront pages.",
    pattern: /^\/(?:kw|fi|eventuri)$/,
  },
  {
    id: "legacy-brand-shop-route-localized",
    description: "Redirect old localized shop brand routes to the canonical storefront pages.",
    pattern: /^\/(?:ua|en)\/shop\/(?:kw|fi)$/,
  },
  {
    id: "legacy-brand-shop-route-legacy",
    description: "Redirect old non-localized shop brand routes to default-locale storefront pages.",
    pattern: /^\/shop\/(?:kw|fi)$/,
  },
  {
    id: "locale-first-routing",
    description: "Redirect locale-agnostic public routes to locale-prefixed URLs.",
    pattern:
      /^\/(?:shop|auto|moto|brands|blog|contact|about|partnership|choice|privacy|terms|cookies|categories)(?:\/.*)?$/,
  },
  {
    id: "root-to-locale",
    description: "Redirect root path to the default locale homepage.",
    pattern: /^\/$/,
  },
] as const;

export function normalizePathname(pathname: string): string {
  const withoutQuery = pathname.split("?")[0]?.split("#")[0] ?? "/";
  if (!withoutQuery) {
    return "/";
  }

  const normalized = withoutQuery.startsWith("/") ? withoutQuery : `/${withoutQuery}`;
  if (normalized.length > 1 && normalized.endsWith("/")) {
    return normalized.slice(0, -1);
  }

  return normalized;
}

export function hasLocalePrefix(pathname: string): boolean {
  return /^\/(ua|en)(\/|$)/.test(normalizePathname(pathname));
}

export function extractLocaleFromPath(pathname: string): SupportedLocale | null {
  const match = normalizePathname(pathname).match(/^\/(ua|en)(?:\/|$)/);
  if (!match) {
    return null;
  }

  const locale = match[1];
  return siteConfig.locales.includes(locale as SupportedLocale)
    ? (locale as SupportedLocale)
    : null;
}

export function stripLocaleFromPath(pathname: string): string {
  const normalized = normalizePathname(pathname);
  return normalized.replace(/^\/(ua|en)(?=\/|$)/, "") || "/";
}

export function isLocaleAgnosticPublicPath(pathname: string): boolean {
  const normalized = normalizePathname(pathname);
  return localeAgnosticPublicPrefixes.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`)
  );
}

export function isNoindexPath(pathname: string): boolean {
  const normalized = normalizePathname(pathname);
  return noindexPatterns.some((pattern) => pattern.test(normalized));
}

export function isIndexablePath(pathname: string): boolean {
  const normalized = normalizePathname(pathname);
  if (isNoindexPath(normalized)) {
    return false;
  }
  return indexablePatterns.some((pattern) => pattern.test(normalized));
}

export function getMatchedRedirectPattern(pathname: string): RedirectPattern | null {
  const normalized = normalizePathname(pathname);
  return redirectPatterns.find((entry) => entry.pattern.test(normalized)) ?? null;
}

export function resolveRemovedBlogRedirectPath(pathname: string): string | null {
  const normalized = normalizePathname(pathname);
  const localizedMatch = normalized.match(/^\/(ua|en)\/blog\/([a-z0-9-]+)$/);

  if (localizedMatch) {
    const [, locale, slug] = localizedMatch;
    if (removedBlogSlugs.includes(slug as (typeof removedBlogSlugs)[number])) {
      return `/${locale}/blog`;
    }
    return null;
  }

  const legacyMatch = normalized.match(/^\/blog\/([a-z0-9-]+)$/);
  if (legacyMatch) {
    const slug = legacyMatch[1];
    if (removedBlogSlugs.includes(slug as (typeof removedBlogSlugs)[number])) {
      return `/${siteConfig.defaultLocale}/blog`;
    }
  }

  return null;
}

export function resolveLegacyBrandRedirectPath(pathname: string): string | null {
  const normalized = normalizePathname(pathname);
  const match =
    normalized.match(/^\/(?:(ua|en)\/)?(kw|fi|eventuri)$/) ??
    normalized.match(/^\/(?:(ua|en)\/)?shop\/(kw|fi)$/);
  if (!match) {
    return null;
  }

  const locale = match[1] ?? siteConfig.defaultLocale;
  const target = legacyBrandRedirectTargets[match[2] as keyof typeof legacyBrandRedirectTargets];
  return `/${locale}${target}`;
}

export function getPeerLocalePath(pathname: string, targetLocale: SupportedLocale): string {
  const normalized = normalizePathname(pathname);
  if (!hasLocalePrefix(normalized)) {
    return `/${targetLocale}${normalized === "/" ? "" : normalized}`;
  }

  const stripped = stripLocaleFromPath(normalized);
  return stripped === "/" ? `/${targetLocale}` : `/${targetLocale}${stripped}`;
}
