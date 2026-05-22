import Link from "next/link";
import type { SupportedLocale } from "@/lib/seo";

type Props = {
  locale: SupportedLocale;
  currentPage: number;
  totalPages: number;
  /** Path including locale, e.g. "/en/shop/akrapovic/collections". No query string. */
  basePath: string;
};

/**
 * Server-rendered pagination for SEO-critical listing pages. Plain `<a href>`
 * pagination links so Googlebot follows them on the first crawl pass —
 * critical because the original "Load more" button is `onClick` (JS-only)
 * which left products 31+ orphan in the crawl graph.
 *
 * Strategy mirrors how big-catalog ecommerce sites do windowed pagination:
 * always show first + last, current ± 2 neighbors, ellipses for gaps. Keeps
 * the link count under ~12 per page (vs hundreds if we rendered all of
 * 5 181 / 60 = 87 RaceChip pages) and minimizes HTML payload.
 *
 * Note: canonical for `?page=N` URLs intentionally points back to the base
 * `?page=1` URL (via the existing buildPageMetadata helper). Pagination is
 * a crawl-discovery aid, not an indexing target — Google follows the links
 * to find products, then dedupes the paginated listing pages themselves.
 * Per Google's 2019 announcement, `rel="prev/next"` is no longer used as an
 * indexing signal, so we skip it.
 */
export function ShopPaginationNav({ locale, currentPage, totalPages, basePath }: Props) {
  if (totalPages <= 1) return null;

  const isUa = locale === "ua";
  const pages = buildWindowedPageList(currentPage, totalPages);

  const buildHref = (page: number) => (page === 1 ? basePath : `${basePath}?page=${page}`);

  return (
    <nav
      aria-label={isUa ? "Сторінки каталогу" : "Catalog pagination"}
      className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-2 px-6 py-12 text-xs font-semibold uppercase tracking-[0.2em]"
    >
      {currentPage > 1 ? (
        <Link
          href={buildHref(currentPage - 1)}
          rel="prev"
          className="rounded-[2px] border border-foreground/15 px-3 py-2 text-foreground/70 transition-colors hover:border-foreground/35 hover:text-foreground"
          aria-label={isUa ? "Попередня сторінка" : "Previous page"}
        >
          ←
        </Link>
      ) : null}

      {pages.map((entry, idx) =>
        entry === "ellipsis" ? (
          <span key={`ellipsis-${idx}`} aria-hidden="true" className="px-2 text-foreground/35">
            …
          </span>
        ) : entry === currentPage ? (
          <span
            key={entry}
            aria-current="page"
            className="rounded-[2px] border border-foreground bg-foreground px-3 py-2 text-background"
          >
            {entry}
          </span>
        ) : (
          <Link
            key={entry}
            href={buildHref(entry)}
            className="rounded-[2px] border border-foreground/15 px-3 py-2 text-foreground/70 transition-colors hover:border-foreground/35 hover:text-foreground"
          >
            {entry}
          </Link>
        )
      )}

      {currentPage < totalPages ? (
        <Link
          href={buildHref(currentPage + 1)}
          rel="next"
          className="rounded-[2px] border border-foreground/15 px-3 py-2 text-foreground/70 transition-colors hover:border-foreground/35 hover:text-foreground"
          aria-label={isUa ? "Наступна сторінка" : "Next page"}
        >
          →
        </Link>
      ) : null}
    </nav>
  );
}

/**
 * Returns the page sequence to render: [1, "…", current-1, current, current+1,
 * "…", totalPages] with edge cases collapsed when there's no gap. Tight
 * windowing keeps the link list under ~10 entries even for 100+-page catalogs.
 */
function buildWindowedPageList(current: number, total: number): Array<number | "ellipsis"> {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: Array<number | "ellipsis"> = [1];
  const start = Math.max(2, current - 2);
  const end = Math.min(total - 1, current + 2);

  if (start > 2) pages.push("ellipsis");
  for (let p = start; p <= end; p++) pages.push(p);
  if (end < total - 1) pages.push("ellipsis");

  pages.push(total);
  return pages;
}

/**
 * Server-side helper: given the full product list and the current page,
 * returns the slice for the page plus pagination metadata. Use this from
 * each brand's listing page.tsx to keep slicing logic uniform across brands.
 *
 * NOTE: 30 (not 60) — must match each filter component's internal
 * `visibleCount = useState(30)` default. The filter only renders its
 * `slice(0, visibleCount)` on initial mount, so if we slice the server
 * payload to 60 the filter renders 30 and the back half is dropped from
 * the SSR HTML (Googlebot sees half of every paginated page). Aligning
 * the slice to the filter's window keeps every product crawlable.
 */
export const COLLECTION_PAGE_SIZE = 30;

export function paginateProducts<T>(
  allProducts: T[],
  pageNumber: number,
  pageSize: number = COLLECTION_PAGE_SIZE
): { pageProducts: T[]; currentPage: number; totalPages: number } {
  const totalPages = Math.max(1, Math.ceil(allProducts.length / pageSize));
  const currentPage = Math.min(Math.max(1, pageNumber), totalPages);
  const start = (currentPage - 1) * pageSize;
  return {
    pageProducts: allProducts.slice(start, start + pageSize),
    currentPage,
    totalPages,
  };
}
