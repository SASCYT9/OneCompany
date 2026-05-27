"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type ShopBackToCatalogLinkProps = {
  /** Static fallback href if there is no usable history entry to return to. */
  fallbackHref: string;
  /** Visible label (already including the arrow glyph). */
  label: React.ReactNode;
  className?: string;
  /** Skip router.back() history navigation and force direct navigation to fallbackHref. */
  disableHistoryBack?: boolean;
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
  disableHistoryBack = false,
}: ShopBackToCatalogLinkProps) {
  const router = useRouter();
  const [actualHref, setActualHref] = useState(fallbackHref);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (fallbackHref.includes("racechip")) {
        const raw = window.sessionStorage.getItem("racechipVehiclePreference");
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (parsed) {
          const url = new URL(fallbackHref, window.location.origin);
          if (parsed.make && parsed.make !== "all") url.searchParams.set("make", parsed.make);
          if (parsed.model && parsed.model !== "all") url.searchParams.set("model", parsed.model);
          if (parsed.chassis && parsed.chassis !== "all")
            url.searchParams.set("chassis", parsed.chassis);
          if (parsed.engine && parsed.engine !== "all")
            url.searchParams.set("engine", parsed.engine);
          if (parsed.sort && parsed.sort !== "default") url.searchParams.set("sort", parsed.sort);
          setActualHref(url.pathname + url.search);
        }
      } else {
        const raw = window.sessionStorage.getItem("do88VehiclePreference");
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (parsed && (parsed.brand || parsed.model || parsed.chassis)) {
          const url = new URL(fallbackHref, window.location.origin);
          if (parsed.brand) url.searchParams.set("brand", parsed.brand);
          if (parsed.model) url.searchParams.set("model", parsed.model);
          if (parsed.chassis) url.searchParams.set("chassis", parsed.chassis);
          setActualHref(url.pathname + url.search);
        }
      }
    } catch {
      // ignore
    }
  }, [fallbackHref]);

  const onClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    // Respect modifier-clicks (open in new tab, etc.).
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (event.button !== 0) return;

    if (disableHistoryBack) return;

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
  };

  return (
    <Link href={actualHref} onClick={onClick} className={className}>
      {label}
    </Link>
  );
}
