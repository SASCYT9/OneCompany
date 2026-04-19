"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronDown, RotateCcw, X } from "lucide-react";
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
import { URBAN_COLLECTION_CARDS } from "@/app/[locale]/shop/data/urbanCollectionsList";

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

const FALLBACK_URBAN_IMAGE =
  "/images/shop/urban/hero/models/defender2020Plus/2025Updates/hero-1-1920.jpg";

function isPlaceholderImage(url: string | null | undefined) {
  const normalized = String(url ?? "").trim().toLowerCase();
  if (!normalized) return true;
  
  if (
    [
      "image-coming-soon",
      "coming-soon",
      "comingsoon",
      "placeholder",
      "no-image",
      "image_coming_soon",
      "gp-portal",
      "gpproducts",
    ].some((marker) => normalized.includes(marker))
  ) {
    return true;
  }

  // Block GP Products generic vehicle placeholder PNGs that masquerade as real model images
  // e.g., /L460.png, /Gwagon_e9292903-5bf9...png, /Transporter.png
  if (
    normalized.includes("cdn.shopify.com") &&
    (/\/(transporter|gwagon|l460|l461|l494|cullinan|defender|urus)(_[a-z0-9\-]+)?\.png$/i.test(normalized))
  ) {
    return true;
  }

  return false;
}

function resolveProductImage(image: string | undefined | null, modelHandles: string[]) {
  let raw = image ? image.replace(/^["']|["']$/g, "").trim() : "";
  if (raw.startsWith("//")) raw = `https:${raw}`;

  if (!raw || isPlaceholderImage(raw)) {
    for (const handle of modelHandles) {
      const card = URBAN_COLLECTION_CARDS.find((c) => c.collectionHandle === handle);
      if (card?.externalImageUrl) return card.externalImageUrl;
    }
    return FALLBACK_URBAN_IMAGE;
  }
  
  return raw;
}

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
        className={`flex min-h-[60px] w-full items-center justify-between gap-4 rounded-[16px] px-5 py-3 text-left transition duration-300 ${
          open
            ? "bg-[#c29d59]/10 shadow-[inset_0_0_0_1px_rgba(194,157,89,0.4)] backdrop-blur-md"
            : "bg-transparent hover:bg-white/[0.05]"
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
        <div className="absolute left-0 right-0 top-[calc(100%+12px)] z-[70] overflow-hidden rounded-[20px] border border-white/10 bg-[#0a0a0a]/90 backdrop-blur-2xl shadow-[0_28px_80px_rgba(0,0,0,0.55)]">
          <div id={listboxId} role="listbox" className="max-h-[420px] overflow-y-auto p-2">
            <button
              type="button"
              onClick={() => {
                onChange("all");
                setOpen(false);
              }}
              className={`flex w-full items-center rounded-[14px] px-4 py-3 text-left text-sm transition ${
                value === "all"
                  ? "bg-[#c29d59]/12 text-white"
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
                            ? "bg-[#c29d59]/12 text-white"
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
  const productImage = resolveProductImage(entry.product.image, entry.modelHandles);
  const familyLabel = isUa ? FAMILY_LABELS[entry.family].ua : FAMILY_LABELS[entry.family].en;
  const leadTime = localizeShopText(locale, entry.product.leadTime);
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
      className={`group flex h-full flex-col overflow-hidden rounded-[28px] border backdrop-blur-md ${
        featured ? "border-[#c29d59]/40 bg-gradient-to-br from-[#121212]/80 to-[#080808]/90" : "border-white/10 bg-white/[0.02]"
      } shadow-[0_20px_70px_rgba(0,0,0,0.28)] transition duration-500 hover:-translate-y-2 hover:border-white/25 hover:shadow-[0_30px_90px_rgba(0,0,0,0.7)]`}
    >
      <div className="relative aspect-[4/3] overflow-hidden border-b border-white/10 bg-[#050505]">
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
            <span className="rounded-full border border-[#c29d59]/60 bg-[#c29d59]/15 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.24em] text-[#ead29d]">
              {isUa ? "Пріоритет Urban" : "Urban priority"}
            </span>
          ) : null}
          {entry.isBodykit ? (
            <span className="rounded-full border border-white/20 bg-black/55 px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-white/80">
              {isUa ? "Повний комплект" : "Complete kit"}
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-white/45">
          <span>{entry.brand}</span>
          <span className="text-white/20">•</span>
          <span>{entry.modelSummaryLabel}</span>
        </div>

        <Link href={productUrl} className="mt-3 block">
          <h3 className="text-[20px] font-semibold leading-tight text-white transition duration-200 group-hover:text-[#ead29d]">
            {entry.title}
          </h3>
        </Link>

        <p className="mt-2 text-sm leading-6 text-white/65">{entry.categoryLabel}</p>

        <div className="mt-4 grid grid-cols-2 gap-3 rounded-[22px] border border-white/8 bg-black/35 p-4 text-xs text-white/62">
          <div>
            <p className="uppercase tracking-[0.18em] text-white/35">
              {isUa ? "Сімейство" : "Family"}
            </p>
            <p className="mt-1 text-white/78">{familyLabel}</p>
          </div>
          <div>
            <p className="uppercase tracking-[0.18em] text-white/35">
              {isUa ? "Термін" : "Lead time"}
            </p>
            <p className="mt-1 text-white/78">{leadTime || "—"}</p>
          </div>
        </div>

        <div className="mt-auto pt-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              {compareAmount > currentAmount && compareAmount > 0 ? (
                <p className="text-xs text-white/35 line-through">
                  {formatDisplayPrice(locale, currency, computedCompare!)}
                </p>
              ) : null}
              <p className="mt-1 text-[22px] font-semibold tracking-tight text-white">
                {hasPrice
                  ? formatDisplayPrice(locale, currency, computedPrice)
                  : isUa
                    ? "Ціна за запитом"
                    : "Price on request"}
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.22em] ${
                entry.product.stock === "inStock"
                  ? "border border-emerald-500/40 bg-emerald-500/12 text-emerald-300"
                  : "border border-white/14 bg-white/6 text-white/55"
              }`}
            >
              {availability}
            </span>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href={productUrl}
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/14 px-5 text-xs font-medium uppercase tracking-[0.2em] text-white/78 transition hover:border-white/28 hover:text-white"
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
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#f3f0e8] px-5 text-xs font-semibold uppercase tracking-[0.2em] text-black transition hover:bg-white"
                label={isUa ? "Замовити" : "Order"}
                labelAdded={isUa ? "У кошику" : "In cart"}
              />
            ) : (
              <Link
                href={`/${locale}/contact`}
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#c29d59]/35 bg-[#c29d59]/12 px-5 text-xs font-medium uppercase tracking-[0.2em] text-[#ead29d] transition hover:border-[#c29d59]/55 hover:bg-[#c29d59]/18"
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

    next.sort((left, right) => {
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

    return next;
  }, [activeCategory, familyScopedProducts, locale]);

  const featuredBodykits = useMemo(
    () => filteredProducts.filter((entry) => entry.family === "bodykits"),
    [filteredProducts]
  );

  const componentProducts = useMemo(
    () => filteredProducts.filter((entry) => entry.family !== "bodykits"),
    [filteredProducts]
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
    activeCategory !== "all";

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
  }

  return (
    <section className="pb-16 md:pb-24">
      <div className="mx-auto w-full max-w-[1720px] px-6 md:px-12 lg:px-16">
        <div className="mb-8 flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div>
            <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.3em] text-[#c29d59]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#c29d59] shadow-[0_0_8px_rgba(194,157,89,0.8)]" />
              Urban Automotive
            </p>
            <h1 className="mt-4 text-balance text-4xl font-bold tracking-tight text-white drop-shadow-md sm:text-5xl">
              {isUa ? "Каталог Urban" : "Urban Catalog"}
            </h1>
          </div>
          {hasActiveFilters ? (
            <div className="inline-flex items-center justify-center rounded-full border border-[#c29d59]/20 bg-[#c29d59]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-[#c29d59]">
              {filteredProducts.length} {isUa ? "Товарів знайдено" : "Products found"}
            </div>
          ) : null}
        </div>

        <div className="relative z-50 mb-12 rounded-[24px] border border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent p-3 backdrop-blur-2xl shadow-[0_12px_40px_rgba(0,0,0,0.4)]">
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
              label={isUa ? "Сімейство" : "Family"}
              value={activeFamily}
              onChange={(value) => setActiveFamily(value as FamilyFilter)}
              placeholder={isUa ? "Усі сімейства" : "All families"}
              groups={familyComboboxGroups}
              allLabel={isUa ? "Усі сімейства" : "All families"}
            />
            <PremiumCombobox
              label={isUa ? "Тип" : "Type"}
              placeholder={isUa ? "Усі типи" : "All types"}
              value={activeCategory}
              onChange={(value) => setActiveCategory(value as CategoryFilter)}
              groups={categoryComboboxGroups}
              allLabel={isUa ? "Усі типи" : "All types"}
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
              <div className="mb-4">
                <h3 className="text-lg font-medium text-white">
                  {isUa ? "Програми" : "Programmes"}
                </h3>
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
                <div className="mb-4">
                  <h3 className="text-lg font-medium text-white">
                    {isUa ? "Компоненти" : "Components"}
                  </h3>
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
            {filteredProducts.map((entry) => (
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
      </div>
    </section>
  );
}
