"use client";

import { forwardRef, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  locale: string;
  className?: string;
  /** Called after a search is sent (the header closes its panel). */
  onSearched?: () => void;
};

/** Search field that takes the query to the general catalog (Enter or «Знайти»). */
export const ShopSearchForm = forwardRef<HTMLInputElement, Props>(function ShopSearchForm(
  { locale, className, onSearched },
  inputRef
) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const isUa = locale === "ua";

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        const term = query.trim();
        if (!term) return;
        setQuery("");
        onSearched?.();
        router.push(`/${locale}/shop/catalog?q=${encodeURIComponent(term)}`);
      }}
      className={cn(
        "flex min-w-0 items-center gap-2 rounded-full border border-foreground/25 bg-background p-1.5 pl-4",
        className
      )}
    >
      <Search className="h-4 w-4 shrink-0 text-foreground/50" aria-hidden="true" />
      <input
        ref={inputRef}
        type="search"
        enterKeyHint="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        aria-label={isUa ? "Пошук товарів" : "Search products"}
        placeholder={isUa ? "Бренд, SKU, авто" : "Brand, SKU, car"}
        className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm text-foreground outline-none placeholder:text-foreground/40"
      />
      <button
        type="submit"
        className="shrink-0 rounded-full bg-foreground px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-background transition hover:opacity-90"
      >
        {isUa ? "Знайти" : "Search"}
      </button>
    </form>
  );
});

/**
 * Always-visible search next to «Назад до магазину» on product pages, so the
 * customer can keep searching. While it is on the page the header's search
 * button steps aside.
 */
export function ShopInlineSearch({ locale, className }: { locale: string; className?: string }) {
  useEffect(() => {
    document.documentElement.dataset.inlineShopSearch = "1";
    return () => {
      delete document.documentElement.dataset.inlineShopSearch;
    };
  }, []);
  return <ShopSearchForm locale={locale} className={cn("w-full sm:flex-1", className)} />;
}
