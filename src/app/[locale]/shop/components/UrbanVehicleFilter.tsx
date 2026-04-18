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

type PremiumComboboxOption = {
  value: string;
  label: string;
  searchText?: string;
};

type PremiumComboboxGroup = {
  label?: string;
  options: PremiumComboboxOption[];
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

const BRAND_ORDER = new Map<string, number>(
  URBAN_COLLECTION_BRANDS.map((brand, index) => [brand, index])
);

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
        className={`flex min-h-[66px] w-full items-center justify-between gap-4 rounded-[18px] border px-5 py-4 text-left transition ${
          open
            ? "border-[#c29d59]/35 bg-[#111111] shadow-[0_20px_50px_rgba(0,0,0,0.22)]"
            : "border-white/10 bg-[#101010] hover:border-white/18 hover:bg-[#121212]"
        }`}
      >
        <span className="min-w-0">
          <span className="block text-[10px] uppercase text-white/34">{label}</span>
          <span className={`mt-1 block truncate text-[15px] ${selectedOption ? "text-white" : "text-white/42"}`}>
            {selectedOption?.label ?? placeholder}
          </span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-white/45 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <div className="absolute left-0 right-0 top-[calc(100%+12px)] z-[70] overflow-hidden rounded-[20px] border border-white/10 bg-[#0a0a0a] shadow-[0_28px_80px_rgba(0,0,0,0.55)]">
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
  const [activeModel, setActiveModel] = useState<string>("all");
  const [activeFamily, setActiveFamily] = useState<FamilyFilter>("all");

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

  const scopedProducts = useMemo(() => {
    return enrichedProducts.filter((entry) => {
      if (activeModel !== "all" && entry.modelHandle !== activeModel) return false;
      return true;
    });
  }, [activeModel, enrichedProducts]);

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
  }, [activeFamily, locale, scopedProducts]);

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
  const hasActiveFilters = activeModel !== "all" || activeFamily !== "all";

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

  const categoryComboboxGroups = useMemo<PremiumComboboxGroup[]>(
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

  function resetFilters() {
    setActiveModel("all");
    setActiveFamily("all");
  }

  return (
    <section className="pb-16 md:pb-24">
      <div className="mx-auto w-full max-w-[1720px] px-6 md:px-12 lg:px-16">
        <div className="overflow-visible rounded-[32px] border border-white/10 bg-[#060606] shadow-[0_24px_90px_rgba(0,0,0,0.32)]">
          <div className="border-b border-white/8 px-6 py-6 md:px-8 lg:px-10">
            <div>
              <p className="text-[10px] font-medium uppercase text-[#c29d59]">Urban Automotive</p>
              <h1 className="mt-3 text-balance text-[30px] font-semibold leading-[1] text-white md:text-[38px]">
                {isUa ? "Каталог Urban" : "Urban Catalog"}
              </h1>
            </div>
          </div>

          <div className="px-6 py-6 md:px-8 md:py-7 lg:px-10">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1.25fr)_minmax(0,0.95fr)_auto]">
              <PremiumCombobox
                label={isUa ? "Автомобіль" : "Vehicle"}
                placeholder={isUa ? "Вибрати авто" : "Choose vehicle"}
                value={activeModel}
                onChange={setActiveModel}
                groups={modelComboboxGroups}
                allLabel={isUa ? "Усі автомобілі" : "All vehicles"}
              />
              <PremiumCombobox
                label={isUa ? "Категорія" : "Category"}
                placeholder={isUa ? "Усі категорії" : "All categories"}
                value={activeFamily}
                onChange={(value) => setActiveFamily(value as FamilyFilter)}
                groups={categoryComboboxGroups}
                allLabel={isUa ? "Усі категорії" : "All categories"}
              />
              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex min-h-[68px] items-center justify-center gap-2 rounded-[24px] border border-[#c29d59]/26 bg-[#c29d59]/10 px-5 text-sm font-medium text-[#ead29d] transition hover:border-[#c29d59]/45 hover:bg-[#c29d59]/16"
                >
                  <RotateCcw className="h-4 w-4" />
                  {isUa ? "Скинути" : "Reset"}
                </button>
              ) : null}
            </div>

            {hasActiveFilters ? (
              <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-white/8 pt-5">
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
              </div>
            ) : null}
          </div>
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
        ) : activeFamily === "all" && featuredBodykits.length > 0 ? (
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
