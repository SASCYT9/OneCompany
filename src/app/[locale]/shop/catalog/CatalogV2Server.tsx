import Image from "next/image";
import Link from "next/link";

import type {
  ShopCatalogProjectionFacetResult,
  ShopCatalogProjectionQueryInput,
  ShopCatalogProjectionQueryResult,
} from "@/lib/shopCatalogProjectionQuery.server";
import { buildShopStorefrontProductPath } from "@/lib/shopStorefrontRouting";

type Props = {
  locale: "ua" | "en";
  result: ShopCatalogProjectionQueryResult;
  facets: ShopCatalogProjectionFacetResult["facets"];
  query: ShopCatalogProjectionQueryInput;
};

type FacetName = "brand" | "make" | "model" | "generation" | "engine" | "fuel";

function CatalogSelect({
  name,
  label,
  value,
  options,
}: {
  name: FacetName;
  label: string;
  value: string | null | undefined;
  options: ShopCatalogProjectionFacetResult["facets"][FacetName];
}) {
  const selectedMissing = value && !options.some((option) => option.key === value.toLowerCase());
  return (
    <label className="grid gap-2 text-xs uppercase tracking-[0.16em] text-zinc-500">
      {label}
      <select
        name={name}
        defaultValue={value?.toLowerCase() ?? ""}
        disabled={options.length === 0 && !value}
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

function nextPageHref(locale: Props["locale"], query: Props["query"], result: Props["result"]) {
  if (!result.nextCursor) return null;
  const params = new URLSearchParams();
  const strings: Array<[string, string | null | undefined]> = [
    ["q", query.text],
    ["scope", query.scope],
    ["brand", query.brand],
    ["make", query.make],
    ["model", query.model],
    ["generation", query.generation],
    ["engine", query.engine],
    ["fuel", query.fuel],
  ];
  for (const [key, value] of strings) if (value) params.set(key, value);
  if (query.year != null) params.set("year", String(query.year));
  params.set("afterRank", result.nextCursor.stableRank);
  params.set("afterProduct", result.nextCursor.productId);
  return `/${locale}/shop/catalog?${params.toString()}`;
}

function productPrice(
  locale: Props["locale"],
  item: ShopCatalogProjectionQueryResult["items"][number]
) {
  const amount = locale === "ua" ? item.minPriceUah : (item.minPriceEurEurope ?? item.minPriceEur);
  if (!amount || Number(amount) <= 0) return null;
  return new Intl.NumberFormat(locale === "ua" ? "uk-UA" : "en-IE", {
    style: "currency",
    currency: locale === "ua" ? "UAH" : "EUR",
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

export default function CatalogV2Server({ locale, result, facets, query }: Props) {
  const copy =
    locale === "ua"
      ? {
          eyebrow: "Каталог OneCompany",
          title: "Всі товари",
          empty: "Товарів не знайдено",
          search: "Пошук",
          brand: "Бренд",
          make: "Марка",
          model: "Модель",
          generation: "Покоління",
          year: "Рік",
          engine: "Двигун",
          fuel: "Паливо",
          apply: "Застосувати",
          reset: "Очистити",
          next: "Наступні товари",
        }
      : {
          eyebrow: "OneCompany catalog",
          title: "All products",
          empty: "No products found",
          search: "Search",
          brand: "Brand",
          make: "Make",
          model: "Model",
          generation: "Generation",
          year: "Year",
          engine: "Engine",
          fuel: "Fuel",
          apply: "Apply",
          reset: "Reset",
          next: "Next products",
        };
  const nextHref = nextPageHref(locale, query, result);

  return (
    <main className="min-h-screen bg-white px-4 pb-20 pt-28 text-zinc-950 dark:bg-zinc-950 dark:text-white">
      <div className="mx-auto max-w-7xl">
        <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">{copy.eyebrow}</p>
        <h1 className="mt-3 text-3xl font-light tracking-tight sm:text-5xl">{copy.title}</h1>

        <form
          action={`/${locale}/shop/catalog`}
          method="get"
          className="mt-10 grid gap-4 border-y border-zinc-200 py-6 md:grid-cols-2 xl:grid-cols-4 dark:border-white/10"
        >
          <label className="grid gap-2 text-xs uppercase tracking-[0.16em] text-zinc-500 md:col-span-2">
            {copy.search}
            <input
              type="search"
              name="q"
              defaultValue={query.text ?? ""}
              maxLength={256}
              className="h-11 border border-zinc-200 bg-white px-3 text-sm normal-case tracking-normal text-zinc-950 dark:border-white/10 dark:bg-zinc-950 dark:text-white"
            />
          </label>
          <CatalogSelect
            name="brand"
            label={copy.brand}
            value={query.brand}
            options={facets.brand}
          />
          <CatalogSelect name="make" label={copy.make} value={query.make} options={facets.make} />
          <CatalogSelect
            name="model"
            label={copy.model}
            value={query.model}
            options={facets.model}
          />
          <CatalogSelect
            name="generation"
            label={copy.generation}
            value={query.generation}
            options={facets.generation}
          />
          <label className="grid gap-2 text-xs uppercase tracking-[0.16em] text-zinc-500">
            {copy.year}
            <input
              type="number"
              name="year"
              min={1886}
              max={2200}
              defaultValue={query.year ?? ""}
              className="h-11 border border-zinc-200 bg-white px-3 text-sm normal-case tracking-normal text-zinc-950 dark:border-white/10 dark:bg-zinc-950 dark:text-white"
            />
          </label>
          <CatalogSelect
            name="engine"
            label={copy.engine}
            value={query.engine}
            options={facets.engine}
          />
          <CatalogSelect name="fuel" label={copy.fuel} value={query.fuel} options={facets.fuel} />
          <div className="flex items-end gap-3 xl:col-span-4">
            <button
              type="submit"
              className="h-11 bg-zinc-950 px-6 text-sm text-white dark:bg-white dark:text-zinc-950"
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

        {result.items.length === 0 ? (
          <p className="mt-12 text-zinc-500">{copy.empty}</p>
        ) : (
          <div className="mt-10 grid grid-cols-1 gap-px bg-zinc-200 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 dark:bg-white/10">
            {result.items.map((item, index) => {
              const href = buildShopStorefrontProductPath(locale, {
                slug: item.slug,
                brand: item.brandLabel || item.brandKey,
              });
              const price = productPrice(locale, item);
              return (
                <Link
                  key={item.productId}
                  href={href}
                  className="group bg-white p-5 transition-colors hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-900"
                >
                  <div className="relative aspect-square overflow-hidden bg-zinc-100 dark:bg-zinc-900">
                    {item.primaryMediaUrl ? (
                      <Image
                        src={item.primaryMediaUrl}
                        alt={item.title}
                        fill
                        priority={index < 4}
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                        className="object-contain p-5 transition-transform duration-500 group-hover:scale-[1.03]"
                      />
                    ) : null}
                  </div>
                  <p className="mt-5 text-xs uppercase tracking-[0.18em] text-zinc-500">
                    {item.brandLabel}
                  </p>
                  <h2 className="mt-2 line-clamp-2 min-h-12 text-base font-medium">{item.title}</h2>
                  {item.categoryLabel ? (
                    <p className="mt-2 text-sm text-zinc-500">{item.categoryLabel}</p>
                  ) : null}
                  {price ? <p className="mt-4 text-sm font-semibold">{price}</p> : null}
                </Link>
              );
            })}
          </div>
        )}

        {nextHref ? (
          <div className="mt-10 flex justify-center">
            <Link
              href={nextHref}
              rel="next"
              className="border border-zinc-300 px-6 py-3 text-sm transition-colors hover:bg-zinc-950 hover:text-white dark:border-white/20 dark:hover:bg-white dark:hover:text-zinc-950"
            >
              {copy.next}
            </Link>
          </div>
        ) : null}
      </div>
    </main>
  );
}
