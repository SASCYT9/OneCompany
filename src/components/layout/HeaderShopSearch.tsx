"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { ShopSearchForm } from "@/components/shop/ShopSearchForm";

type Props = { locale: string };

/**
 * Search from any shop page (brand store, cart…): a search button next to the
 * cart opens a field; Enter takes the query to the general catalog. Hidden
 * where the page has its own always-visible field (product pages).
 */
export function HeaderShopSearch({ locale }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const isUa = locale === "ua";

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative [html[data-inline-shop-search]_&]:hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={isUa ? "Пошук товарів" : "Search products"}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-foreground/25 text-foreground/80 transition hover:border-foreground hover:text-foreground"
      >
        {open ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
      </button>
      {open ? (
        <ShopSearchForm
          ref={inputRef}
          locale={locale}
          onSearched={() => setOpen(false)}
          className="fixed inset-x-4 top-[84px] z-50 shadow-[0_22px_60px_rgba(0,0,0,0.35)] sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-[380px]"
        />
      ) : null}
    </div>
  );
}
