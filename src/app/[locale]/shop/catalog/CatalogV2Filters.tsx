"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState, useTransition } from "react";

import type {
  ShopCatalogProjectionFacetResult,
  ShopCatalogProjectionQueryInput,
} from "@/lib/shopCatalogProjectionQuery.server";
import type { ShopCatalogSuggestion } from "@/lib/shopCatalogSuggestion.server";
import {
  applyShopCatalogFilterChange,
  buildShopCatalogFilterHref,
  shopCatalogFilterStateFromQuery,
  type ShopCatalogFilterName,
  type ShopCatalogFilterState,
} from "@/lib/shopCatalogFilterTransitions";

type FacetName = ShopCatalogFilterName;
type FilterState = ShopCatalogFilterState;

type Props = {
  locale: "ua" | "en";
  facets: ShopCatalogProjectionFacetResult["facets"];
  query: ShopCatalogProjectionQueryInput;
  copy: Record<
    | "search"
    | "brand"
    | "category"
    | "make"
    | "model"
    | "generation"
    | "year"
    | "engine"
    | "fuel"
    | "apply"
    | "reset",
    string
  >;
};

function FilterSelect({
  name,
  label,
  value,
  options,
  pending,
  onChange,
}: {
  name: FacetName;
  label: string;
  value: string;
  options: ShopCatalogProjectionFacetResult["facets"][FacetName];
  pending: boolean;
  onChange: (name: FacetName, value: string) => void;
}) {
  const selectedMissing = value && !options.some((option) => option.key === value.toLowerCase());
  return (
    <label className="grid gap-2 text-xs uppercase tracking-[0.16em] text-zinc-500">
      {label}
      <select
        name={name}
        value={value.toLowerCase()}
        disabled={pending || (options.length === 0 && !value)}
        onChange={(event) => onChange(name, event.target.value)}
        className="h-11 border border-zinc-200 bg-white px-3 text-sm normal-case tracking-normal text-zinc-950 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-zinc-950 dark:text-white"
      >
        <option value="">—</option>
        {selectedMissing ? <option value={value.toLowerCase()}>{value}</option> : null}
        {options.map((option) => (
          <option key={option.key} value={option.key}>
            {option.label} ({option.count})
          </option>
        ))}
      </select>
    </label>
  );
}

export default function CatalogV2Filters({ locale, facets, query, copy }: Props) {
  const router = useRouter();
  const [filters, setFilters] = useState<FilterState>(() => shopCatalogFilterStateFromQuery(query));
  const [suggestions, setSuggestions] = useState<readonly ShopCatalogSuggestion[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [pending, startTransition] = useTransition();
  const suggestionRequest = useRef<AbortController | null>(null);

  useEffect(() => setFilters(shopCatalogFilterStateFromQuery(query)), [query]);

  useEffect(() => {
    suggestionRequest.current?.abort();
    const value = filters.q.trim();
    if (value.length < 2) {
      setSuggestions([]);
      setSuggestionsOpen(false);
      setSuggestionsLoading(false);
      return;
    }
    const controller = new AbortController();
    suggestionRequest.current = controller;
    setSuggestionsLoading(true);
    const timer = window.setTimeout(async () => {
      const params = new URLSearchParams({ q: value, locale });
      if (query.scope) params.set("scope", query.scope);
      try {
        const response = await fetch(`/api/shop/catalog/suggest?${params}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const payload = (await response.json()) as { data?: ShopCatalogSuggestion[] };
        if (!response.ok) throw new Error("suggestion request failed");
        setSuggestions(payload.data ?? []);
        setSuggestionsOpen(true);
      } catch (error) {
        if (!controller.signal.aborted) {
          setSuggestions([]);
          setSuggestionsOpen(false);
        }
      } finally {
        if (!controller.signal.aborted) setSuggestionsLoading(false);
      }
    }, 180);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [filters.q, locale, query.scope]);

  const navigate = (next: FilterState) => {
    const href = buildShopCatalogFilterHref(locale, next);
    startTransition(() => router.push(href, { scroll: false }));
  };

  const updateFacet = (name: FacetName, value: string) => {
    const next = applyShopCatalogFilterChange(filters, name, value);
    setFilters(next);
    setSuggestionsOpen(false);
    navigate(next);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSuggestionsOpen(false);
    navigate(filters);
  };

  const selectSuggestion = (suggestion: ShopCatalogSuggestion) => {
    setSuggestionsOpen(false);
    if (suggestion.type === "product") {
      startTransition(() => router.push(suggestion.href));
      return;
    }
    if (suggestion.type === "brand") {
      const next = {
        ...filters,
        q: "",
        brand: suggestion.id.replace(/^brand:/, ""),
        make: "",
        model: "",
        generation: "",
        year: "",
        engine: "",
        fuel: "",
      };
      setFilters(next);
      navigate(next);
      return;
    }
    const next = {
      ...filters,
      q: "",
      make: suggestion.make,
      model: suggestion.model ?? "",
      generation: "",
      year: "",
      engine: "",
      fuel: "",
    };
    setFilters(next);
    navigate(next);
  };

  return (
    <form
      action={`/${locale}/shop/catalog`}
      method="get"
      onSubmit={submit}
      aria-busy={pending}
      className="relative mt-10 grid gap-4 border-y border-zinc-200 py-6 md:grid-cols-2 xl:grid-cols-4 dark:border-white/10"
    >
      <label className="relative grid gap-2 text-xs uppercase tracking-[0.16em] text-zinc-500 md:col-span-2">
        {copy.search}
        <input
          type="search"
          name="q"
          value={filters.q}
          maxLength={64}
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={suggestionsOpen}
          aria-controls="catalog-v2-suggestions"
          onFocus={() => suggestions.length && setSuggestionsOpen(true)}
          onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))}
          className="h-11 border border-zinc-200 bg-white px-3 text-sm normal-case tracking-normal text-zinc-950 dark:border-white/10 dark:bg-zinc-950 dark:text-white"
        />
        {suggestionsLoading ? (
          <span className="absolute bottom-3 right-3 text-xs normal-case">…</span>
        ) : null}
        {suggestionsOpen ? (
          <ul
            id="catalog-v2-suggestions"
            role="listbox"
            className="absolute left-0 right-0 top-full z-20 max-h-80 overflow-auto border border-zinc-200 bg-white normal-case tracking-normal shadow-xl dark:border-white/10 dark:bg-zinc-950"
          >
            {suggestions.map((suggestion) => (
              <li key={suggestion.id} role="option" aria-selected="false">
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectSuggestion(suggestion)}
                  className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900"
                >
                  <span>{suggestion.type === "product" ? suggestion.name : suggestion.label}</span>
                  <span className="text-xs text-zinc-500">
                    {suggestion.type === "product" ? suggestion.brand : suggestion.count}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </label>
      <FilterSelect
        name="brand"
        label={copy.brand}
        value={filters.brand}
        options={facets.brand}
        pending={pending}
        onChange={updateFacet}
      />
      <FilterSelect
        name="category"
        label={copy.category}
        value={filters.category}
        options={facets.category}
        pending={pending}
        onChange={updateFacet}
      />
      <FilterSelect
        name="make"
        label={copy.make}
        value={filters.make}
        options={facets.make}
        pending={pending}
        onChange={updateFacet}
      />
      <FilterSelect
        name="model"
        label={copy.model}
        value={filters.model}
        options={facets.model}
        pending={pending}
        onChange={updateFacet}
      />
      <FilterSelect
        name="generation"
        label={copy.generation}
        value={filters.generation}
        options={facets.generation}
        pending={pending}
        onChange={updateFacet}
      />
      <label className="grid gap-2 text-xs uppercase tracking-[0.16em] text-zinc-500">
        {copy.year}
        <input
          type="number"
          name="year"
          min={1886}
          max={2200}
          value={filters.year}
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              year: event.target.value,
              engine: "",
              fuel: "",
            }))
          }
          className="h-11 border border-zinc-200 bg-white px-3 text-sm normal-case tracking-normal text-zinc-950 dark:border-white/10 dark:bg-zinc-950 dark:text-white"
        />
      </label>
      <FilterSelect
        name="engine"
        label={copy.engine}
        value={filters.engine}
        options={facets.engine}
        pending={pending}
        onChange={updateFacet}
      />
      <FilterSelect
        name="fuel"
        label={copy.fuel}
        value={filters.fuel}
        options={facets.fuel}
        pending={pending}
        onChange={updateFacet}
      />
      <div className="flex items-end gap-3 xl:col-span-4">
        <button
          type="submit"
          disabled={pending}
          className="h-11 bg-zinc-950 px-6 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-zinc-950"
        >
          {copy.apply}
        </button>
        <Link
          href={`/${locale}/shop/catalog`}
          className="grid h-11 place-items-center border border-zinc-200 px-6 text-sm dark:border-white/10"
        >
          {copy.reset}
        </Link>
      </div>
    </form>
  );
}
