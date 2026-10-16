/**
 * Instagram/Facebook ads aimed at Ukraine link to the English catalog
 * (/en/shop/catalog?brand=Eventuri), and a running boosted post's link cannot
 * be edited. Vercel Analytics (2026-10-16): 354 Instagram visitors landed on
 * /en/shop/catalog, 91% of them from Ukraine, 92% bounced; /ua/shop/catalog got
 * none. Visitors from Ukraine who open such a link from a Meta app get a
 * temporary redirect to the same page under /ua, query kept.
 *
 * Crawlers, visitors outside Ukraine, client-side navigations (so the language
 * switcher still works) and every other path keep their current behaviour.
 */
const META_AD_REDIRECT_PATHS = new Set(["/en/shop/catalog"]);

const META_IN_APP_BROWSER = /\bInstagram\b|FBAN\/|FBAV\/|FB_IAB\//;
const META_REFERRER_HOST = /(?:^|\.)(?:instagram|facebook)\.com$/i;

function refererHost(referer: string | null): string {
  if (!referer) return "";
  try {
    return new URL(referer).hostname;
  } catch {
    return "";
  }
}

export function resolveMetaAdLocaleRedirect(input: {
  pathname: string;
  country: string | null;
  userAgent: string | null;
  referer: string | null;
  hasFbclid: boolean;
  /** A full-page GET, not an RSC fetch or prefetch from client navigation. */
  isDocumentRequest: boolean;
}): string | null {
  if (!input.isDocumentRequest) return null;
  if (!META_AD_REDIRECT_PATHS.has(input.pathname)) return null;
  if (input.country !== "UA") return null;
  const fromMetaApp =
    input.hasFbclid ||
    META_IN_APP_BROWSER.test(input.userAgent ?? "") ||
    META_REFERRER_HOST.test(refererHost(input.referer));
  if (!fromMetaApp) return null;
  return input.pathname.replace(/^\/en\//, "/ua/");
}
