"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";

type ShopBackToCatalogLinkProps = {
  /** Static fallback href if there is no usable history entry to return to. */
  fallbackHref: string;
  /** Visible label (already including the arrow glyph). */
  label: string;
  className?: string;
};

/**
 * "← Back to catalog" link that preserves the user's last filter state.
 *
 * Why this exists: PDPs used a plain `<Link href="/.../collections">` which
 * always discards the brand/model/chassis filter the user came in with.
 * Customers had to re-select everything after viewing one product.
 *
 * Behaviour:
 *   • If the previous history entry is same-origin (i.e. the user landed here
 *     by clicking a product card from our catalog), navigate via
 *     `router.back()` — that restores the exact catalog URL with all filter
 *     params intact.
 *   • Otherwise (deep-link from Telegram/Google/etc., or a fresh tab),
 *     fall back to the static catalog href.
 *
 * Render as `<Link>` on the server so the link is crawlable and progressively
 * enhanced: click is intercepted only when JS has hydrated, otherwise it just
 * follows the fallback href.
 */
export function ShopBackToCatalogLink({
  fallbackHref,
  label,
  className,
}: ShopBackToCatalogLinkProps) {
  const router = useRouter();

  const onClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    // Respect modifier-clicks (open in new tab, etc.).
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (event.button !== 0) return;

    if (typeof window === "undefined") return;

    // `history.length > 1` means there *is* a previous entry. We also require
    // the referrer to be same-origin so we don't router.back() out of the
    // site (e.g. came from Google → back would leave onecompany entirely).
    const hasInternalReferrer =
      document.referrer &&
      (() => {
        try {
          return new URL(document.referrer).origin === window.location.origin;
        } catch {
          return false;
        }
      })();

    if (hasInternalReferrer && window.history.length > 1) {
      event.preventDefault();
      router.back();
    }
    // else: let the <Link> navigate to fallbackHref normally.
  };

  return (
    <Link href={fallbackHref} onClick={onClick} className={className}>
      {label}
    </Link>
  );
}
