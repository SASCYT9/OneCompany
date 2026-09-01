import Image from "next/image";
import Link from "next/link";

import type {
  ShopCatalogProjectionFacetResult,
  ShopCatalogProjectionQueryInput,
  ShopCatalogProjectionQueryResult,
} from "@/lib/shopCatalogProjectionQuery.server";
import { buildShopStorefrontProductPath } from "@/lib/shopStorefrontRouting";
import CatalogV2Filters from "./CatalogV2Filters";
import { ShopCardPriceTag } from "@/components/shop/ShopCardPriceTag";
import type { ShopMoneySet } from "@/lib/shopCatalog";
import type { ShopViewerPricingContext } from "@/lib/shopPricingAudience";

type CatalogCardPrice = {
  price: ShopMoneySet;
  europePrice: ShopMoneySet | null;
  b2bPrice: ShopMoneySet | null;
  compareAt: ShopMoneySet | null;
  b2bCompareAt: ShopMoneySet | null;
  brand: string | null;
};

type Props = {
  locale: "ua" | "en";
  result: ShopCatalogProjectionQueryResult;
  facets: ShopCatalogProjectionFacetResult["facets"];
  query: ShopCatalogProjectionQueryInput;
  cardPrices: Record<string, CatalogCardPrice>;
  pricingContext: ShopViewerPricingContext;
};

function nextPageHref(locale: Props["locale"], query: Props["query"], result: Props["result"]) {
  if (!result.nextCursor) return null;
  const params = new URLSearchParams();
  const strings: Array<[string, string | null | undefined]> = [
    ["q", query.text],
    ["scope", query.scope],
    ["brand", query.brand],
    ["category", query.category],
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

export default function CatalogV2Server({
  locale,
  result,
  facets,
  query,
  cardPrices,
  pricingContext,
}: Props) {
  const copy =
    locale === "ua"
      ? {
          eyebrow: "Каталог OneCompany",
          title: "Всі товари",
          empty: "Товарів не знайдено",
          search: "Пошук",
          brand: "Бренд",
          category: "Категорія",
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
          category: "Category",
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
    <main
      data-catalog-v2="true"
      className="min-h-screen bg-white px-4 pb-20 pt-28 text-zinc-950 dark:bg-zinc-950 dark:text-white"
    >
      <div className="mx-auto max-w-7xl">
        <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">{copy.eyebrow}</p>
        <h1 className="mt-3 text-3xl font-light tracking-tight sm:text-5xl">{copy.title}</h1>

        <CatalogV2Filters locale={locale} facets={facets} query={query} copy={copy} />

        {result.items.length === 0 ? (
          <p className="mt-12 text-zinc-500">{copy.empty}</p>
        ) : (
          <div className="mt-10 grid grid-cols-1 gap-px bg-zinc-200 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 dark:bg-white/10">
            {result.items.map((item, index) => {
              const href = buildShopStorefrontProductPath(locale, {
                slug: item.slug,
                brand: item.brandLabel || item.brandKey,
              });
              const pricing = cardPrices[item.productId];
              return (
                <Link
                  key={item.productId}
                  data-catalog-product-id={item.productId}
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
                  {pricing ? (
                    <div className="mt-4">
                      <ShopCardPriceTag
                        locale={locale}
                        b2cPrice={pricing.price}
                        europePrice={pricing.europePrice}
                        b2bExplicit={pricing.b2bPrice}
                        b2bCompareAt={pricing.b2bCompareAt}
                        compareAt={pricing.compareAt}
                        brand={pricing.brand}
                        initialViewerContext={pricingContext}
                        variant="minimal"
                      />
                    </div>
                  ) : null}
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
