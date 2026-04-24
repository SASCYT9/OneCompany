"use client";

import { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronDown, RotateCcw, Search, X } from "lucide-react";
import { AddToCartButton } from "@/components/shop/AddToCartButton";
import { useShopCurrency } from "@/components/shop/CurrencyContext";
import type { SupportedLocale } from "@/lib/seo";
import type { ShopProduct } from "@/lib/shopCatalog";
import { formatShopMoney, type ShopCurrencyCode } from "@/lib/shopMoneyFormat";
import { localizeShopText } from "@/lib/shopText";
import { buildShopProductPath } from "@/lib/urbanCollectionMatcher";
import type { ShopViewerPricingContext } from "@/lib/shopPricingAudience";
import { resolveShopProductPricing } from "@/lib/shopPricingAudience";
import {
  buildUrbanCatalogEntries,
  type UrbanCatalogEntry,
  type UrbanCatalogFamily,
  URBAN_FAMILY_ORDER,
} from "@/lib/urbanCatalogFacets";
import { resolveUrbanProductImage } from "@/lib/urbanImageUtils";

type UrbanVehicleFilterProps = {
  locale: SupportedLocale;
  products: ShopProduct[];
  viewerContext?: ShopViewerPricingContext;
};

type FamilyFilter = "all" | UrbanCatalogFamily;
type CategoryFilter = "all" | string;

type EnrichedUrbanProduct = UrbanCatalogEntry & {
  modelSummaryLabel: string;
};

type FacetItem = {
  key: string;
  label: string;
  count: number;
};

const PAGE_SIZE = 24;

function normalizeSearchValue(value: string) {
  return value
    .toLowerCase()
    .replace(/[ʼ'’]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

type PremiumComboboxOption = {
  value: string;
  label: string;
  searchText?: string;
};

type PremiumComboboxGroup = {
  label?: string;
  options: PremiumComboboxOption[];
};

const FAMILY_LABELS: Record<
  UrbanCatalogFamily,
  { ua: string; en: string; hintUa: string; hintEn: string }
> = {
  bodykits: {
    ua: "Програми / Bodykits",
    en: "Programmes / Bodykits",
    hintUa: "Повні обвіси та ключові Urban програми",
    hintEn: "Complete kits and flagship Urban programmes",
  },
  exterior: {
    ua: "Зовнішні компоненти",
    en: "Exterior Components",
    hintUa: "Спойлери, дифузори, капоти, решітки, арки",
    hintEn: "Spoilers, diffusers, hoods, grilles, arches",
  },
  wheels: {
    ua: "Диски та колісні елементи",
    en: "Wheels & Wheel Hardware",
    hintUa: "Диски, гайки, проставки, tyre packages",
    hintEn: "Wheels, nuts, spacers, tyre packages",
  },
  exhaust: {
    ua: "Вихлоп",
    en: "Exhaust",
    hintUa: "Системи вихлопу та насадки",
    hintEn: "Exhaust systems and tailpipes",
  },
  interior: {
    ua: "Інтер'єр",
    en: "Interior",
    hintUa: "Килимки та interior kits",
    hintEn: "Floor mats and interior kits",
  },
  accessories: {
    ua: "Аксесуари",
    en: "Accessories",
    hintUa: "Декор, електрика, опції, дрібні аксесуари",
    hintEn: "Decals, electrics, options, accessories",
  },
};



function computePricesFromEur(
  price: ShopProduct["price"],
  rates: { EUR: number; USD: number; UAH?: number } | null
) {
  const baseEur = price.eur;
  const baseUah = price.uah;
  const baseUsd = price.usd;
  const eurToUah = rates?.UAH ?? 0;
  const eurToUsd = rates?.USD ?? 0;

  if (baseEur > 0 && rates) {
    return {
      eur: baseEur,
      uah: baseUah > 0 ? baseUah : Math.round(baseEur * eurToUah),
      usd: baseUsd > 0 ? baseUsd : Math.round(baseEur * eurToUsd),
    };
  }

  if (baseUah > 0 && eurToUah > 0) {
    const derivedEur = baseEur > 0 ? baseEur : Math.round(baseUah / eurToUah);
    return {
      uah: baseUah,
      eur: derivedEur,
      usd: baseUsd > 0 ? baseUsd : Math.round(derivedEur * eurToUsd),
    };
  }

  if (baseUsd > 0 && eurToUsd > 0) {
    const derivedEur = baseEur > 0 ? baseEur : Math.round(baseUsd / eurToUsd);
    return {
      usd: baseUsd,
      eur: derivedEur,
      uah: baseUah > 0 ? baseUah : Math.round(derivedEur * eurToUah),
    };
  }

  return { uah: baseUah, eur: baseEur, usd: baseUsd };
}

function formatDisplayPrice(
  locale: SupportedLocale,
  currency: ShopCurrencyCode,
  price: { eur: number; usd: number; uah: number }
) {
  if (currency === "USD") return formatShopMoney(locale, price.usd, "USD");
  if (currency === "EUR") return formatShopMoney(locale, price.eur, "EUR");
  return formatShopMoney(locale, price.uah, "UAH");
}

function displayAmount(currency: ShopCurrencyCode, price: { eur: number; usd: number; uah: number }) {
  if (currency === "USD") return price.usd;
  if (currency === "EUR") return price.eur;
  return price.uah;
}
type PremiumComboboxProps = {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  groups: PremiumComboboxGroup[];
  allLabel: string;
};

function PremiumCombobox({
  label,
  placeholder,
  value,
  onChange,
  groups,
  allLabel,
}: PremiumComboboxProps) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const selectedOption = useMemo(
    () => groups.flatMap((group) => group.options).find((option) => option.value === value) ?? null,
    [groups, value]
  );

  return (
    <div ref={rootRef} className={`relative ${open ? "z-50" : "z-10"}`}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        className={`flex min-h-[58px] w-full items-center justify-between gap-4 rounded-[10px] px-4 py-3 text-left transition duration-300 ${
          open
            ? "bg-white/[0.07] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18)] backdrop-blur-md"
            : "bg-transparent hover:bg-white/[0.04]"
        }`}
      >
        <span className="min-w-0">
          <span className="block text-[9px] font-semibold uppercase tracking-[0.15em] text-white/40">{label}</span>
          <span className={`mt-0.5 block truncate text-[14px] font-medium ${selectedOption ? "text-white" : "text-white/60"}`}>
            {selectedOption?.label ?? placeholder}
          </span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-white/45 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <div className="absolute left-0 right-0 top-[calc(100%+12px)] z-[70] overflow-hidden rounded-[14px] border border-white/12 bg-[#0a0a0a]/95 backdrop-blur-2xl shadow-[0_28px_80px_rgba(0,0,0,0.55)]">
          <div id={listboxId} role="listbox" className="max-h-[420px] overflow-y-auto p-2">
            <button
              type="button"
              onClick={() => {
                onChange("all");
                setOpen(false);
              }}
              className={`flex w-full items-center rounded-[14px] px-4 py-3 text-left text-sm transition ${
                value === "all"
                  ? "bg-white/[0.08] text-white"
                  : "text-white/72 hover:bg-white/[0.04] hover:text-white"
              }`}
            >
              {allLabel}
            </button>

            {groups.length > 0 ? (
              groups.map((group) => (
                <div key={group.label ?? "group"} className="mt-2">
                  {group.label ? (
                    <p className="px-4 pb-2 pt-2 text-[10px] uppercase text-white/28">{group.label}</p>
                  ) : null}
                  <div className="space-y-1">
                    {group.options.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          onChange(option.value);
                          setOpen(false);
                        }}
                        className={`flex w-full items-center rounded-[14px] px-4 py-3 text-left text-sm transition ${
                          value === option.value
                            ? "bg-white/[0.08] text-white"
                            : "text-white/72 hover:bg-white/[0.04] hover:text-white"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="px-4 py-8 text-sm text-white/45">{allLabel}</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

type ProductCardProps = {
  entry: EnrichedUrbanProduct;
  locale: SupportedLocale;
  viewerContext?: ShopViewerPricingContext;
  currency: ShopCurrencyCode;
  rates: { EUR: number; USD: number; UAH?: number } | null;
  featured?: boolean;
};

function ProductCard({
  entry,
  locale,
  viewerContext,
  currency,
  rates,
  featured = false,
}: ProductCardProps) {
  const isUa = locale === "ua";
  const pricing = viewerContext
    ? resolveShopProductPricing(entry.product, viewerContext)
    : {
        effectivePrice: entry.product.price,
        effectiveCompareAt: entry.product.compareAt ?? null,
        requestQuote: false,
      };

  const computedPrice = computePricesFromEur(pricing.effectivePrice, rates);
  const computedCompare = pricing.effectiveCompareAt
    ? computePricesFromEur(pricing.effectiveCompareAt, rates)
    : null;
  const currentAmount = displayAmount(currency, computedPrice);
  const compareAmount = computedCompare ? displayAmount(currency, computedCompare) : 0;
  const hasPrice = currentAmount > 0;
  const canOrder = hasPrice && !pricing.requestQuote;
  const productUrl = buildShopProductPath(locale, entry.product);
  const productImage = resolveUrbanProductImage(entry.product.image, entry.modelHandles);

  const availability =
    entry.product.stock === "inStock"
      ? isUa
        ? "В наявності"
        : "In stock"
      : isUa
        ? "Під замовлення"
        : "Made to order";

  return (
    <article
      className={`group flex h-full flex-col overflow-hidden rounded-[14px] border backdrop-blur-md ${
        featured ? "border-white/18 bg-[#0b0b0b]" : "border-white/10 bg-white/[0.018]"
      } shadow-[0_18px_56px_rgba(0,0,0,0.24)] transition duration-500 hover:-translate-y-1 hover:border-white/28 hover:bg-white/[0.035] hover:shadow-[0_26px_72px_rgba(0,0,0,0.62)]`}
    >
      <div className="relative aspect-[16/11] overflow-hidden border-b border-white/10 bg-[#050505]">
        <Image
          src={productImage}
          alt={entry.title}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
          className="object-cover transition duration-700 group-hover:scale-[1.04]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <div className="absolute left-4 top-4 flex flex-wrap gap-2">
          {featured ? (
            <span className="border border-white/20 bg-black/45 px-2.5 py-1 text-[9px] font-medium uppercase tracking-[0.22em] text-white/82 backdrop-blur-md">
              {isUa ? "Urban programme" : "Urban programme"}
            </span>
          ) : null}
          {entry.isBodykit ? (
            <span className="border border-white/14 bg-black/35 px-2.5 py-1 text-[9px] uppercase tracking-[0.2em] text-white/62 backdrop-blur-md">
              {isUa ? "Повний комплект" : "Complete kit"}
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2 text-[9px] uppercase tracking-[0.2em] text-white/42">
          <span>{entry.brand}</span>
          <span className="text-white/20">•</span>
          <span>{entry.modelSummaryLabel}</span>
        </div>

        <Link href={productUrl} className="mt-3 block">
          <h3 className="line-clamp-2 min-h-[2.8rem] text-[18px] font-medium leading-tight text-white transition duration-200 group-hover:text-white">
            {entry.title}
          </h3>
        </Link>

        <div className="mt-2 space-y-1.5">
          <p className="line-clamp-1 text-sm leading-6 text-white/58">{entry.categoryLabel}</p>
          {entry.product.sku ? (
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/32">
              SKU {entry.product.sku}
            </p>
          ) : null}
        </div>

        <div className="mt-auto pt-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              {compareAmount > currentAmount && compareAmount > 0 ? (
                <p className="text-xs text-white/35 line-through">
                  {formatDisplayPrice(locale, currency, computedCompare!)}
                </p>
              ) : null}
              <p className="mt-1 text-[20px] font-medium tracking-tight text-white">
                {hasPrice
                  ? formatDisplayPrice(locale, currency, computedPrice)
                  : isUa
                    ? "Ціна за запитом"
                    : "Price on request"}
              </p>
            </div>
            <span
              className={`px-0 py-1 text-[10px] uppercase tracking-[0.18em] ${
                entry.product.stock === "inStock"
                  ? "text-white/58"
                  : "text-white/45"
              }`}
            >
              {availability}
            </span>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href={productUrl}
              className="inline-flex min-h-10 items-center justify-center rounded-[8px] border border-white/14 px-4 text-[11px] font-medium uppercase tracking-[0.18em] text-white/72 transition hover:border-white/32 hover:text-white"
            >
              {isUa ? "Деталі" : "Details"}
            </Link>
            {canOrder ? (
              <AddToCartButton
                slug={entry.product.slug}
                locale={locale}
                redirect
                variant="inline"
                productName={entry.title}
                className="inline-flex min-h-10 items-center justify-center rounded-[8px] bg-[#f3f0e8] px-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-black transition hover:bg-white"
                label={isUa ? "Замовити" : "Order"}
                labelAdded={isUa ? "У кошику" : "In cart"}
              />
            ) : (
              <Link
                href={`/${locale}/contact`}
                className="inline-flex min-h-10 items-center justify-center rounded-[8px] border border-white/18 bg-white/[0.04] px-4 text-[11px] font-medium uppercase tracking-[0.18em] text-white/78 transition hover:border-white/32 hover:bg-white/[0.07]"
              >
                {isUa ? "Запитати комплект" : "Request"}
              </Link>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

export default function UrbanVehicleFilter({
  locale,
  products,
  viewerContext,
}: UrbanVehicleFilterProps) {
  const isUa = locale === "ua";
  const { currency, rates } = useShopCurrency();
  const [mounted, setMounted] = useState(false);
  const [activeBrand, setActiveBrand] = useState<string>("all");
  const [activeModel, setActiveModel] = useState<string>("all");
  const [activeFamily, setActiveFamily] = useState<FamilyFilter>("all");
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const deferredSearchQuery = useDeferredValue(searchQuery);

  useEffect(() => {
    setMounted(true);
  }, []);

  const displayCurrency = mounted ? currency : "UAH";
  const displayRates = mounted
    ? rates && { EUR: rates.EUR, USD: rates.USD, UAH: rates.UAH }
    : null;

  const enrichedProducts = useMemo<EnrichedUrbanProduct[]>(() => {
    return buildUrbanCatalogEntries({
      locale,
      products,
      viewerContext,
    }).map((entry) => ({
      ...entry,
      modelSummaryLabel:
        localizeShopText(locale, entry.product.collection) ||
        entry.modelFacets.map((facet) => facet.label).join(" / ") ||
        entry.primaryModelLabel,
    }));
  }, [locale, products, viewerContext]);

  const brandOptions = useMemo(() => {
    const brands = new Map<string, FacetItem & { order: number }>();

    enrichedProducts.forEach((entry) => {
      const current = brands.get(entry.brand);
      if (current) {
        current.count += 1;
        current.order = Math.min(current.order, entry.brandOrder);
        return;
      }

      brands.set(entry.brand, {
        key: entry.brand,
        label: entry.brand,
        count: 1,
        order: entry.brandOrder,
      });
    });

    return Array.from(brands.values()).sort((left, right) => {
      if (left.order !== right.order) return left.order - right.order;
      if (right.count !== left.count) return right.count - left.count;
      return left.label.localeCompare(right.label, "en");
    });
  }, [enrichedProducts]);

  const brandScopedProducts = useMemo(
    () =>
      activeBrand === "all"
        ? enrichedProducts
        : enrichedProducts.filter((entry) => entry.brand === activeBrand),
    [activeBrand, enrichedProducts]
  );

  const modelsByBrand = useMemo(() => {
    const groups = new Map<string, Map<string, FacetItem & { order: number }>>();

    brandScopedProducts.forEach((entry) => {
      entry.modelFacets.forEach((facet) => {
        if (!groups.has(facet.brand)) {
          groups.set(facet.brand, new Map());
        }
        const group = groups.get(facet.brand)!;
        const current = group.get(facet.handle);
        if (current) {
          current.count += 1;
          current.order = Math.min(current.order, facet.order);
          return;
        }

        group.set(facet.handle, {
          key: facet.handle,
          label: facet.label,
          count: 1,
          order: facet.order,
        });
      });
    });

    return Array.from(groups.entries())
      .sort((left, right) => {
        const leftOrder = Math.min(...Array.from(left[1].values()).map((item) => item.order));
        const rightOrder = Math.min(...Array.from(right[1].values()).map((item) => item.order));
        if (leftOrder !== rightOrder) return leftOrder - rightOrder;
        return left[0].localeCompare(right[0], "en");
      })
      .map(([brand, items]) => ({
        brand,
        items: Array.from(items.values()).sort((left, right) => {
          if (left.order !== right.order) return left.order - right.order;
          if (right.count !== left.count) return right.count - left.count;
          return left.label.localeCompare(right.label, "en");
        }),
      }));
  }, [brandScopedProducts]);

  useEffect(() => {
    if (
      activeModel !== "all" &&
      !modelsByBrand.some((group) => group.items.some((item) => item.key === activeModel))
    ) {
      setActiveModel("all");
    }
  }, [activeModel, modelsByBrand]);

  const modelScopedProducts = useMemo(
    () =>
      activeModel === "all"
        ? brandScopedProducts
        : brandScopedProducts.filter((entry) => entry.modelHandles.includes(activeModel)),
    [activeModel, brandScopedProducts]
  );

  const familyOptions = useMemo(() => {
    const counts = new Map<UrbanCatalogFamily, number>();
    modelScopedProducts.forEach((entry) => {
      counts.set(entry.family, (counts.get(entry.family) ?? 0) + 1);
    });

    return URBAN_FAMILY_ORDER.map((family) => ({
      key: family,
      label: isUa ? FAMILY_LABELS[family].ua : FAMILY_LABELS[family].en,
      hint: isUa ? FAMILY_LABELS[family].hintUa : FAMILY_LABELS[family].hintEn,
      count: counts.get(family) ?? 0,
    }));
  }, [isUa, modelScopedProducts]);

  useEffect(() => {
    if (
      activeFamily !== "all" &&
      !familyOptions.some((option) => option.key === activeFamily && option.count > 0)
    ) {
      setActiveFamily("all");
    }
  }, [activeFamily, familyOptions]);

  const familyScopedProducts = useMemo(
    () =>
      activeFamily === "all"
        ? modelScopedProducts
        : modelScopedProducts.filter((entry) => entry.family === activeFamily),
    [activeFamily, modelScopedProducts]
  );

  const categoryOptions = useMemo(() => {
    const categories = new Map<string, FacetItem>();

    familyScopedProducts.forEach((entry) => {
      const current = categories.get(entry.categoryLabel);
      if (current) {
        current.count += 1;
        return;
      }

      categories.set(entry.categoryLabel, {
        key: entry.categoryLabel,
        label: entry.categoryLabel,
        count: 1,
      });
    });

    return Array.from(categories.values()).sort((left, right) => {
      if (right.count !== left.count) return right.count - left.count;
      return left.label.localeCompare(right.label, locale === "ua" ? "uk" : "en");
    });
  }, [familyScopedProducts, locale]);

  useEffect(() => {
    if (
      activeCategory !== "all" &&
      !categoryOptions.some((option) => option.key === activeCategory && option.count > 0)
    ) {
      setActiveCategory("all");
    }
  }, [activeCategory, categoryOptions]);

  const filteredProducts = useMemo(() => {
    const next =
      activeCategory === "all"
        ? [...familyScopedProducts]
        : familyScopedProducts.filter((entry) => entry.categoryLabel === activeCategory);

    const normalizedQuery = normalizeSearchValue(deferredSearchQuery);
    const searched = normalizedQuery
      ? next.filter((entry) => {
          const haystack = normalizeSearchValue(
            [
              entry.title,
              entry.product.sku,
              entry.product.brand,
              entry.product.vendor,
              entry.product.productType,
              entry.brand,
              entry.modelSummaryLabel,
              entry.primaryModelLabel,
              entry.categoryLabel,
              entry.product.tags?.join(" "),
              entry.modelFacets.map((facet) => facet.label).join(" "),
            ]
              .filter(Boolean)
              .join(" ")
          );

          return haystack.includes(normalizedQuery);
        })
      : next;

    searched.sort((left, right) => {
      if (left.family !== right.family) {
        if (left.family === "bodykits") return -1;
        if (right.family === "bodykits") return 1;
      }
      if (left.bodykitRank !== right.bodykitRank) {
        return left.bodykitRank - right.bodykitRank;
      }
      if (left.brandOrder !== right.brandOrder) {
        return left.brandOrder - right.brandOrder;
      }
      if (left.modelOrder !== right.modelOrder) {
        return left.modelOrder - right.modelOrder;
      }
      if (right.sortablePrice !== left.sortablePrice) {
        return right.sortablePrice - left.sortablePrice;
      }

      return left.title.localeCompare(right.title, locale === "ua" ? "uk" : "en");
    });

    return searched;
  }, [activeCategory, deferredSearchQuery, familyScopedProducts, locale]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [activeBrand, activeModel, activeFamily, activeCategory, deferredSearchQuery]);

  const visibleProducts = useMemo(
    () => filteredProducts.slice(0, visibleCount),
    [filteredProducts, visibleCount]
  );

  const featuredBodykits = useMemo(
    () => visibleProducts.filter((entry) => entry.family === "bodykits"),
    [visibleProducts]
  );

  const componentProducts = useMemo(
    () => visibleProducts.filter((entry) => entry.family !== "bodykits"),
    [visibleProducts]
  );

  const modelLabelByHandle = useMemo(() => {
    const map = new Map<string, string>();
    enrichedProducts.forEach((entry) => {
      entry.modelFacets.forEach((facet) => {
        if (!map.has(facet.handle)) {
          map.set(facet.handle, facet.label);
        }
      });
    });
    return map;
  }, [enrichedProducts]);

  const currentBrandLabel = activeBrand === "all" ? null : activeBrand;
  const currentModelLabel = activeModel === "all" ? null : modelLabelByHandle.get(activeModel) ?? null;
  const currentCategoryLabel = activeCategory === "all" ? null : activeCategory;
  const hasActiveFilters =
    activeBrand !== "all" ||
    activeModel !== "all" ||
    activeFamily !== "all" ||
    activeCategory !== "all" ||
    searchQuery.trim().length > 0;

  const remainingCount = Math.max(filteredProducts.length - visibleProducts.length, 0);

  const brandComboboxGroups = useMemo<PremiumComboboxGroup[]>(
    () => [
      {
        options: brandOptions.map((option) => ({
          value: option.key,
          label: option.label,
          searchText: option.label,
        })),
      },
    ],
    [brandOptions]
  );

  const modelComboboxGroups = useMemo<PremiumComboboxGroup[]>(
    () =>
      modelsByBrand.map((group) => ({
        label: group.brand,
        options: group.items.map((item) => ({
          value: item.key,
          label: item.label,
          searchText: `${group.brand} ${item.label}`,
        })),
      })),
    [modelsByBrand]
  );

  const familyComboboxGroups = useMemo<PremiumComboboxGroup[]>(
    () => [
      {
        options: familyOptions
          .filter((option) => option.count > 0)
          .map((option) => ({
            value: option.key,
            label: option.label,
            searchText: option.label,
          })),
      },
    ],
    [familyOptions]
  );

  const categoryComboboxGroups = useMemo<PremiumComboboxGroup[]>(
    () => [
      {
        options: categoryOptions.map((option) => ({
          value: option.key,
          label: option.label,
          searchText: option.label,
        })),
      },
    ],
    [categoryOptions]
  );

  function resetFilters() {
    setActiveBrand("all");
    setActiveModel("all");
    setActiveFamily("all");
    setActiveCategory("all");
    setSearchQuery("");
    setVisibleCount(PAGE_SIZE);
  }

  return (
    <section className="pb-16 md:pb-24">
      <div className="mx-auto w-full max-w-[1720px] px-6 md:px-12 lg:px-16">
        <div className="mb-8 flex flex-col items-start justify-between gap-6 border-b border-white/10 pb-8 md:flex-row md:items-end">
          <div>
            <p className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.3em] text-white/45">
              <span className="h-px w-8 bg-white/35" />
              Urban Automotive
            </p>
            <h1 className="mt-4 text-balance text-4xl font-light tracking-tight text-white drop-shadow-md sm:text-5xl">
              {isUa ? "Каталог Urban" : "Urban Catalog"}
            </h1>
          </div>
          <div className="inline-flex items-center justify-center border border-white/12 bg-white/[0.035] px-4 py-2 text-xs font-medium uppercase tracking-[0.15em] text-white/62">
            {filteredProducts.length} {isUa ? "Товарів знайдено" : "Products found"}
          </div>
        </div>

        <div className="relative z-50 mb-12 rounded-[16px] border border-white/10 bg-[#070707]/78 p-3 backdrop-blur-2xl shadow-[0_12px_40px_rgba(0,0,0,0.34)]">
          <div className="mb-3">
            <label className="relative block">
              <span className="sr-only">{isUa ? "Пошук по каталогу Urban" : "Search Urban catalog"}</span>
              <Search className="pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={
                  isUa
                    ? "Пошук за моделлю, деталлю або SKU"
                    : "Search by model, part, or SKU"
                }
                className="min-h-[58px] w-full rounded-[10px] border border-white/10 bg-black/30 px-12 pr-5 text-sm text-white outline-none transition placeholder:text-white/32 focus:border-white/25 focus:bg-black/45"
              />
            </label>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(0,0.95fr)_auto]">
            <PremiumCombobox
              label={isUa ? "Марка" : "Brand"}
              placeholder={isUa ? "Усі марки" : "All brands"}
              value={activeBrand}
              onChange={setActiveBrand}
              groups={brandComboboxGroups}
              allLabel={isUa ? "Усі марки" : "All brands"}
            />
            <PremiumCombobox
              label={isUa ? "Модель" : "Model"}
              placeholder={isUa ? "Усі моделі" : "All models"}
              value={activeModel}
              onChange={setActiveModel}
              groups={modelComboboxGroups}
              allLabel={isUa ? "Усі моделі" : "All models"}
            />
            <PremiumCombobox
              label={isUa ? "Розділ" : "Family"}
              value={activeFamily}
              onChange={(value) => setActiveFamily(value as FamilyFilter)}
              placeholder={isUa ? "Усі розділи" : "All families"}
              groups={familyComboboxGroups}
              allLabel={isUa ? "Усі розділи" : "All families"}
            />
            <PremiumCombobox
              label={isUa ? "Категорія" : "Type"}
              placeholder={isUa ? "Усі категорії" : "All types"}
              value={activeCategory}
              onChange={(value) => setActiveCategory(value as CategoryFilter)}
              groups={categoryComboboxGroups}
              allLabel={isUa ? "Усі категорії" : "All types"}
            />
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={resetFilters}
                className="flex min-h-[60px] items-center justify-center gap-2 rounded-[16px] bg-white/[0.02] px-6 text-xs font-semibold uppercase tracking-[0.1em] text-white/50 transition duration-300 hover:bg-[#c29d59]/15 hover:text-[#ead29d] hover:shadow-[0_0_20px_rgba(194,157,89,0.15)]"
              >
                <RotateCcw className="h-4 w-4" />
                <span className="hidden xl:block">{isUa ? "Скинути" : "Reset"}</span>
              </button>
            ) : null}
          </div>

          {hasActiveFilters ? (
            <div className="mx-3 mt-3 flex flex-wrap items-center gap-2 border-t border-white/5 pt-4">
              {searchQuery.trim() ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="inline-flex items-center gap-2 rounded-[999px] border border-white/14 bg-white/[0.04] px-3 py-1.5 text-xs text-white/72 transition hover:border-white/25 hover:text-white"
                >
                  <span>{searchQuery.trim()}</span>
                  <X className="h-3 w-3" />
                </button>
              ) : null}
              {currentBrandLabel ? (
                <button
                  type="button"
                  onClick={() => setActiveBrand("all")}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/60 transition hover:border-white/20 hover:text-white"
                >
                  <span>{currentBrandLabel}</span>
                  <X className="h-3 w-3" />
                </button>
              ) : null}
              {currentModelLabel ? (
                <button
                  type="button"
                  onClick={() => setActiveModel("all")}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/60 transition hover:border-white/20 hover:text-white"
                >
                  <span>{currentModelLabel}</span>
                  <X className="h-3 w-3" />
                </button>
              ) : null}
              {activeFamily !== "all" ? (
                <button
                  type="button"
                  onClick={() => setActiveFamily("all")}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/60 transition hover:border-white/20 hover:text-white"
                >
                  <span>{isUa ? FAMILY_LABELS[activeFamily].ua : FAMILY_LABELS[activeFamily].en}</span>
                  <X className="h-3 w-3" />
                </button>
              ) : null}
              {currentCategoryLabel ? (
                <button
                  type="button"
                  onClick={() => setActiveCategory("all")}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/60 transition hover:border-white/20 hover:text-white"
                >
                  <span>{currentCategoryLabel}</span>
                  <X className="h-3 w-3" />
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        {filteredProducts.length === 0 ? (
          <div className="mt-8 rounded-[28px] border border-white/10 bg-white/[0.03] p-8 text-center">
            <h3 className="text-2xl font-semibold text-white">
              {isUa ? "Нічого не знайдено" : "No matching products"}
            </h3>
            <button
              type="button"
              onClick={resetFilters}
              className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-[#f3f0e8] px-6 text-xs font-semibold uppercase tracking-[0.2em] text-black transition hover:bg-white"
            >
              {isUa ? "Скинути фільтри" : "Reset filters"}
            </button>
          </div>
        ) : activeFamily === "all" && activeCategory === "all" && featuredBodykits.length > 0 ? (
          <div className="mt-8 space-y-10">
            <section>
              <div className="mb-5 flex items-center justify-between border-b border-white/10 pb-3">
                <h3 className="text-[11px] font-medium uppercase tracking-[0.28em] text-white/72">
                  {isUa ? "Програми" : "Programmes"}
                </h3>
                <span className="text-[10px] uppercase tracking-[0.2em] text-white/35">
                  {featuredBodykits.length} / {filteredProducts.filter((entry) => entry.family === "bodykits").length}
                </span>
              </div>
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {featuredBodykits.map((entry) => (
                  <ProductCard
                    key={entry.product.slug}
                    entry={entry}
                    locale={locale}
                    viewerContext={viewerContext}
                    currency={displayCurrency}
                    rates={displayRates}
                    featured
                  />
                ))}
              </div>
            </section>

            {componentProducts.length > 0 ? (
              <section>
                <div className="mb-5 flex items-center justify-between border-b border-white/10 pb-3">
                  <h3 className="text-[11px] font-medium uppercase tracking-[0.28em] text-white/72">
                    {isUa ? "Компоненти" : "Components"}
                  </h3>
                  <span className="text-[10px] uppercase tracking-[0.2em] text-white/35">
                    {componentProducts.length} / {filteredProducts.filter((entry) => entry.family !== "bodykits").length}
                  </span>
                </div>
                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {componentProducts.map((entry) => (
                    <ProductCard
                      key={entry.product.slug}
                      entry={entry}
                      locale={locale}
                      viewerContext={viewerContext}
                      currency={displayCurrency}
                      rates={displayRates}
                    />
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        ) : (
          <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {visibleProducts.map((entry) => (
              <ProductCard
                key={entry.product.slug}
                entry={entry}
                locale={locale}
                viewerContext={viewerContext}
                currency={displayCurrency}
                rates={displayRates}
                featured={entry.family === "bodykits"}
              />
            ))}
          </div>
        )}

        {remainingCount > 0 ? (
          <div className="mt-12 flex justify-center">
            <button
              type="button"
              onClick={() => setVisibleCount((current) => current + PAGE_SIZE)}
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-[#c29d59]/35 bg-[#c29d59]/10 px-7 text-xs font-semibold uppercase tracking-[0.18em] text-[#ead29d] transition hover:border-[#c29d59]/60 hover:bg-[#c29d59]/18"
            >
              {isUa ? "Показати ще" : "Load more"}
              <span className="ml-3 rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/70">
                {Math.min(PAGE_SIZE, remainingCount)} / {remainingCount}
              </span>
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
