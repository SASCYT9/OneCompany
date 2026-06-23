"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { SHOP_COUNTRIES, resolveShopCountry, type ShopCountry } from "@/lib/shopCountries";
import { cn } from "@/lib/utils";

function normalizeSearch(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function getShopCountryLabel(country: ShopCountry, locale: string) {
  return locale === "ua" ? country.ua : country.en;
}

function resolveSelectedCountry(value: string | null | undefined) {
  return (
    SHOP_COUNTRIES.find((country) => country.value === value) ??
    resolveShopCountry(value) ??
    SHOP_COUNTRIES[0]
  );
}

type ShopCountrySearchListProps = {
  locale: string;
  value: string;
  onChange: (value: string) => void;
  onSelect?: () => void;
  autoFocus?: boolean;
  className?: string;
  listClassName?: string;
};

export function ShopCountrySearchList({
  locale,
  value,
  onChange,
  onSelect,
  autoFocus = false,
  className,
  listClassName,
}: ShopCountrySearchListProps) {
  const isUa = locale === "ua";
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!autoFocus) return;
    const timeout = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(timeout);
  }, [autoFocus]);

  const countries = useMemo(() => {
    const normalizedQuery = normalizeSearch(query);
    if (!normalizedQuery) return SHOP_COUNTRIES;

    return SHOP_COUNTRIES.filter((country) => {
      const searchable = [
        country.code,
        country.value,
        country.en,
        country.ua,
        ...(country.aliases ?? []),
      ]
        .map(normalizeSearch)
        .join(" ");
      return searchable.includes(normalizedQuery);
    });
  }, [query]);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/35"
          strokeWidth={1.8}
        />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={isUa ? "Пошук країни" : "Search country"}
          autoComplete="off"
          className="h-10 w-full rounded-xl border border-foreground/10 bg-foreground/5 pl-9 pr-3 text-sm text-foreground outline-none transition placeholder:text-foreground/35 focus:border-primary/45 focus:bg-background/65 dark:focus:bg-black/45"
        />
      </div>

      <div
        role="listbox"
        aria-label={isUa ? "Країни" : "Countries"}
        className={cn("max-h-72 overflow-y-auto pr-1", listClassName)}
      >
        {countries.length ? (
          countries.map((country) => {
            const selected = value === country.value;
            return (
              <button
                key={country.value}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange(country.value);
                  onSelect?.();
                }}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-[13px] transition",
                  selected
                    ? "bg-foreground text-background"
                    : "text-foreground/75 hover:bg-foreground/8 hover:text-foreground"
                )}
              >
                <span className="min-w-0 truncate">{getShopCountryLabel(country, locale)}</span>
                <span className="flex shrink-0 items-center gap-2 text-[10px] uppercase tracking-[0.14em] opacity-65">
                  {country.code !== "ZZ" ? country.code : null}
                  {selected ? <Check className="h-3.5 w-3.5" strokeWidth={2} /> : null}
                </span>
              </button>
            );
          })
        ) : (
          <div className="rounded-lg px-2.5 py-3 text-sm text-foreground/50">
            {isUa ? "Країну не знайдено" : "No countries found"}
          </div>
        )}
      </div>
    </div>
  );
}

type ShopCountryComboboxProps = {
  locale: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  buttonClassName?: string;
  ariaLabel?: string;
};

export function ShopCountryCombobox({
  locale,
  value,
  onChange,
  className,
  buttonClassName,
  ariaLabel,
}: ShopCountryComboboxProps) {
  const isUa = locale === "ua";
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selectedCountry = resolveSelectedCountry(value);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel ?? (isUa ? "Країна" : "Country")}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "flex min-h-[58px] w-full items-center justify-between gap-3 rounded-2xl border border-foreground/10 bg-card/70 px-5 py-4 text-left text-foreground backdrop-blur-md transition-all hover:bg-card/85 focus:border-primary/50 focus:bg-card/85 focus:outline-none focus:ring-1 focus:ring-primary/50 dark:bg-black/40 dark:hover:bg-black/60 dark:focus:bg-black/60",
          buttonClassName
        )}
      >
        <span className="min-w-0 truncate">{getShopCountryLabel(selectedCountry, locale)}</span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")}
          strokeWidth={1.8}
        />
      </button>

      {open ? (
        <div className="absolute left-0 right-0 z-40 mt-2 rounded-2xl border border-foreground/12 bg-card/98 p-3 text-foreground shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-[#080808]/98">
          <ShopCountrySearchList
            locale={locale}
            value={selectedCountry.value}
            onChange={onChange}
            onSelect={() => setOpen(false)}
            autoFocus
          />
        </div>
      ) : null}
    </div>
  );
}
