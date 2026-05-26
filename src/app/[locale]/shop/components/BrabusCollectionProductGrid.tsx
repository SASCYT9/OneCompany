"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { AddToCartButton } from "@/components/shop/AddToCartButton";
import { useShopCurrency } from "@/components/shop/CurrencyContext";
import { ShopProductImage } from "@/components/shop/ShopProductImage";
import type { SupportedLocale } from "@/lib/seo";
import type { ShopProduct } from "@/lib/shopCatalog";
import { localizeShopProductTitle, localizeShopText } from "@/lib/shopText";
import { buildShopProductPathBrabus } from "@/lib/brabusCollectionMatcher";
import { resolveBrabusFallbackImage } from "@/lib/brabusImageFallbacks";
import type { ShopViewerPricingContext } from "@/lib/shopPricingAudience";
import { useShopViewerContext } from "@/lib/useShopViewerContext";
import { resolveShopProductPricing } from "@/lib/shopPricingAudience";
import BrabusSpotlightGrid from "./BrabusSpotlightGrid";

type BrabusCollectionProductGridProps = {
  locale: SupportedLocale;
  handle: string;
  title: string;
  brand: string;
  products: ShopProduct[];
  viewerContext?: ShopViewerPricingContext;
};

function formatPrice(locale: SupportedLocale, amount: number, currency: "EUR" | "USD" | "UAH") {
  const formatter = new Intl.NumberFormat(locale === "ua" ? "uk-UA" : "en-US", {
    maximumFractionDigits: 0,
  });

  const formatted = formatter.format(amount);
  if (locale === "ua" && currency === "UAH") {
    return `${formatted} грн`;
  }
  return locale === "ua" ? `${formatted} ${currency}` : `${currency} ${formatted}`;
}

function computePricesFromUah(
  price: ShopProduct["price"],
  rates: { EUR: number; USD: number; UAH?: number } | null
) {
  const baseUah = price.uah;
  const baseEur = price.eur;
  const baseUsd = price.usd;
  const eurToUah = rates?.UAH ?? (rates?.EUR ? rates.EUR : 0);

  // EUR-origin products
  if (baseEur > 0 && baseUah === 0 && rates) {
    const usdRate = rates.USD || 1;
    return {
      eur: baseEur,
      uah: Math.round(baseEur * eurToUah),
      usd: Math.round(baseEur * usdRate),
    };
  }

  // USD-origin products
  if (baseUsd > 0 && baseUah === 0 && baseEur === 0 && rates) {
    const usdToUah = eurToUah / (rates.USD || 1);
    return {
      usd: baseUsd,
      uah: Math.round(baseUsd * usdToUah),
      eur: Math.round(baseUsd / (rates.USD || 1)),
    };
  }

  // UAH-origin products
  if (rates && baseUah > 0) {
    return {
      uah: baseUah,
      eur: Math.round(baseUah / eurToUah),
      usd: Math.round((baseUah / eurToUah) * (rates.USD || 1)),
    };
  }

  return {
    uah: baseUah,
    eur: price.eur,
    usd: price.usd,
  };
}

export default function BrabusCollectionProductGrid({
  locale,
  handle,
  title,
  brand,
  products,
  viewerContext: ssrViewerContext,
}: BrabusCollectionProductGridProps) {
  const viewerContext = useShopViewerContext(ssrViewerContext);
  const isUa = locale === "ua";
  const { currency, rates } = useShopCurrency();

  return (
    <section
      className="urban-product-grid"
      style={
        {
          "--upg-padding-top": `96px`,
          "--upg-padding-bottom": `96px`,
          "--upg-mobile-cols": 1,
          "--upg-desktop-cols": 4,
          "--accent": "#ff0000",
        } as CSSProperties
      }
    >
      <div className="urban-product-grid__inner max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="urban-product-grid__head">
          <div>
            <p className="urban-product-grid__eyebrow" style={{ color: "var(--accent)" }}>
              {brand || "Brabus Tuning"}
            </p>
            <h2 className="urban-product-grid__title">
              {isUa ? `Товари для ${title}` : `${title} Products`}
            </h2>
            <p className="urban-product-grid__sub">
              {products.length > 0
                ? isUa
                  ? `Оригінальні тюнінг-компоненти Brabus для колекції ${title}.`
                  : `Original Brabus tuning components mapped to the ${title} collection.`
                : isUa
                  ? "Каталог товарів наразі оновлюється."
                  : "This catalog is currently being updated."}
            </p>
          </div>
          <Link
            href={`/${locale}/shop/brabus/collections`}
            className="urban-product-grid__all-link hover:text-(--accent)"
          >
            {isUa ? "Усі колекції Brabus" : "All Brabus collections"}
          </Link>
        </div>

        {products.length > 0 ? (
          <BrabusSpotlightGrid className="urban-product-grid__cards">
            {products.map((product) => {
              const pricing = viewerContext
                ? resolveShopProductPricing(product, viewerContext)
                : {
                    effectivePrice: product.price,
                    effectiveCompareAt: product.compareAt,
                    audience: "b2c",
                    b2bVisible: false,
                  };

              const isB2B = pricing.audience === "b2b" && (pricing as any).b2bVisible;

              const computed = computePricesFromUah(
                pricing.effectivePrice,
                rates && { EUR: rates.EUR, USD: rates.USD, UAH: rates.UAH }
              );

              const computedCompare = pricing.effectiveCompareAt
                ? computePricesFromUah(
                    pricing.effectiveCompareAt,
                    rates && { EUR: rates.EUR, USD: rates.USD, UAH: rates.UAH }
                  )
                : null;
              const productTitle = localizeShopProductTitle(locale, product);
              const productCollection = localizeShopText(locale, product.collection);
              const productFallbackImage = resolveBrabusFallbackImage(product);

              return (
                <article
                  key={product.slug}
                  className="group relative bg-[#0e0e0e] overflow-hidden flex flex-col transition-all duration-500 border border-zinc-900 hover:border-zinc-700 hover:shadow-[0_0_32px_rgba(194,157,89,0.08)] rounded-2xl"
                >
                  <Link
                    href={buildShopProductPathBrabus(locale, product)}
                    className="flex flex-col grow"
                    aria-label={productTitle}
                  >
                    {/* Image — floating white product card on obsidian field */}
                    <div className="relative aspect-4/3 sm:aspect-[4/3] bg-[#080808] flex items-center justify-center p-3 sm:p-4 overflow-hidden">
                      {/* Floating photo mount */}
                      <div className="relative w-full h-full rounded-xl bg-white shadow-[0_8px_32px_rgba(0,0,0,0.6)] overflow-hidden">
                        <ShopProductImage
                          src={product.image || "/images/placeholders/product-fallback.svg"}
                          fallbackSrc={productFallbackImage}
                          alt={productTitle}
                          fill
                          sizes="(max-width: 768px) 100vw, 25vw"
                          className="object-contain p-4 transition-transform duration-700 group-hover:scale-[1.04]"
                        />
                      </div>
                      {/* Bronze vignette on hover */}
                      <div className="absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_50%_50%,rgba(194,157,89,0.05)_0%,transparent_70%)] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
                    </div>

                    <div className="px-4 pb-4 pt-3 sm:px-5 sm:pb-5 sm:pt-4 flex flex-col grow relative">
                      <p className="text-[8px] sm:text-[9px] uppercase tracking-[0.2em] font-bold text-[#c29d59] mb-1.5">
                        {product.brand}
                      </p>
                      <h3 className="text-[11px] sm:text-[13px] font-light leading-snug text-zinc-300 group-hover:text-white transition-colors line-clamp-3 sm:line-clamp-2 mb-3 sm:mb-4">
                        {productTitle}
                      </h3>

                      <div className="grow"></div>

                      <div className="flex flex-col gap-1 mb-5">
                        {isB2B && computedCompare ? (
                          <span className="text-[10px] text-foreground/45 dark:text-white/30 line-through tracking-wider">
                            {currency === "USD" && formatPrice(locale, computedCompare.usd, "USD")}
                            {currency === "EUR" && formatPrice(locale, computedCompare.eur, "EUR")}
                            {currency === "UAH" && formatPrice(locale, computedCompare.uah, "UAH")}
                          </span>
                        ) : null}

                        {computed.eur === 0 ? (
                          <span className="text-[9px] sm:text-[10px] tracking-wider uppercase font-medium text-zinc-500">
                            {isUa ? "Ціна за запитом" : "Price on Request"}
                          </span>
                        ) : (
                          <span className="text-[11px] sm:text-xs font-light text-[#f1d8a5] tracking-wider sm:tracking-widest">
                            {currency === "USD" && formatPrice(locale, computed.usd, "USD")}
                            {currency === "EUR" && formatPrice(locale, computed.eur, "EUR")}
                            {currency === "UAH" && formatPrice(locale, computed.uah, "UAH")}
                          </span>
                        )}
                      </div>

                      <div className="mt-auto flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-[9px] sm:text-[10px] uppercase tracking-[0.15em] text-[#c29d59] font-medium transition-transform duration-300 group-hover:translate-x-1">
                          <span>{isUa ? "Деталі" : "Details"}</span>
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="w-2.5 h-2.5"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M5 12h14" />
                            <path d="m12 5 7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    </div>
                    {/* Bronze top accent line */}
                    <div className="absolute top-0 left-[10%] right-[10%] h-px bg-gradient-to-r from-transparent via-[#c29d59]/70 to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-500 rounded-full" />
                  </Link>
                </article>
              );
            })}
          </BrabusSpotlightGrid>
        ) : (
          <div className="py-24 text-center border border-zinc-800 bg-[#0a0a0a] rounded-2xl">
            <p className="text-xl text-white font-light mb-4">
              {isUa ? "Колекція незабаром у каталозі" : "Collection coming to the catalog"}
            </p>
            <p className="text-zinc-500 max-w-2xl mx-auto mb-8">
              {isUa
                ? `Ми завершуємо формування преміум-асортименту Brabus для ${title}. Залиште запит, і наш менеджер підбере тюнінг-програму під ваш автомобіль.`
                : `We are finalizing the premium Brabus assortment for ${title}. Leave a request and our team will curate a tuning program for your car.`}
            </p>
            <Link
              href={`/${locale}/#contact`}
              className="inline-flex items-center gap-2 px-8 py-3 bg-[#c29d59]/15 border border-[#c29d59]/40 text-[#f1d8a5] text-[10px] uppercase tracking-widest hover:bg-[#c29d59]/25 hover:border-[#c29d59]/70 transition-all duration-500 rounded-none font-medium"
            >
              {isUa ? "Запитати конфігурацію" : "Request configuration"}
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
