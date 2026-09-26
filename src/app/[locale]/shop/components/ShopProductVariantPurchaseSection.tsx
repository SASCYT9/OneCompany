"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AddToCartButton } from "@/components/shop/AddToCartButton";
import { ShopB2BPricingBand } from "@/components/shop/ShopB2BPricingBand";
import { ShopInlinePriceText } from "@/components/shop/ShopInlinePriceText";
import { ShopPrimaryPriceBox } from "@/components/shop/ShopPrimaryPriceBox";
import { ShopBackToCatalogLink } from "@/components/shop/ShopBackToCatalogLink";
import { ProductAiOpinionPanel } from "@/components/shop/ProductAiOpinionPanel";
import { ShopProductImage } from "@/components/shop/ShopProductImage";
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
import { getShopConfirmedAvailability } from "@/lib/shopWarehouseInventory";
import { ShopAvailabilityBadge } from "@/components/shop/ShopAvailabilityBadge";
import type { SupportedLocale } from "@/lib/seo";
import { isWheelForceWheel, isWheelForceWheelSet, wheelForceSetPricing } from "@/lib/wheelforceFamily";

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
  Size: "Розмір диска",
  "Wheel size": "Розмір диска",
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
  const variants = useMemo(() => product.variants ?? [], [product.variants]);
  const optionAxes = useMemo(
    () => buildOptionAxes(product.options, variants),
    [product.options, variants]
  );
  const initialVariant = useMemo(
    () => variants.find((variant) => variant.isDefault) ?? variants[0] ?? null,
    [variants]
  );
  const [selected, setSelected] = useState<string[]>(() => optionValuesOf(initialVariant));
  const [selectedAccessorySkus, setSelectedAccessorySkus] = useState<string[]>([]);

  useEffect(() => {
    const requestedSku = new URLSearchParams(window.location.search).get("variantSku")?.trim();
    if (!requestedSku) return;
    const requestedVariant = variants.find((variant) =>
      variant.sku?.toLowerCase() === requestedSku.toLowerCase()
    );
    if (requestedVariant) setSelected(optionValuesOf(requestedVariant));
  }, [variants]);

  const currentVariant = useMemo(() => {
    if (!variants.length) return null;
    return variants.find((variant) => variantMatches(variant, selected)) ?? initialVariant;
  }, [initialVariant, selected, variants]);

  const currentProduct = useMemo<ShopProduct>(() => {
    if (!currentVariant) return product;
    return {
      ...product,
      // Some catalog imports include the default variant shell without
      // duplicating product-level pricing. Preserve the product price until a
      // variant actually provides an override.
      price: currentVariant.price ?? product.price,
      compareAt: currentVariant.compareAt ?? product.compareAt,
      b2bPrice: currentVariant.b2bPrice ?? product.b2bPrice,
      b2bCompareAt: currentVariant.b2bCompareAt ?? product.b2bCompareAt,
      europePrice: currentVariant.europePrice ?? product.europePrice,
    };
  }, [currentVariant, product]);
  const pricing = resolveShopProductPricing(currentProduct, viewerContext);
  const isSingleWheelProduct = isWheelForceWheel(product);
  const isVehicleWheelSet = isWheelForceWheelSet(product);
  const isWheelSet = isSingleWheelProduct || isVehicleWheelSet;
  const displayPricing = useMemo(
    () => isSingleWheelProduct ? wheelForceSetPricing(pricing) : pricing,
    [isSingleWheelProduct, pricing]
  );

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
  const compareAt = displayPricing.effectiveCompareAt
    ? computeCrossPrices(displayPricing.effectiveCompareAt, rates)
    : null;
  const isWheelForce = product.brand.trim().toLowerCase() === "wheelforce";
  const selectedWheelSku = currentVariant?.sku?.trim() || product.sku;
  const availability = getShopConfirmedAvailability(
    selectedWheelSku,
    product.slug,
    product.storefrontDisplay
  );
  const accessoryOptions = useMemo(
    () => (product.accessoryOptions ?? []).filter(
      (option) => !option.variantSkus?.length || option.variantSkus.includes(selectedWheelSku)
    ),
    [product.accessoryOptions, selectedWheelSku]
  );
  useEffect(() => {
    const availableSkus = new Set(accessoryOptions.map((option) => option.sku));
    setSelectedAccessorySkus((current) => {
      const next = current.filter((sku) => availableSkus.has(sku));
      return next.length === current.length ? current : next;
    });
  }, [accessoryOptions]);
  const selectedAccessoryOptions = accessoryOptions.filter((option) =>
    selectedAccessorySkus.includes(option.sku)
  );
  const selectedAccessoryItems = selectedAccessoryOptions
    .map((option) => ({ slug: option.slug, quantity: option.quantity ?? 1 }));
  const configuredPrice = selectedAccessoryOptions.reduce((total, option) => {
    const addOn = resolveShopProductPricing(
      { ...product, price: option.price, europePrice: option.europePrice },
      viewerContext
    ).effectivePrice;
    const quantity = option.quantity ?? 1;
    return {
      eur: Math.round((total.eur + addOn.eur * quantity) * 100) / 100,
      usd: Math.round((total.usd + addOn.usd * quantity) * 100) / 100,
      uah: Math.round((total.uah + addOn.uah * quantity) * 100) / 100,
    };
  }, displayPricing.effectivePrice);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-foreground/12 bg-card p-3 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.08)] dark:bg-black/40 dark:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.5)] sm:p-5">
        <div className="flex flex-col">
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
            <div className="min-w-0">
              <ShopPrimaryPriceBox locale={locale} isUa={isUa} price={configuredPrice} />
              {isWheelSet || selectedAccessoryOptions.length ? (
                <p className="mt-1 text-xs text-foreground/55" aria-live="polite">
                  {isWheelSet
                    ? selectedAccessoryOptions.length
                      ? isVehicleWheelSet
                        ? isUa ? "Комплект дисків для авто і вибрані аксесуари" : "Vehicle wheel set and selected accessories"
                        : isUa ? "Комплект 4 дисків і вибрані аксесуари" : "Set of 4 wheels and selected accessories"
                      : isVehicleWheelSet
                        ? isUa ? "Комплект: 2 передні + 2 задні диски" : "Set: 2 front + 2 rear wheels"
                        : isUa ? "Комплект із 4 дисків" : "Set of 4 wheels"
                    : isUa ? "Диск і вибрані аксесуари" : "Wheel and selected accessories"}
                </p>
              ) : null}
            </div>
            <ShopAvailabilityBadge availability={availability} locale={isUa ? "ua" : "en"} />
          </div>
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

        <ShopB2BPricingBand pricing={displayPricing} locale={locale} />

        {isVehicleWheelSet && product.wheelForceSet ? (
          <section className="mt-5 space-y-3 border-t border-foreground/10 pt-5" aria-label={isUa ? "Склад комплекту дисків" : "Wheel set composition"}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-foreground/60 dark:text-foreground/45">
              {isUa ? "Комплект для обраного авто" : "Vehicle-specific wheel set"}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {[{ key: "front", axle: isUa ? "Передня вісь" : "Front axle", component: product.wheelForceSet.front }, { key: "rear", axle: isUa ? "Задня вісь" : "Rear axle", component: product.wheelForceSet.rear }].map(({ key, axle, component }) => (
                <div key={key} className="rounded-xl border border-foreground/10 bg-foreground/[0.02] px-3 py-2.5">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-foreground/55">{axle} · 2 {isUa ? "диски" : "wheels"}</p>
                  <p className="mt-1 text-sm font-medium">{component.sizeSpec}</p>
                  <p className="mt-1 text-[10px] text-foreground/45">{isUa ? "Артикул" : "SKU"} {component.sku}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {isWheelForce && (optionAxes.length > 0 || accessoryOptions.length > 0) ? (
          <h3 className="mt-5 border-t border-foreground/10 pt-5 text-sm font-semibold uppercase tracking-[0.12em]">
            {isUa ? "Конфігуратор колеса" : "Wheel configurator"}
          </h3>
        ) : null}
        {optionAxes.length > 0 ? (
          <div
            className="mt-5 space-y-4 border-t border-foreground/10 pt-5"
            aria-label={isUa ? "Вибір варіанта" : "Variant selection"}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-foreground/55 dark:text-foreground/40">
              {isWheelForce
                ? isUa ? "1. Оберіть розмір і посадку" : "1. Choose size and fitment"
                : isUa ? "Виберіть варіант" : "Choose your variant"}
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
        {accessoryOptions.length ? (
          <fieldset className="mt-5 space-y-3 border-t border-foreground/10 pt-5">
            <legend className="mb-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-foreground/60 dark:text-foreground/45">
              {isWheelForce && optionAxes.length > 0
                ? isUa ? "2. Аксесуари для цього розміру" : "2. Accessories for this size"
                : isUa ? "Опції аксесуарів" : "Accessory options"}
            </legend>
            {accessoryOptions.map((option) => {
              const checked = selectedAccessorySkus.includes(option.sku);
              const optionPricing = resolveShopProductPricing(
                {
                  ...product,
                  price: option.price,
                  europePrice: option.europePrice,
                },
                viewerContext
              );
              const optionQuantity = option.quantity ?? 1;
              const optionTotalPrice = {
                eur: optionPricing.effectivePrice.eur * optionQuantity,
                usd: optionPricing.effectivePrice.usd * optionQuantity,
                uah: optionPricing.effectivePrice.uah * optionQuantity,
              };
              return (
                <label
                  key={option.sku}
                  className={
                    checked
                      ? "grid cursor-pointer grid-cols-[16px_40px_minmax(0,1fr)] items-center gap-x-2 gap-y-1 rounded-xl border border-primary/55 bg-primary/[0.06] p-2 transition sm:flex sm:gap-3 sm:p-3"
                      : "grid cursor-pointer grid-cols-[16px_40px_minmax(0,1fr)] items-center gap-x-2 gap-y-1 rounded-xl border border-foreground/10 bg-foreground/[0.02] p-2 transition hover:border-foreground/25 sm:flex sm:gap-3 sm:p-3"
                  }
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) =>
                      setSelectedAccessorySkus((current) =>
                        event.target.checked
                          ? [...current, option.sku]
                          : current.filter((sku) => sku !== option.sku)
                      )
                    }
                    className="row-span-2 h-4 w-4 shrink-0 accent-primary sm:row-auto"
                    aria-label={isUa ? option.title.ua : option.title.en}
                  />
                  <span className="relative row-span-2 h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-foreground/10 bg-background sm:row-auto sm:h-12 sm:w-12">
                    {option.image ? (
                      <ShopProductImage
                        src={option.image}
                        alt={isUa ? option.title.ua : option.title.en}
                        fill
                        sizes="(max-width: 639px) 40px, 48px"
                        className="object-contain p-1"
                      />
                    ) : null}
                  </span>
                  <span className="col-start-3 min-w-0 text-sm text-foreground/85 sm:col-auto sm:flex-1">
                    {isUa ? option.title.ua : option.title.en}
                    {optionQuantity > 1 ? ` × ${optionQuantity}` : null}
                    <span className="mt-1 block text-[10px] uppercase tracking-[0.12em] text-foreground/45">
                      {isUa ? "Артикул " + option.sku : "SKU " + option.sku}
                    </span>
                  </span>
                  <ShopInlinePriceText
                    locale={locale}
                    price={optionTotalPrice}
                    className="col-start-3 text-sm font-medium text-foreground sm:col-auto sm:ml-auto sm:shrink-0"
                  />
                </label>
              );
            })}
          </fieldset>
        ) : null}
      </div>

      {children}

      <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:flex-wrap">
        <AddToCartButton
          slug={currentVariant?.purchaseSlug ?? product.slug}
          locale={locale}
          quantity={isSingleWheelProduct ? 4 : 1}
          variantId={currentVariant?.id ?? null}
          productName={productTitle}
          additionalItems={selectedAccessoryItems}
          label={isWheelSet
            ? selectedAccessoryItems.length
              ? isUa ? "Додати комплект і аксесуари" : "Add wheel set and accessories"
              : isVehicleWheelSet
                ? isUa ? "Додати комплект дисків" : "Add wheel set"
                : isUa ? "Додати комплект (4 диски)" : "Add set (4 wheels)"
            : selectedAccessoryItems.length
              ? isUa ? "Додати диск і аксесуари" : "Add wheel and accessories"
              : undefined}
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
            SKU
          </span>
          <span className="min-w-0 break-all rounded-full border border-foreground/20 bg-foreground/5 px-3 py-1 font-mono text-xs tracking-[0.04em] text-foreground/85">
            {currentVariant?.sku ?? product.sku}
          </span>
        </div>
      ) : null}
    </div>
  );
}

