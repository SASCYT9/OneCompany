import Image from "next/image";
import Link from "next/link";

import type { ShopCatalogProjectionQueryResult } from "@/lib/shopCatalogProjectionQuery.server";
import { buildShopStorefrontProductPath } from "@/lib/shopStorefrontRouting";

type Props = {
  locale: "ua" | "en";
  result: ShopCatalogProjectionQueryResult;
};

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

export default function CatalogV2Server({ locale, result }: Props) {
  const copy =
    locale === "ua"
      ? { eyebrow: "Каталог OneCompany", title: "Всі товари", empty: "Товарів не знайдено" }
      : { eyebrow: "OneCompany catalog", title: "All products", empty: "No products found" };

  return (
    <main className="min-h-screen bg-white px-4 pb-20 pt-28 text-zinc-950 dark:bg-zinc-950 dark:text-white">
      <div className="mx-auto max-w-7xl">
        <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">{copy.eyebrow}</p>
        <h1 className="mt-3 text-3xl font-light tracking-tight sm:text-5xl">{copy.title}</h1>

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
      </div>
    </main>
  );
}
