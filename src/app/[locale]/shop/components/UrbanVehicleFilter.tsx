"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronDown, RotateCcw, Search, SlidersHorizontal, X } from "lucide-react";
import { AddToCartButton } from "@/components/shop/AddToCartButton";
import { useShopCurrency } from "@/components/shop/CurrencyContext";
import type { SupportedLocale } from "@/lib/seo";
import type { ShopProduct } from "@/lib/shopCatalog";
import { formatShopMoney, type ShopCurrencyCode } from "@/lib/shopMoneyFormat";
import { localizeShopProductTitle, localizeShopText } from "@/lib/shopText";
import {
  buildShopProductPath,
  getUrbanCollectionHandleForProduct,
} from "@/lib/urbanCollectionMatcher";
import type { ShopViewerPricingContext } from "@/lib/shopPricingAudience";
import { resolveShopProductPricing } from "@/lib/shopPricingAudience";
import {
  URBAN_COLLECTION_BRANDS,
  URBAN_COLLECTION_CARDS,
} from "../data/urbanCollectionsList";

type UrbanVehicleFilterProps = {
  locale: SupportedLocale;
  products: ShopProduct[];
  viewerContext?: ShopViewerPricingContext;
};

type CatalogFamily =
  | "bodykits"
  | "exterior"
  | "wheels"
  | "exhaust"
  | "interior"
  | "accessories";
type FamilyFilter = "all" | CatalogFamily;
type SortOrder = "bodykits_first" | "price_desc" | "price_asc";

type EnrichedUrbanProduct = {
  product: ShopProduct;
  title: string;
  brand: string;
  modelHandle: string;
  modelLabel: string;
  categoryLabel: string;
  family: CatalogFamily;
  isBodykit: boolean;
  bodykitRank: number;
  searchableText: string;
  sortablePrice: number;
  modelOrder: number;
  brandOrder: number;
};

type FacetItem = {
  key: string;
  label: string;
  count: number;
};

const CARD_BY_HANDLE = new Map(
  URBAN_COLLECTION_CARDS.map((card, index) => [
    card.collectionHandle,
    {
      ...card,
      order: index,
    },
  ])
);

const BRAND_ORDER = new Map(URBAN_COLLECTION_BRANDS.map((brand, index) => [brand, index]));

const FAMILY_ORDER: CatalogFamily[] = [
  "bodykits",
  "exterior",
  "wheels",
  "exhaust",
  "interior",
  "accessories",
];

const FAMILY_LABELS: Record<
  CatalogFamily,
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

const BODYKIT_REGEX =
  /(body\s?kit|bodykits|bodykit|aero\s?kit|aerokit|widebody|widetrack|wide\s?track|обвіс|обвіси|аеродинамічний обвіс|кузовний обвіс|комплект обвіс|body conversion|bundle)/i;
const WHEEL_REGEX =
  /(wheel|wheels|wheel nut|wheel nuts|wheel spacer|wheel spacers|spacer|spacers|tyre|tyres|rim|rims|диск|диски|гайк|болт|проставк)/i;
const EXHAUST_REGEX = /(exhaust|tailpipe|tailpipes|вихлоп|насадк)/i;
const INTERIOR_REGEX = /(interior|floor mat|floor mats|interior kit|салон|килим|килимк)/i;
const ACCESSORY_REGEX =
  /(accessor|additional options|electrics|number plate|decal|lettering|logo|logos|cover|covers|mudguard|mudguards|trim|trims|option|options|аксесуар|електрик|наклейк|логотип)/i;

const FALLBACK_URBAN_IMAGE =
  "/images/shop/urban/hero/models/defender2020Plus/2025Updates/hero-1-1920.jpg";

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

function normalizeUrbanValue(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function primaryPrice(price: ShopProduct["price"]) {
  return price.eur || price.usd || price.uah || 0;
}

function inferFamily(product: ShopProduct) {
  const haystack = normalizeUrbanValue(
    [
      product.productType || "",
      product.category.en,
      product.category.ua,
      product.title.en,
      product.title.ua,
      product.collection.en,
      product.collection.ua,
      ...(product.tags || []),
    ].join(" ")
  );

  if (BODYKIT_REGEX.test(haystack)) return "bodykits";
  if (WHEEL_REGEX.test(haystack)) return "wheels";
  if (EXHAUST_REGEX.test(haystack)) return "exhaust";
  if (INTERIOR_REGEX.test(haystack)) return "interior";
  if (ACCESSORY_REGEX.test(haystack)) return "accessories";
  return "exterior";
}

function inferBodykitRank(product: ShopProduct, family: CatalogFamily) {
  if (family !== "bodykits") {
    return 50 + FAMILY_ORDER.indexOf(family);
  }

  const typeHaystack = normalizeUrbanValue(
    [product.productType || "", product.category.en, product.category.ua].join(" ")
  );
  const titleHaystack = normalizeUrbanValue(
    [product.title.en, product.title.ua, product.collection.en, product.collection.ua].join(" ")
  );

  if (/\bbodykits?\b|\bbodykit\b|widebody/i.test(typeHaystack)) return 0;
  if (/\bbundles?\b/i.test(typeHaystack)) return 1;
  if (
    /widetrack|wide\s?track|aero\s?kit|aerokit|кузовний обвіс|аеродинамічний обвіс/i.test(
      titleHaystack
    )
  ) {
    return 2;
  }
  if (/kit|комплект/i.test(titleHaystack)) return 3;
  return 4;
}

function sortFacetItems(items: Map<string, FacetItem>) {
  return Array.from(items.values()).sort((left, right) => {
    if (right.count !== left.count) return right.count - left.count;
    return left.label.localeCompare(right.label, "en");
  });
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

function sanitizeImage(image: string | undefined | null) {
  const raw = image ? image.replace(/^["']|["']$/g, "").trim() : "";
  if (!raw) return FALLBACK_URBAN_IMAGE;
  if (raw.startsWith("//")) return `https:${raw}`;
  return raw;
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
  const productImage = sanitizeImage(entry.product.image);
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
      className={`group flex h-full flex-col overflow-hidden rounded-[28px] border ${
        featured ? "border-[#c29d59]/40 bg-[#0c0c0c]" : "border-white/10 bg-white/[0.03]"
      } shadow-[0_20px_70px_rgba(0,0,0,0.28)] transition duration-300 hover:-translate-y-1 hover:border-white/20`}
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
          <span>{entry.modelLabel}</span>
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
  const [sortOrder, setSortOrder] = useState<SortOrder>("bodykits_first");
  const [searchQuery, setSearchQuery] = useState("");
  const [showModelBrowser, setShowModelBrowser] = useState(false);
  const deferredSearch = useDeferredValue(searchQuery);

  useEffect(() => {
    setMounted(true);
  }, []);

  const displayCurrency = mounted ? currency : "UAH";
  const displayRates = mounted
    ? rates && { EUR: rates.EUR, USD: rates.USD, UAH: rates.UAH }
    : null;

  const enrichedProducts = useMemo<EnrichedUrbanProduct[]>(() => {
    return products.map((product) => {
      const modelHandle = getUrbanCollectionHandleForProduct(product);
      const card = modelHandle ? CARD_BY_HANDLE.get(modelHandle) : undefined;
      const title = localizeShopProductTitle(locale, product);
      const family = inferFamily(product);
      const pricing = viewerContext ? resolveShopProductPricing(product, viewerContext) : null;
      const categoryLabel =
        localizeShopText(locale, product.category) ||
        product.productType ||
        (isUa ? "Urban компонент" : "Urban component");
      const brand = card?.brand ?? (isUa ? "Інші Urban" : "Other Urban");
      const collectionLabel =
        card?.title ||
        localizeShopText(locale, product.collection) ||
        (isUa ? "Інші Urban компоненти" : "Other Urban Components");
      const searchableText = normalizeUrbanValue(
        [
          title,
          categoryLabel,
          brand,
          collectionLabel,
          product.sku,
          product.productType || "",
          product.shortDescription.en,
          product.shortDescription.ua,
          ...(product.tags || []),
        ].join(" ")
      );

      return {
        product,
        title,
        brand,
        modelHandle: modelHandle ?? "other-urban",
        modelLabel: collectionLabel,
        categoryLabel,
        family,
        isBodykit: family === "bodykits",
        bodykitRank: inferBodykitRank(product, family),
        searchableText,
        sortablePrice: primaryPrice(pricing?.effectivePrice ?? product.price),
        modelOrder: card?.order ?? 999,
        brandOrder: BRAND_ORDER.get(brand) ?? 999,
      };
    });
  }, [products, locale, viewerContext, isUa]);

  const brandOptions = useMemo(() => {
    const map = new Map<string, FacetItem>();
    enrichedProducts.forEach((entry) => {
      const current = map.get(entry.brand);
      if (current) {
        current.count += 1;
        return;
      }
      map.set(entry.brand, {
        key: entry.brand,
        label: entry.brand,
        count: 1,
      });
    });

    return sortFacetItems(map).sort((left, right) => {
      const leftOrder = BRAND_ORDER.get(left.key) ?? 999;
      const rightOrder = BRAND_ORDER.get(right.key) ?? 999;
      if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      if (right.count !== left.count) return right.count - left.count;
      return left.label.localeCompare(right.label, "en");
    });
  }, [enrichedProducts]);

  const modelsByBrand = useMemo(() => {
    const groups = new Map<
      string,
      Map<string, FacetItem & { order: number }>
    >();

    enrichedProducts.forEach((entry) => {
      if (!groups.has(entry.brand)) {
        groups.set(entry.brand, new Map());
      }
      const group = groups.get(entry.brand)!;
      const current = group.get(entry.modelHandle);
      if (current) {
        current.count += 1;
        return;
      }
      group.set(entry.modelHandle, {
        key: entry.modelHandle,
        label: entry.modelLabel,
        count: 1,
        order: entry.modelOrder,
      });
    });

    return Array.from(groups.entries())
      .sort((left, right) => {
        const leftOrder = BRAND_ORDER.get(left[0]) ?? 999;
        const rightOrder = BRAND_ORDER.get(right[0]) ?? 999;
        if (leftOrder !== rightOrder) return leftOrder - rightOrder;
        return left[0].localeCompare(right[0], "en");
      })
      .map(([brand, models]) => ({
        brand,
        items: Array.from(models.values()).sort((left, right) => {
          if (left.order !== right.order) return left.order - right.order;
          if (right.count !== left.count) return right.count - left.count;
          return left.label.localeCompare(right.label, "en");
        }),
      }));
  }, [enrichedProducts]);

  useEffect(() => {
    if (activeBrand === "all" || activeModel === "all") return;
    const selectedBrand = modelsByBrand.find((group) => group.brand === activeBrand);
    if (!selectedBrand?.items.some((item) => item.key === activeModel)) {
      setActiveModel("all");
    }
  }, [activeBrand, activeModel, modelsByBrand]);

  const availableModelGroups = useMemo(() => {
    if (activeBrand === "all") return modelsByBrand;
    return modelsByBrand.filter((group) => group.brand === activeBrand);
  }, [activeBrand, modelsByBrand]);

  const normalizedSearch = normalizeUrbanValue(deferredSearch);

  const scopedProducts = useMemo(() => {
    return enrichedProducts.filter((entry) => {
      if (activeBrand !== "all" && entry.brand !== activeBrand) return false;
      if (activeModel !== "all" && entry.modelHandle !== activeModel) return false;
      if (normalizedSearch && !entry.searchableText.includes(normalizedSearch)) return false;
      return true;
    });
  }, [activeBrand, activeModel, enrichedProducts, normalizedSearch]);

  const familyOptions = useMemo(() => {
    const counts = new Map<CatalogFamily, number>();
    scopedProducts.forEach((entry) => {
      counts.set(entry.family, (counts.get(entry.family) ?? 0) + 1);
    });

    return FAMILY_ORDER.map((family) => ({
      key: family,
      label: isUa ? FAMILY_LABELS[family].ua : FAMILY_LABELS[family].en,
      hint: isUa ? FAMILY_LABELS[family].hintUa : FAMILY_LABELS[family].hintEn,
      count: counts.get(family) ?? 0,
    }));
  }, [isUa, scopedProducts]);

  const filteredProducts = useMemo(() => {
    const next = scopedProducts.filter((entry) => {
      if (activeFamily === "all") return true;
      return entry.family === activeFamily;
    });

    next.sort((left, right) => {
      if (sortOrder === "price_desc") {
        return right.sortablePrice - left.sortablePrice;
      }

      if (sortOrder === "price_asc") {
        return left.sortablePrice - right.sortablePrice;
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

    return next;
  }, [activeFamily, locale, scopedProducts, sortOrder]);

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
      if (!map.has(entry.modelHandle)) {
        map.set(entry.modelHandle, entry.modelLabel);
      }
    });
    return map;
  }, [enrichedProducts]);

  const currentModelLabel = activeModel === "all" ? null : modelLabelByHandle.get(activeModel) ?? null;
  const totalModelCount = modelLabelByHandle.size;
  const totalBodykits = enrichedProducts.filter((entry) => entry.family === "bodykits").length;
  const hasActiveFilters =
    activeBrand !== "all" ||
    activeModel !== "all" ||
    activeFamily !== "all" ||
    searchQuery.trim().length > 0 ||
    sortOrder !== "bodykits_first";

  function resetFilters() {
    setActiveBrand("all");
    setActiveModel("all");
    setActiveFamily("all");
    setSortOrder("bodykits_first");
    setSearchQuery("");
  }

  const resultLabel =
    activeFamily !== "all"
      ? isUa
        ? FAMILY_LABELS[activeFamily].ua
        : FAMILY_LABELS[activeFamily].en
      : currentModelLabel ||
        (activeBrand !== "all"
          ? activeBrand
          : isUa
            ? "весь каталог Urban"
            : "the full Urban catalog");

  return (
    <section className="pb-16 md:pb-24">
      <div className="mx-auto w-full max-w-[1720px] px-6 md:px-12 lg:px-16">
        <div className="overflow-hidden rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(194,157,89,0.22),_transparent_38%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-6 shadow-[0_24px_90px_rgba(0,0,0,0.32)] md:p-8 lg:p-10">
          <div className="max-w-[980px]">
            <p className="text-[11px] uppercase tracking-[0.32em] text-[#d4b06a]">
              Urban Automotive Global Catalog
            </p>
            <h1 className="mt-4 max-w-[14ch] text-4xl font-semibold tracking-tight text-white md:text-5xl lg:text-6xl">
              {isUa
                ? "Каталог, де спочатку бачиш повні обвіси, а не губишся в дрібних компонентах"
                : "A catalog that starts with complete programmes instead of burying you in loose parts"}
            </h1>
            <p className="mt-5 max-w-[900px] text-sm leading-7 text-white/68 md:text-base">
              {isUa
                ? "Замість липкого sidebar тут швидкий пошук, брендові фільтри, браузер моделей та окремий пріоритет для full bodykits. Спочатку вибираєш автомобіль і програму, далі звужуєш по сімейству компонентів."
                : "Instead of a sticky sidebar, this view uses fast search, brand filters, a model browser, and a dedicated priority layer for full bodykits. Start with the vehicle and programme, then narrow by component family."}
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-[24px] border border-white/10 bg-black/35 p-5">
              <p className="text-[11px] uppercase tracking-[0.24em] text-white/42">
                {isUa ? "Всього позицій" : "Total products"}
              </p>
              <p className="mt-3 text-3xl font-semibold text-white">{enrichedProducts.length}</p>
              <p className="mt-2 text-sm text-white/55">
                {isUa ? "Усі Urban товари в одному місці" : "All Urban products in one place"}
              </p>
            </div>
            <div className="rounded-[24px] border border-[#c29d59]/20 bg-[#120f0a] p-5">
              <p className="text-[11px] uppercase tracking-[0.24em] text-[#d8b97b]">
                {isUa ? "Bodykits / програми" : "Bodykits / programmes"}
              </p>
              <p className="mt-3 text-3xl font-semibold text-white">{totalBodykits}</p>
              <p className="mt-2 text-sm text-white/58">
                {isUa
                  ? "Показуються першими за замовчуванням"
                  : "Shown first by default"}
              </p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-black/35 p-5">
              <p className="text-[11px] uppercase tracking-[0.24em] text-white/42">
                {isUa ? "Urban моделі" : "Urban models"}
              </p>
              <p className="mt-3 text-3xl font-semibold text-white">{totalModelCount}</p>
              <p className="mt-2 text-sm text-white/55">
                {isUa
                  ? "Фільтрація через реальний Urban model mapping"
                  : "Facets driven by the real Urban model mapping"}
              </p>
            </div>
          </div>

          <div className="mt-8 rounded-[28px] border border-white/10 bg-black/45 p-5 md:p-6">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.8fr)_auto] xl:items-center">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={
                    isUa
                      ? "Шукай по моделі, SKU, bodykit, category..."
                      : "Search by model, SKU, bodykit, category..."
                  }
                  className="h-12 w-full rounded-full border border-white/10 bg-white/[0.04] pl-11 pr-12 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[#c29d59]/45 focus:bg-white/[0.06]"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/35 transition hover:text-white/75"
                    aria-label={isUa ? "Очистити пошук" : "Clear search"}
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </label>

              <label className="block">
                <span className="mb-2 block text-[11px] uppercase tracking-[0.22em] text-white/42">
                  {isUa ? "Сортування" : "Sort order"}
                </span>
                <select
                  value={sortOrder}
                  onChange={(event) => setSortOrder(event.target.value as SortOrder)}
                  className="h-12 w-full rounded-full border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none transition focus:border-[#c29d59]/45"
                >
                  <option value="bodykits_first" className="bg-[#0a0a0a]">
                    {isUa ? "Спочатку full bodykits" : "Full bodykits first"}
                  </option>
                  <option value="price_desc" className="bg-[#0a0a0a]">
                    {isUa ? "Спочатку дорожчі" : "Highest price first"}
                  </option>
                  <option value="price_asc" className="bg-[#0a0a0a]">
                    {isUa ? "Спочатку дешевші" : "Lowest price first"}
                  </option>
                </select>
              </label>

              <button
                type="button"
                onClick={() => setShowModelBrowser((current) => !current)}
                className="inline-flex min-h-12 items-center justify-center gap-3 rounded-full border border-white/12 bg-white/[0.04] px-5 text-xs font-medium uppercase tracking-[0.22em] text-white transition hover:border-white/24 hover:bg-white/[0.07]"
              >
                <SlidersHorizontal className="h-4 w-4 text-[#d4b06a]" />
                <span>{isUa ? "Моделі та програми" : "Models & programmes"}</span>
                <ChevronDown
                  className={`h-4 w-4 transition ${showModelBrowser ? "rotate-180" : ""}`}
                />
              </button>
            </div>

            <div className="mt-6">
              <p className="text-[11px] uppercase tracking-[0.24em] text-white/42">
                {isUa ? "Швидкий вибір сімейства" : "Quick family selection"}
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setActiveFamily("all")}
                  className={`rounded-full border px-4 py-3 text-left transition ${
                    activeFamily === "all"
                      ? "border-[#c29d59]/40 bg-[#c29d59]/16 text-white"
                      : "border-white/10 bg-white/[0.03] text-white/72 hover:border-white/20 hover:text-white"
                  }`}
                >
                  <span className="block text-[11px] uppercase tracking-[0.22em]">
                    {isUa ? "Усе" : "All"}
                  </span>
                  <span className="mt-1 block text-sm">{enrichedProducts.length}</span>
                </button>
                {familyOptions.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setActiveFamily(option.key)}
                    className={`min-w-[210px] rounded-[22px] border px-4 py-3 text-left transition ${
                      activeFamily === option.key
                        ? "border-[#c29d59]/40 bg-[#c29d59]/16 text-white"
                        : "border-white/10 bg-white/[0.03] text-white/72 hover:border-white/20 hover:text-white"
                    }`}
                  >
                    <span className="block text-[11px] uppercase tracking-[0.22em]">
                      {option.count}
                    </span>
                    <span className="mt-2 block text-sm font-medium">{option.label}</span>
                    <span className="mt-1 block text-xs leading-5 text-white/45">{option.hint}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6">
              <p className="text-[11px] uppercase tracking-[0.24em] text-white/42">
                {isUa ? "Бренд / виробник" : "Brand / manufacturer"}
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setActiveBrand("all");
                    setActiveModel("all");
                  }}
                  className={`rounded-full border px-4 py-2.5 text-xs uppercase tracking-[0.2em] transition ${
                    activeBrand === "all"
                      ? "border-[#c29d59]/40 bg-[#c29d59]/16 text-white"
                      : "border-white/10 bg-white/[0.03] text-white/72 hover:border-white/20 hover:text-white"
                  }`}
                >
                  {isUa ? "Усі бренди" : "All brands"}
                </button>
                {brandOptions.map((brand) => (
                  <button
                    key={brand.key}
                    type="button"
                    onClick={() => {
                      setActiveBrand(brand.key);
                      setActiveModel("all");
                      setShowModelBrowser(true);
                    }}
                    className={`rounded-full border px-4 py-2.5 text-xs uppercase tracking-[0.2em] transition ${
                      activeBrand === brand.key
                        ? "border-[#c29d59]/40 bg-[#c29d59]/16 text-white"
                        : "border-white/10 bg-white/[0.03] text-white/72 hover:border-white/20 hover:text-white"
                    }`}
                  >
                    {brand.label}
                    <span className="ml-2 text-white/40">{brand.count}</span>
                  </button>
                ))}
              </div>
            </div>

            {showModelBrowser ? (
              <div className="mt-6 rounded-[24px] border border-white/10 bg-black/35 p-4 md:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.22em] text-white/42">
                      {isUa ? "Браузер моделей" : "Model browser"}
                    </p>
                    <p className="mt-1 text-sm text-white/62">
                      {isUa
                        ? "Вибери модель Urban і далі звузь список по компонентам"
                        : "Pick an Urban model first, then narrow by components"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveModel("all")}
                    className="text-xs uppercase tracking-[0.2em] text-white/45 transition hover:text-white/75"
                  >
                    {isUa ? "Скинути модель" : "Clear model"}
                  </button>
                </div>

                <div className="mt-5 space-y-5">
                  {availableModelGroups.map((group) => (
                    <div key={group.brand}>
                      <div className="mb-3 flex items-center gap-3">
                        <div className="h-px flex-1 bg-white/10" />
                        <p className="text-[11px] uppercase tracking-[0.24em] text-white/42">
                          {group.brand}
                        </p>
                        <div className="h-px flex-1 bg-white/10" />
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {group.items.map((item) => (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => setActiveModel(item.key)}
                            className={`rounded-[20px] border px-4 py-4 text-left transition ${
                              activeModel === item.key
                                ? "border-[#c29d59]/40 bg-[#c29d59]/16 text-white"
                                : "border-white/10 bg-white/[0.03] text-white/72 hover:border-white/20 hover:text-white"
                            }`}
                          >
                            <span className="block text-[11px] uppercase tracking-[0.2em] text-white/42">
                              {item.count} {isUa ? "позицій" : "items"}
                            </span>
                            <span className="mt-2 block text-sm font-medium">{item.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {hasActiveFilters ? (
              <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-white/8 pt-5">
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-3 py-2 text-xs text-white/72 transition hover:border-white/22 hover:text-white"
                  >
                    <span>
                      {isUa ? "Пошук" : "Search"}: {searchQuery}
                    </span>
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
                {activeBrand !== "all" ? (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveBrand("all");
                      setActiveModel("all");
                    }}
                    className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-3 py-2 text-xs text-white/72 transition hover:border-white/22 hover:text-white"
                  >
                    <span>{activeBrand}</span>
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
                {currentModelLabel ? (
                  <button
                    type="button"
                    onClick={() => setActiveModel("all")}
                    className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-3 py-2 text-xs text-white/72 transition hover:border-white/22 hover:text-white"
                  >
                    <span>{currentModelLabel}</span>
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
                {activeFamily !== "all" ? (
                  <button
                    type="button"
                    onClick={() => setActiveFamily("all")}
                    className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-3 py-2 text-xs text-white/72 transition hover:border-white/22 hover:text-white"
                  >
                    <span>{isUa ? FAMILY_LABELS[activeFamily].ua : FAMILY_LABELS[activeFamily].en}</span>
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
                {sortOrder !== "bodykits_first" ? (
                  <button
                    type="button"
                    onClick={() => setSortOrder("bodykits_first")}
                    className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-3 py-2 text-xs text-white/72 transition hover:border-white/22 hover:text-white"
                  >
                    <span>
                      {sortOrder === "price_desc"
                        ? isUa
                          ? "Дорожчі спочатку"
                          : "Highest first"
                        : isUa
                          ? "Дешевші спочатку"
                          : "Lowest first"}
                    </span>
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={resetFilters}
                  className="ml-auto inline-flex items-center gap-2 rounded-full border border-[#c29d59]/26 bg-[#c29d59]/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.2em] text-[#ead29d] transition hover:border-[#c29d59]/45 hover:bg-[#c29d59]/16"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  {isUa ? "Скинути все" : "Reset all"}
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-white/38">
              {isUa ? "Результати каталогу" : "Catalog results"}
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white md:text-3xl">
              {filteredProducts.length} {isUa ? "позицій для" : "items for"} {resultLabel}
            </h2>
            <p className="mt-2 text-sm text-white/58">
              {isUa
                ? "Bodykits і програми мають окремий пріоритетний блок. Далі йдуть компоненти, відсортовані по сімейству та моделі."
                : "Bodykits and complete programmes live in their own priority block. Components follow after that, sorted by family and model."}
            </p>
          </div>
          <Link
            href={`/${locale}/shop/urban/collections`}
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/12 px-5 text-xs font-medium uppercase tracking-[0.2em] text-white/72 transition hover:border-white/24 hover:text-white"
          >
            {isUa ? "Перейти до всіх моделей Urban" : "Browse Urban models"}
          </Link>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="mt-8 rounded-[28px] border border-white/10 bg-white/[0.03] p-8 text-center">
            <p className="text-[11px] uppercase tracking-[0.24em] text-white/40">
              {isUa ? "Нічого не знайдено" : "No matching products"}
            </p>
            <h3 className="mt-3 text-2xl font-semibold text-white">
              {isUa
                ? "Спробуй іншу модель, сімейство або пошук по SKU"
                : "Try a different model, family, or SKU search"}
            </h3>
            <p className="mx-auto mt-3 max-w-[720px] text-sm leading-7 text-white/58">
              {isUa
                ? "Поточна комбінація фільтрів нічого не дала. Найкращий наступний крок: скинь модель або залиш тільки бренд, а потім звужуй список."
                : "The current filter combination returned nothing. Best next step: clear the model or keep only the brand, then narrow the list again."}
            </p>
            <button
              type="button"
              onClick={resetFilters}
              className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-[#f3f0e8] px-6 text-xs font-semibold uppercase tracking-[0.2em] text-black transition hover:bg-white"
            >
              {isUa ? "Скинути фільтри" : "Reset filters"}
            </button>
          </div>
        ) : activeFamily === "all" && featuredBodykits.length > 0 ? (
          <div className="mt-8 space-y-10">
            <section>
              <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.24em] text-[#d4b06a]">
                    {isUa ? "Пріоритетна зона" : "Priority zone"}
                  </p>
                  <h3 className="mt-2 text-2xl font-semibold text-white">
                    {isUa ? "Повні bodykits та Urban програми" : "Complete bodykits and Urban programmes"}
                  </h3>
                  <p className="mt-2 text-sm text-white/58">
                    {isUa
                      ? "Це те, з чого логічно починати вибір. Спочатку програма для конкретної моделі, потім окремі компоненти."
                      : "This is the right place to start. Choose the programme for the vehicle first, then move to separate components."}
                  </p>
                </div>
                <div className="rounded-full border border-[#c29d59]/22 bg-[#c29d59]/10 px-4 py-2 text-xs uppercase tracking-[0.22em] text-[#ead29d]">
                  {featuredBodykits.length} {isUa ? "позицій" : "items"}
                </div>
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
                <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.24em] text-white/38">
                      {isUa ? "Далі по компонентах" : "Then move to components"}
                    </p>
                    <h3 className="mt-2 text-2xl font-semibold text-white">
                      {isUa ? "Решта каталогу" : "The rest of the catalog"}
                    </h3>
                    <p className="mt-2 text-sm text-white/58">
                      {isUa
                        ? "Після full kits тут уже спойлери, диски, вихлоп, інтер'єр та аксесуари."
                        : "After the full kits, this section covers spoilers, wheels, exhaust, interior, and accessories."}
                    </p>
                  </div>
                  <div className="rounded-full border border-white/12 bg-white/[0.03] px-4 py-2 text-xs uppercase tracking-[0.22em] text-white/58">
                    {componentProducts.length} {isUa ? "позицій" : "items"}
                  </div>
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
                featured={entry.family === "bodykits" && sortOrder === "bodykits_first"}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
