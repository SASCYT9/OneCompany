"use client";

import {
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import Link from "next/link";
import { ChevronDown, Loader2, Search, X } from "lucide-react";

import { SHOP_STOCK_CATEGORY_GROUPS } from "@/lib/shopStockTaxonomy";

type CatalogItem = {
  id: string;
  name: string;
  brand: string;
  partNumber: string;
  thumbnail: string | null;
  priceUah?: number;
  href: string | null;
};

type SearchResponse = {
  data?: CatalogItem[];
  meta?: { totalItems?: number };
  filters?: { brands?: string[] };
  error?: string;
};

type FitmentResponse = {
  data?: string[];
};

type ShopCatalogQuickSearchProps = {
  locale: string;
  className?: string;
};

type VehicleScope = "auto" | "moto";
type StockFilter = "all" | "inStock" | "preOrder";

const fieldClass =
  "h-11 w-full min-w-0 appearance-none rounded-[8px] border border-foreground/15 bg-foreground/[0.025] px-3 pr-9 text-xs font-light text-foreground outline-hidden transition hover:border-foreground/30 focus:border-foreground/45 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/15 dark:bg-white/[0.04]";

const formatPrice = (price: number | null, locale: string) => {
  if (price === null || !Number.isFinite(price) || price <= 0) return null;
  return new Intl.NumberFormat(locale === "ua" ? "uk-UA" : "en-US", {
    maximumFractionDigits: 0,
  }).format(price);
};

function SelectField({
  label,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-[9px] font-semibold uppercase tracking-[0.14em] text-foreground/48">
        {label}
      </span>
      <span className="relative block">
        <select {...props} className={fieldClass}>
          {children}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/42"
          aria-hidden="true"
        />
      </span>
    </label>
  );
}

export function ShopCatalogQuickSearch({ locale, className }: ShopCatalogQuickSearchProps) {
  const isUa = locale === "ua";
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<VehicleScope>("auto");
  const [category, setCategory] = useState("");
  const [brand, setBrand] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [chassis, setChassis] = useState("");
  const [stock, setStock] = useState<StockFilter>("all");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  const [brands, setBrands] = useState<string[]>([]);
  const [makes, setMakes] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [chassisCodes, setChassisCodes] = useState<string[]>([]);
  const [facetsLoading, setFacetsLoading] = useState(true);
  const [makesLoading, setMakesLoading] = useState(true);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [chassisLoading, setChassisLoading] = useState(false);

  const [items, setItems] = useState<CatalogItem[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setBrand("");
    setMake("");
    setModel("");
    setChassis("");
    setModels([]);
    setChassisCodes([]);
    setBrands([]);
    setMakes([]);
    setFacetsLoading(true);
    setMakesLoading(true);

    fetch(`/api/shop/stock/search?locale=${locale}&scope=${scope}&page=1&limit=1`, {
      signal: controller.signal,
    })
      .then((response) => response.json())
      .then((payload: SearchResponse) => setBrands(payload.filters?.brands ?? []))
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setFacetsLoading(false);
      });

    fetch(`/api/shop/stock/fitment?scope=${scope}`, { signal: controller.signal })
      .then((response) => response.json())
      .then((payload: FitmentResponse) => setMakes(payload.data ?? []))
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setMakesLoading(false);
      });

    return () => controller.abort();
  }, [locale, scope]);

  useEffect(() => {
    if (!make) {
      setModels([]);
      setModel("");
      setChassisCodes([]);
      setChassis("");
      return;
    }

    const controller = new AbortController();
    setModelsLoading(true);
    setModel("");
    setChassisCodes([]);
    setChassis("");
    fetch(`/api/shop/stock/fitment?scope=${scope}&make=${encodeURIComponent(make)}`, {
      signal: controller.signal,
    })
      .then((response) => response.json())
      .then((payload: FitmentResponse) => setModels(payload.data ?? []))
      .catch(() => setModels([]))
      .finally(() => {
        if (!controller.signal.aborted) setModelsLoading(false);
      });
    return () => controller.abort();
  }, [make, scope]);

  useEffect(() => {
    if (!make || !model) {
      setChassisCodes([]);
      setChassis("");
      return;
    }

    const controller = new AbortController();
    setChassisLoading(true);
    setChassis("");
    fetch(
      `/api/shop/stock/fitment?scope=${scope}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`,
      { signal: controller.signal }
    )
      .then((response) => response.json())
      .then((payload: FitmentResponse) => setChassisCodes(payload.data ?? []))
      .catch(() => setChassisCodes([]))
      .finally(() => {
        if (!controller.signal.aborted) setChassisLoading(false);
      });
    return () => controller.abort();
  }, [make, model, scope]);

  const resetFilters = () => {
    setQuery("");
    setCategory("");
    setBrand("");
    setMake("");
    setModel("");
    setChassis("");
    setStock("all");
    setMinPrice("");
    setMaxPrice("");
    setItems([]);
    setTotal(null);
    setHasSearched(false);
    setError("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setHasSearched(true);

    const params = new URLSearchParams({ locale, scope, page: "1", limit: "6" });
    if (query.trim()) params.set("q", query.trim());
    if (category) params.set("category", category);
    if (brand) params.set("brand", brand);
    if (make) params.set("make", make);
    if (model) params.set("model", model);
    if (chassis) params.set("chassis", chassis);
    if (make || model || chassis) {
      // The API activates canonical matching only after the V2 catalog reaches
      // its coverage gate; until then it safely keeps deterministic legacy
      // matching without relaxing the selected vehicle.
      params.set("strict", "1");
      params.set("allowFallback", "0");
    }
    if (stock !== "all") params.set("stock", stock);
    if (minPrice.trim()) params.set("minPrice", minPrice.trim().replace(",", "."));
    if (maxPrice.trim()) params.set("maxPrice", maxPrice.trim().replace(",", "."));

    try {
      const response = await fetch(`/api/shop/stock/search?${params.toString()}`);
      const payload = (await response.json()) as SearchResponse;
      if (!response.ok) throw new Error(payload.error || "Catalog search failed");
      setItems(Array.isArray(payload.data) ? payload.data : []);
      setTotal(payload.meta?.totalItems ?? 0);
      if (payload.filters?.brands?.length) setBrands(payload.filters.brands);
    } catch {
      setItems([]);
      setTotal(null);
      setError(
        isUa
          ? "Не вдалося завантажити товари. Спробуйте ще раз."
          : "Could not load products. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <section
      className={className}
      aria-label={isUa ? "Пошук і фільтри каталогу" : "Catalog search and filters"}
    >
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-foreground/12 bg-card/92 p-3 shadow-[0_18px_45px_rgba(0,0,0,0.08)] backdrop-blur-xl dark:border-white/12 dark:bg-[#0b0b0d]/92 dark:shadow-[0_18px_45px_rgba(0,0,0,0.36)] sm:p-4"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/75">
              {isUa ? "Фільтри каталогу" : "Catalog filters"}
            </p>
            <p className="mt-1 text-[11px] font-light text-foreground/45">
              {isUa
                ? "Знайдіть товар без переходу на іншу сторінку"
                : "Find products without leaving this page"}
            </p>
          </div>
          <button
            type="button"
            onClick={resetFilters}
            className="shrink-0 text-[9px] font-semibold uppercase tracking-[0.14em] text-primary transition hover:brightness-75"
          >
            {isUa ? "Скинути" : "Reset"}
          </button>
        </div>

        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_132px]">
          <label className="flex h-12 min-w-0 items-center rounded-[8px] border border-foreground/15 bg-foreground/[0.025] px-3 transition focus-within:border-foreground/40 dark:border-white/16 dark:bg-white/[0.04]">
            <Search className="h-4 w-4 shrink-0 text-foreground/45" aria-hidden="true" />
            <input
              type="search"
              inputMode="search"
              autoComplete="off"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={isUa ? "Бренд, SKU, деталь або авто" : "Brand, SKU, product, or vehicle"}
              className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm font-light text-foreground outline-hidden placeholder:text-foreground/38"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="text-foreground/45 transition hover:text-foreground"
                aria-label={isUa ? "Очистити пошук" : "Clear search"}
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </label>
          <button
            type="submit"
            disabled={loading}
            className="flex h-12 items-center justify-center gap-2 rounded-[8px] border border-primary bg-primary px-5 text-[10px] font-semibold uppercase tracking-[0.15em] text-primary-foreground shadow-[0_10px_22px_rgba(213,0,28,0.2)] transition hover:-translate-y-px hover:brightness-105 disabled:cursor-wait disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : isUa ? "Знайти" : "Search"}
          </button>
        </div>

        <div className="mt-3 grid h-11 grid-cols-2 gap-1 rounded-[9px] border border-foreground/15 bg-foreground/[0.025] p-1 sm:max-w-[300px] dark:border-white/15 dark:bg-white/[0.04]">
          {(["auto", "moto"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={scope === value}
              onClick={() => setScope(value)}
              className={`rounded-[7px] text-[10px] font-semibold uppercase tracking-[0.15em] transition ${
                scope === value
                  ? "bg-foreground text-background"
                  : "text-foreground/55 hover:bg-foreground/[0.06] hover:text-foreground"
              }`}
            >
              {value === "auto" ? (isUa ? "Авто" : "Auto") : isUa ? "Мото" : "Moto"}
            </button>
          ))}
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SelectField
            label={isUa ? "Категорія" : "Category"}
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="">{isUa ? "Усі категорії" : "All categories"}</option>
            {SHOP_STOCK_CATEGORY_GROUPS.map((group) => (
              <option key={group.id} value={group.id}>
                {isUa ? group.ua : group.en}
              </option>
            ))}
          </SelectField>

          <SelectField
            label={isUa ? "Бренд" : "Brand"}
            value={brand}
            disabled={facetsLoading}
            onChange={(event) => setBrand(event.target.value)}
          >
            <option value="">
              {facetsLoading
                ? isUa
                  ? "Завантаження…"
                  : "Loading…"
                : isUa
                  ? "Усі бренди"
                  : "All brands"}
            </option>
            {brands.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </SelectField>

          <SelectField
            label={isUa ? "Наявність" : "Availability"}
            value={stock}
            onChange={(event) => setStock(event.target.value as StockFilter)}
          >
            <option value="all">{isUa ? "Усі товари" : "All products"}</option>
            <option value="inStock">{isUa ? "В наявності" : "In stock"}</option>
            <option value="preOrder">{isUa ? "Під замовлення" : "Pre-order"}</option>
          </SelectField>

          <div className="grid grid-cols-2 gap-2">
            <label className="block min-w-0">
              <span className="mb-1.5 block text-[9px] font-semibold uppercase tracking-[0.14em] text-foreground/48">
                {isUa ? "Ціна від" : "Price from"}
              </span>
              <input
                value={minPrice}
                onChange={(event) => setMinPrice(event.target.value.replace(/[^\d.,]/g, ""))}
                inputMode="decimal"
                placeholder="0"
                className={fieldClass.replace("pr-9", "pr-3")}
              />
            </label>
            <label className="block min-w-0">
              <span className="mb-1.5 block text-[9px] font-semibold uppercase tracking-[0.14em] text-foreground/48">
                {isUa ? "Ціна до" : "Price to"}
              </span>
              <input
                value={maxPrice}
                onChange={(event) => setMaxPrice(event.target.value.replace(/[^\d.,]/g, ""))}
                inputMode="decimal"
                placeholder="∞"
                className={fieldClass.replace("pr-9", "pr-3")}
              />
            </label>
          </div>
        </div>

        <div className="mt-3 border-t border-foreground/10 pt-3">
          <p className="mb-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-foreground/48">
            {scope === "auto"
              ? isUa
                ? "Сумісність з авто"
                : "Car fitment"
              : isUa
                ? "Сумісність з мото"
                : "Moto fitment"}
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            <SelectField
              label={isUa ? "Марка" : "Make"}
              value={make}
              disabled={makesLoading}
              onChange={(event) => setMake(event.target.value)}
            >
              <option value="">
                {makesLoading
                  ? isUa
                    ? "Завантаження…"
                    : "Loading…"
                  : isUa
                    ? "Оберіть марку"
                    : "Select make"}
              </option>
              {makes.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </SelectField>
            <SelectField
              label={isUa ? "Модель" : "Model"}
              value={model}
              disabled={!make || modelsLoading}
              onChange={(event) => setModel(event.target.value)}
            >
              <option value="">
                {modelsLoading
                  ? isUa
                    ? "Завантаження…"
                    : "Loading…"
                  : isUa
                    ? "Оберіть модель"
                    : "Select model"}
              </option>
              {models.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </SelectField>
            <SelectField
              label={isUa ? "Кузов / шасі" : "Chassis"}
              value={chassis}
              disabled={!model || chassisLoading}
              onChange={(event) => setChassis(event.target.value)}
            >
              <option value="">
                {chassisLoading
                  ? isUa
                    ? "Завантаження…"
                    : "Loading…"
                  : isUa
                    ? "Оберіть кузов"
                    : "Select chassis"}
              </option>
              {chassisCodes.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </SelectField>
          </div>
        </div>
      </form>

      {hasSearched ? (
        <div className="mt-3 rounded-2xl border border-foreground/10 bg-card/60 p-3 dark:border-white/10 dark:bg-white/[0.025] sm:p-4">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/55">
            {loading
              ? isUa
                ? "Шукаємо товари"
                : "Searching products"
              : total !== null
                ? `${total.toLocaleString(isUa ? "uk-UA" : "en-US")} ${isUa ? "товарів знайдено" : "products found"}`
                : isUa
                  ? "Результати пошуку"
                  : "Search results"}
          </p>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {!loading && !error && items.length === 0 ? (
            <p className="py-4 text-sm font-light text-foreground/55">
              {isUa
                ? "За цими умовами товарів не знайдено."
                : "No products found for these filters."}
            </p>
          ) : null}
          {items.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => {
                const price = formatPrice(item.priceUah ?? null, locale);
                return (
                  <Link
                    key={item.id}
                    href={item.href || `/${locale}/shop/catalog`}
                    className="group grid min-h-24 grid-cols-[68px_minmax(0,1fr)] gap-3 rounded-[10px] border border-foreground/10 bg-foreground/[0.025] p-2.5 transition hover:border-foreground/28 hover:bg-foreground/[0.05] dark:border-white/10 dark:bg-white/[0.035] dark:hover:border-white/28 dark:hover:bg-white/[0.07]"
                  >
                    <div className="flex h-[68px] w-[68px] items-center justify-center rounded-[8px] bg-background/70 p-1 dark:bg-black/25">
                      {item.thumbnail ? (
                        // Product feeds contain multiple external image hosts; keep this unoptimized preview resilient.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.thumbnail} alt="" className="h-full w-full object-contain" />
                      ) : (
                        <Search className="h-4 w-4 text-foreground/25" aria-hidden="true" />
                      )}
                    </div>
                    <span className="min-w-0">
                      <span className="block truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/55">
                        {item.brand}
                      </span>
                      <span className="mt-1 line-clamp-2 block text-xs font-medium leading-snug text-foreground group-hover:underline">
                        {item.name}
                      </span>
                      <span className="mt-1 block font-mono text-[10px] text-foreground/45">
                        {price ? `${price} грн` : item.partNumber}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
