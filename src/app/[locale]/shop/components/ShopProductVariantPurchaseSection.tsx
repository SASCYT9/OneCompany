"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import Link from "next/link";
import { AddToCartButton } from "@/components/shop/AddToCartButton";
import { ShopB2BPricingBand } from "@/components/shop/ShopB2BPricingBand";
import { ShopInlinePriceText } from "@/components/shop/ShopInlinePriceText";
import { ShopPrimaryPriceBox } from "@/components/shop/ShopPrimaryPriceBox";
import { ShopBackToCatalogLink } from "@/components/shop/ShopBackToCatalogLink";
import { ProductAiOpinionPanel } from "@/components/shop/ProductAiOpinionPanel";
import type {
  ShopProduct,
  ShopProductOptionSummary,
  ShopProductVariantSummary,
} from "@/lib/shopCatalog";
import {
  resolveShopProductPricing,
  type ShopViewerPricingContext,
} from "@/lib/shopPricingAudience";
import { useShopViewerContext } from "@/lib/useShopViewerContext";
import { useShopCurrency } from "@/components/shop/CurrencyContext";
import type { SupportedLocale } from "@/lib/seo";

type Props = {
  product: ShopProduct;
  ssrViewerContext: ShopViewerPricingContext;
  locale: SupportedLocale;
  isUa: boolean;
  productTitle: string;
  continueShoppingHref: string;
  children?: ReactNode;
};

type VariantAxis = {
  index: 0 | 1 | 2;
  name: string;
  values: string[];
};

const FALLBACK_AXIS_NAMES = ["Configuration", "Design", "Option"];

const UA_OPTION_NAMES: Record<string, string> = {
  Finish: "Оздоблення",
  Version: "Версія",
  Flange: "Фланець",
  "Turbo configuration": "Конфігурація турбін",
  Configuration: "Конфігурація",
  Design: "Виконання",
  Option: "Опція",
};

const EN_OPTION_VALUES: Array<[RegExp, string]> = [
  [/^глянцев(?:ий|а|е)$/i, "Gloss"],
  [/^матов(?:ий|а|е)$/i, "Matte"],
  [/^до рестайлінгу$/i, "Pre-facelift"],
  [/^рестайлінг 2021\+$/i, "Facelift 2021+"],
  [/^рестайлінг$/i, "Facelift"],
  [/^рейстайлінг$/i, "Facelift"],
  [/^стокова турбіна$/i, "Stock turbo"],
  [/^покращені турбіни\s*\(вхід 3"\)$/i, 'Upgraded turbos (3" inlet)'],
];

function localizeOptionName(name: string, isUa: boolean) {
  const normalized = name.trim();
  return isUa ? (UA_OPTION_NAMES[normalized] ?? normalized) : normalized;
}

function localizeOptionValue(value: string, isUa: boolean) {
  if (isUa) return value;
  return EN_OPTION_VALUES.find(([pattern]) => pattern.test(value))?.[1] ?? value;
}

function optionValuesOf(variant: ShopProductVariantSummary | null | undefined) {
  return [
    variant?.optionValues?.[0] ?? "",
    variant?.optionValues?.[1] ?? "",
    variant?.optionValues?.[2] ?? "",
  ];
}

function variantMatches(variant: ShopProductVariantSummary, selected: string[]) {
  const values = optionValuesOf(variant);
  return selected.every((value, index) => !value || values[index] === value);
}

function buildOptionAxes(
  productOptions: ShopProductOptionSummary[] | undefined,
  variants: ShopProductVariantSummary[]
): VariantAxis[] {
  const axes: VariantAxis[] = [];

  for (let index = 0; index < 3; index += 1) {
    const variantValues = Array.from(
      new Set(
        variants
          .map((variant) => variant.optionValues?.[index])
          .filter((value): value is string => Boolean(value?.trim()))
      )
    );
    if (variantValues.length < 2) continue;

    const declared = productOptions?.find((option) => option.position === index + 1);
    const declaredValues = (declared?.values ?? []).filter((value) =>
      variantValues.includes(value)
    );
    const values = [
      ...declaredValues,
      ...variantValues.filter((value) => !declaredValues.includes(value)),
    ];

    axes.push({
      index: index as 0 | 1 | 2,
      name: declared?.name?.trim() || FALLBACK_AXIS_NAMES[index],
      values,
    });
  }

  return axes;
}

function computeCrossPrices(
  priceObj: { eur: number; usd: number; uah: number },
  rates: { EUR: number; USD: number; UAH: number } | null | undefined
) {
  let computedUah = priceObj.uah || 0;
  let computedEur = priceObj.eur || 0;
  let computedUsd = priceObj.usd || 0;
  const hasValid = (value?: number) => typeof value === "number" && value > 0;

  if (hasValid(priceObj.uah) && rates) {
    if (!hasValid(computedEur)) computedEur = (priceObj.uah / rates.UAH) * rates.EUR;
    if (!hasValid(computedUsd)) computedUsd = (priceObj.uah / rates.UAH) * rates.USD;
  } else if (hasValid(priceObj.eur) && rates) {
    if (!hasValid(computedUah)) computedUah = (priceObj.eur / rates.EUR) * rates.UAH;
    if (!hasValid(computedUsd)) computedUsd = (priceObj.eur / rates.EUR) * rates.USD;
  } else if (hasValid(priceObj.usd) && rates) {
    if (!hasValid(computedUah)) computedUah = (priceObj.usd / rates.USD) * rates.UAH;
    if (!hasValid(computedEur)) computedEur = (priceObj.usd / rates.USD) * rates.EUR;
  }

  return { uah: computedUah, eur: computedEur, usd: computedUsd };
}

export function ShopProductVariantPurchaseSection({
  product,
  ssrViewerContext,
  locale,
  isUa,
  productTitle,
  continueShoppingHref,
  children,
}: Props) {
  const viewerContext = useShopViewerContext(ssrViewerContext);
  const { rates } = useShopCurrency();
  const variants = product.variants ?? [];
  const optionAxes = useMemo(
    () => buildOptionAxes(product.options, variants),
    [product.options, variants]
  );
  const initialVariant = useMemo(
    () => variants.find((variant) => variant.isDefault) ?? variants[0] ?? null,
    [variants]
  );
  const [selected, setSelected] = useState<string[]>(() => optionValuesOf(initialVariant));

  const currentVariant = useMemo(() => {
    if (!variants.length) return null;
    return variants.find((variant) => variantMatches(variant, selected)) ?? initialVariant;
  }, [initialVariant, selected, variants]);

  const currentProduct = useMemo<ShopProduct>(() => {
    if (!currentVariant) return product;
    return {
      ...product,
      price: currentVariant.price,
      compareAt: currentVariant.compareAt,
      b2bPrice: currentVariant.b2bPrice,
      b2bCompareAt: currentVariant.b2bCompareAt,
      europePrice: currentVariant.europePrice ?? product.europePrice,
    };
  }, [currentVariant, product]);
  const pricing = resolveShopProductPricing(currentProduct, viewerContext);

  const handleSelect = (axisIndex: number, value: string) => {
    setSelected((previous) => {
      const next = [...previous];
      next[axisIndex] = value;
      const compatible =
        variants.find((variant) => variantMatches(variant, next)) ??
        variants.find((variant) => variant.optionValues?.[axisIndex] === value);
      return compatible ? optionValuesOf(compatible) : next;
    });
  };

  const selectedVariantLabel = currentVariant
    ? currentVariant.optionValues
        ?.filter(Boolean)
        .map((value) => localizeOptionValue(value, isUa))
        .join(" / ") || localizeOptionValue(currentVariant.title?.trim() ?? "", isUa)
    : "";
  const compareAt = pricing.effectiveCompareAt
    ? computeCrossPrices(pricing.effectiveCompareAt, rates)
    : null;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-foreground/12 bg-card p-5 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.08)] dark:bg-black/40 dark:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.5)]">
        <div className="flex flex-col">
          <ShopPrimaryPriceBox locale={locale} isUa={isUa} price={pricing.effectivePrice} />
          {compareAt ? (
            <div className="mt-1 flex items-center gap-2">
              <span className="text-xs uppercase tracking-[0.2em] text-foreground/60 dark:text-foreground/40">
                {isUa ? "Стара ціна" : "Was"}
              </span>
              <ShopInlinePriceText
                locale={locale}
                price={compareAt}
                className="text-sm text-red-400/80 line-through"
                requestLabel={isUa ? "Ціна за запитом" : "Price on request"}
              />
            </div>
          ) : null}
        </div>

        <ShopB2BPricingBand pricing={pricing} locale={locale} />

        {optionAxes.length > 0 ? (
          <div
            className="mt-5 space-y-4 border-t border-foreground/10 pt-5"
            aria-label={isUa ? "Вибір варіанта" : "Variant selection"}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-foreground/55 dark:text-foreground/40">
              {isUa ? "Виберіть варіант" : "Choose your variant"}
            </p>
            {optionAxes.map((axis) => (
              <fieldset key={axis.index} className="space-y-2">
                <legend className="text-xs uppercase tracking-[0.18em] text-foreground/70 dark:text-foreground/55">
                  {localizeOptionName(axis.name, isUa)}
                </legend>
                <div className="flex flex-wrap gap-2">
                  {axis.values.map((value) => {
                    const active = selected[axis.index] === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={active}
                        className={`rounded-xl border px-3.5 py-2 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                          active
                            ? "border-primary bg-primary text-primary-foreground shadow-sm"
                            : "border-foreground/18 bg-foreground/[0.03] text-foreground/80 hover:border-foreground/35 hover:text-foreground"
                        }`}
                        onClick={() => handleSelect(axis.index, value)}
                      >
                        {localizeOptionValue(value, isUa)}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            ))}
            {selectedVariantLabel ? (
              <p className="text-xs text-foreground/55 dark:text-foreground/40">
                {isUa ? "Обрано:" : "Selected:"} {selectedVariantLabel}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {children}

      <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:flex-wrap">
        <AddToCartButton
          slug={product.slug}
          locale={locale}
          variantId={currentVariant?.id ?? null}
          productName={productTitle}
          variant="minimal"
          className="inline-flex min-h-[54px] min-w-[220px] items-center justify-center rounded-full border border-primary bg-primary px-10 py-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary-foreground shadow-[0_18px_40px_-24px_rgba(213,0,28,0.45)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-primary/90 disabled:translate-y-0 disabled:opacity-50 dark:shadow-[0_18px_40px_-24px_rgba(194,157,89,0.55)] dark:hover:shadow-[0_22px_46px_-24px_rgba(194,157,89,0.65)]"
        />
        <Link
          href={`/${locale}/contact`}
          className="group relative overflow-hidden rounded-full border border-foreground/12 bg-foreground/[0.03] px-8 py-3.5 text-[11px] font-medium uppercase tracking-[0.2em] text-foreground/95 transition-all duration-500 hover:border-foreground/30 hover:bg-foreground/12 hover:text-foreground dark:text-foreground/80"
        >
          {pricing.requestQuote
            ? isUa
              ? "Запитати B2B ціну"
              : "Request B2B pricing"
            : isUa
              ? "Запит по товару"
              : "Request product"}
        </Link>
        <ShopBackToCatalogLink
          fallbackHref={continueShoppingHref}
          label={isUa ? "Продовжити покупки" : "Continue shopping"}
          disableHistoryBack
          className="rounded-full border border-transparent bg-transparent px-6 py-3.5 text-[10px] font-light uppercase tracking-[0.15em] text-foreground/60 transition-all duration-500 hover:text-foreground/95 dark:text-foreground/40 dark:hover:text-foreground/80"
        />
      </div>

      <ProductAiOpinionPanel locale={locale} product={product} shape="pill" />

      {currentVariant?.sku || product.sku ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-foreground/15 bg-foreground/5 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-foreground/65 dark:text-foreground/45">
            {isUa ? "Артикул" : "SKU"}
          </span>
          <span className="min-w-0 break-all rounded-full border border-foreground/20 bg-foreground/5 px-3 py-1 font-mono text-xs tracking-[0.04em] text-foreground/85">
            {currentVariant?.sku ?? product.sku}
          </span>
        </div>
      ) : null}
    </div>
  );
}
