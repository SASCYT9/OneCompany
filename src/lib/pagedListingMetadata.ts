import type { Metadata } from "next";
import {
  absoluteUrl,
  buildAlternateLinks,
  buildLocalizedPath,
  type SupportedLocale,
} from "@/lib/seo";

export function parseListingPage(value: string): number | null {
  if (!/^[1-9]\d*$/.test(value)) return null;
  const page = Number(value);
  return Number.isSafeInteger(page) ? page : null;
}

export function buildPagedListingMetadata(
  base: Metadata,
  locale: SupportedLocale,
  baseSlug: string,
  page: number
): Metadata {
  const slug = `${baseSlug.replace(/^\//, "")}/page/${page}`;
  const url = absoluteUrl(buildLocalizedPath(locale, slug));
  return {
    ...base,
    alternates: {
      canonical: url,
      languages: buildAlternateLinks(slug),
    },
    openGraph: base.openGraph ? { ...base.openGraph, url } : undefined,
  };
}
