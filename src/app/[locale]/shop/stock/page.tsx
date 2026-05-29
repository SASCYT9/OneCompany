"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  Suspense,
  type KeyboardEvent,
} from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ChevronDown,
  Check,
  Loader2,
  Package,
  Search,
  Sparkles,
  X,
  LayoutGrid,
  List,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { AddToCartButton } from "@/components/shop/AddToCartButton";
import { ShopProductImage } from "@/components/shop/ShopProductImage";
import { useShopCurrency } from "@/components/shop/CurrencyContext";
import {
  buildShopStorefrontProductPath,
  resolveShopStorefrontSegment,
} from "@/lib/shopStorefrontRouting";
import { SHOW_STOCK_BADGE } from "@/lib/shopStockUi";

/* ============================================================
   B2B Склад — unified product browsing for dealers.

   Design goals (2026-05-20):
   - Theme-aware: uses --background / --foreground / --card / --border /
     --primary / --muted-foreground tokens. No `bg-[#050505]`, no zinc.
   - Single product feed: no "Наш каталог / Turn14" tabs — clients should
     not be exposed to internal sourcing details.
   - Click-through to detail pages via buildShopStorefrontProductPath.
   - Toolbar with type-to-search brand combobox, sort, in-stock toggle.
   - Personalized welcome bar from real NextAuth session (no mock data).
   ============================================================ */

type StockItem = {
  id: string;
  name: string;
  brand: string;
  partNumber: string;
  description: string;
  thumbnail: string | null;
  inStock: boolean;
  price: number | null;
  originalPrice?: number | null;
  basePrice: number;
  markupPct: number;
  turn14Id: string;
  slug?: string;
  vendor?: string | null;
  tags?: string[];
  source: "shop" | "turn14" | "local";
};

type BrandOption = { name: string; count: number };
type FitmentOption = { slug: string; label: string; count: number };

type SortMode = "newest" | "price-asc" | "price-desc" | "name-asc";
const SORT_VALUES: SortMode[] = ["newest", "price-asc", "price-desc", "name-asc"];
function parseSort(value: string | null | undefined): SortMode {
  const v = String(value || "").toLowerCase();
  return (SORT_VALUES as string[]).includes(v) ? (v as SortMode) : "newest";
}

/* ─── Currency formatter — converts API's USD price to active currency ───
 *
 * The /api/shop/stock/search response always carries `price` as USD
 * (handleShopSearch picks USD first, then falls back to EUR or UAH-derived
 * USD). Here we convert that USD amount into whatever currency the user
 * picked in the global Header (UAH / EUR / USD) using NBU rates loaded by
 * `useShopCurrency()`.
 *
 * `rates` is EUR-based:
 *   rates.EUR = 1, rates.USD ≈ 1.08, rates.UAH ≈ 41.5
 * Conversion chain: usd → eur (÷ rates.USD) → uah (× rates.UAH).
 */
type Currency = "USD" | "EUR" | "UAH";
type Rates = { EUR: number; USD: number; UAH: number } | null | undefined;

function convertFromUsd(usdAmount: number, currency: Currency, rates: Rates): number {
  if (!Number.isFinite(usdAmount) || usdAmount <= 0) return 0;
  if (currency === "USD") return usdAmount;
  if (!rates || rates.USD <= 0) return usdAmount; // no rates → fall back to USD
  const eurAmount = usdAmount / rates.USD;
  if (currency === "EUR") return eurAmount;
  if (currency === "UAH" && rates.UAH > 0) return eurAmount * rates.UAH;
  return usdAmount;
}

function formatPrice(
  usdAmount: number,
  locale: string,
  currency: Currency = "USD",
  rates: Rates = null
) {
  const converted = convertFromUsd(usdAmount, currency, rates);
  const formatter = new Intl.NumberFormat(locale === "ua" ? "uk-UA" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  });
  return formatter.format(converted);
}

/* ─── Brand combobox — type-to-search dropdown ─────────────── */

function BrandCombobox({
  options,
  value,
  onChange,
  placeholder,
  clearLabel,
  ariaLabel,
}: {
  options: BrandOption[];
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  clearLabel: string;
  ariaLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [highlightIdx, setHighlightIdx] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = filter
    ? options.filter((o) => o.name.toLowerCase().includes(filter.toLowerCase()))
    : options;

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setFilter("");
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    setHighlightIdx(0);
  }, [filter, open]);

  function selectAt(idx: number) {
    if (idx < 0) {
      onChange("");
    } else {
      const opt = filtered[idx];
      if (!opt) return;
      onChange(opt.name);
    }
    setOpen(false);
    setFilter("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlightIdx((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (open) selectAt(highlightIdx);
      else setOpen(true);
    } else if (e.key === "Escape") {
      setOpen(false);
      setFilter("");
    } else if (e.key === "Backspace" && !filter && value) {
      onChange("");
    }
  }

  const inputValue = open ? filter : value;

  return (
    <div ref={rootRef} className="relative w-full sm:w-[220px]">
      <div
        className={`flex items-center rounded-[4px] border bg-card/60 backdrop-blur-sm text-foreground h-11 px-3 transition-all duration-300 ${
          open
            ? "border-foreground/40 ring-1 ring-foreground/15"
            : value
              ? "border-foreground/30"
              : "border-border/60 hover:border-foreground/35"
        }`}
        onClick={() => {
          setOpen(true);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
      >
        {value && !open && <Check className="w-3.5 h-3.5 text-foreground mr-2 shrink-0" />}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            setFilter(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={value && !open ? value : placeholder}
          aria-label={ariaLabel}
          className="w-full bg-transparent text-[10px] uppercase tracking-[0.2em] text-foreground placeholder:text-muted-foreground/60 focus:outline-none cursor-pointer"
        />
        {value && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
              setFilter("");
              setOpen(false);
            }}
            className="p-0.5 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Clear brand"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        <ChevronDown
          className={`w-3.5 h-3.5 text-muted-foreground ml-2 shrink-0 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="absolute z-50 top-full left-0 right-0 mt-1.5 rounded-[4px] border border-border/80 bg-popover/95 backdrop-blur-xl text-popover-foreground max-h-72 overflow-y-auto shadow-2xl scrollbar-thin scrollbar-thumb-border/40 scrollbar-track-transparent"
          >
            <button
              type="button"
              onClick={() => selectAt(-1)}
              className={`w-full text-left text-[10px] uppercase tracking-[0.2em] px-4 py-3 transition-colors border-b border-border/60 ${
                !value
                  ? "bg-foreground/5 text-foreground font-semibold"
                  : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
              }`}
            >
              {clearLabel}
            </button>
            {filtered.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                {filter ? `No match for "${filter}"` : "—"}
              </div>
            ) : (
              filtered.map((opt, i) => (
                <button
                  key={opt.name}
                  type="button"
                  onMouseEnter={() => setHighlightIdx(i)}
                  onClick={() => selectAt(i)}
                  className={`w-full flex items-center justify-between text-left text-[11px] uppercase tracking-[0.1em] px-4 py-2.5 transition-colors ${
                    i === highlightIdx
                      ? "bg-foreground/5 text-foreground font-medium"
                      : value === opt.name
                        ? "bg-foreground/10 text-foreground font-semibold"
                        : "text-foreground/80 hover:bg-foreground/5"
                  }`}
                >
                  <span className="truncate">{opt.name}</span>
                  {opt.count > 0 && (
                    <span className="ml-3 text-[9px] font-mono text-muted-foreground shrink-0 bg-foreground/5 px-1.5 py-0.5 rounded border border-border/40">
                      {opt.count.toLocaleString()}
                    </span>
                  )}
                </button>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Welcome bar — real session data ────────────────────────── */

function WelcomeBar({ isUa }: { isUa: boolean }) {
  const { data: session, status } = useSession();
  if (status !== "authenticated" || !session?.user) return null;
  const user = session.user as {
    firstName?: string;
    lastName?: string;
    email?: string;
    group?: string;
    b2bDiscountPercent?: number | null;
    companyName?: string | null;
  };
  const greetingName = user.firstName || (user.email ? user.email.split("@")[0] : null) || "Dealer";
  const isApproved = user.group === "B2B_APPROVED";
  const isPending = user.group === "B2B_PENDING";
  const discount = user.b2bDiscountPercent ?? 0;
  return (
    <div className="max-w-[1400px] mx-auto px-6 mt-8">
      <div className="glass-panel relative overflow-hidden rounded-[6px] p-6 shadow-xl">
        {/* Subtle top edge shimmer */}
        <div className="absolute top-0 inset-x-0 shimmer-line opacity-40" />

        {/* Glow effect */}
        <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-gradient-to-bl from-foreground/5 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-[4px] bg-foreground/5 border border-border flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-foreground" />
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-[0.24em] text-muted-foreground font-medium">
                {isUa ? "Кабінет Дилера" : "Dealer Space"}
              </p>
              <h2 className="text-lg font-display tracking-tight text-foreground mt-0.5">
                {isUa ? "Вітаємо" : "Welcome"},{" "}
                <span className="font-semibold text-foreground">{greetingName}</span>
                {user.companyName ? (
                  <span className="text-muted-foreground font-normal"> · {user.companyName}</span>
                ) : null}
              </h2>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {isApproved && (
              <span className="inline-flex items-center gap-2 rounded-[4px] border border-foreground/20 bg-foreground/5 px-3.5 py-1.5 text-[9px] uppercase tracking-[0.2em] font-semibold text-foreground">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                B2B Partner
              </span>
            )}
            {isPending && (
              <span className="inline-flex items-center gap-2 rounded-[4px] border border-border bg-muted px-3.5 py-1.5 text-[9px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">
                {isUa ? "B2B на розгляді" : "B2B Pending"}
              </span>
            )}
            {discount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-[4px] border border-foreground/20 bg-foreground/5 px-3.5 py-1.5 text-[9px] uppercase tracking-[0.2em] font-semibold text-foreground">
                {isUa ? "Знижка" : "Discount"}: −{discount}%
              </span>
            )}
            <Link
              href={`/${isUa ? "ua" : "en"}/shop/account`}
              className="inline-flex items-center justify-center rounded-[4px] border border-border bg-card px-4 py-1.5 h-9 text-[9px] uppercase tracking-[0.2em] text-foreground hover:bg-foreground/5 hover:border-foreground/40 hover:text-foreground transition-all duration-300"
            >
              {isUa ? "Кабінет →" : "Dashboard →"}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Vehicle filter — cascading Make → Model → Trim ─────────── */

function VehicleFilter({
  locale,
  make,
  model,
  trim,
  onChange,
}: {
  locale: string;
  make: string;
  model: string;
  trim: string;
  onChange: (next: { make: string; model: string; trim: string }) => void;
}) {
  const isUa = locale === "ua";
  const [makes, setMakes] = useState<FitmentOption[]>([]);
  const [models, setModels] = useState<FitmentOption[]>([]);
  const [trims, setTrims] = useState<FitmentOption[]>([]);
  const [loadingMakes, setLoadingMakes] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [loadingTrims, setLoadingTrims] = useState(false);

  useEffect(() => {
    setLoadingMakes(true);
    fetch("/api/shop/stock/fitments")
      .then((r) => r.json())
      .then((res) => setMakes(res.data || []))
      .catch(() => setMakes([]))
      .finally(() => setLoadingMakes(false));
  }, []);

  useEffect(() => {
    if (!make) {
      setModels([]);
      return;
    }
    setLoadingModels(true);
    fetch(`/api/shop/stock/fitments?make=${encodeURIComponent(make)}`)
      .then((r) => r.json())
      .then((res) => setModels(res.data || []))
      .catch(() => setModels([]))
      .finally(() => setLoadingModels(false));
  }, [make]);

  useEffect(() => {
    if (!make || !model) {
      setTrims([]);
      return;
    }
    setLoadingTrims(true);
    fetch(
      `/api/shop/stock/fitments?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`
    )
      .then((r) => r.json())
      .then((res) => setTrims(res.data || []))
      .catch(() => setTrims([]))
      .finally(() => setLoadingTrims(false));
  }, [make, model]);

  const hasSelection = Boolean(make || model || trim);

  return (
    <div className="flex flex-col sm:flex-row items-stretch gap-2 w-full">
      <FitmentSelect
        value={make}
        options={makes}
        loading={loadingMakes}
        placeholder={isUa ? "Марка" : "Make"}
        onChange={(slug) => onChange({ make: slug, model: "", trim: "" })}
        disabled={false}
      />
      <FitmentSelect
        value={model}
        options={models}
        loading={loadingModels}
        placeholder={isUa ? "Модель" : "Model"}
        onChange={(slug) => onChange({ make, model: slug, trim: "" })}
        disabled={!make}
      />
      <FitmentSelect
        value={trim}
        options={trims}
        loading={loadingTrims}
        placeholder={isUa ? "Кузов" : "Trim"}
        onChange={(slug) => onChange({ make, model, trim: slug })}
        disabled={!model || trims.length === 0}
      />
      {hasSelection && (
        <button
          type="button"
          onClick={() => onChange({ make: "", model: "", trim: "" })}
          className="inline-flex items-center justify-center gap-1 rounded-[4px] border border-border bg-foreground/5 text-foreground hover:bg-foreground/10 hover:border-foreground/30 h-11 px-3 text-[10px] uppercase tracking-[0.2em] transition-colors"
          title={isUa ? "Скинути авто" : "Reset vehicle"}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

function FitmentSelect({
  value,
  options,
  loading,
  placeholder,
  onChange,
  disabled,
}: {
  value: string;
  options: FitmentOption[];
  loading: boolean;
  placeholder: string;
  onChange: (slug: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="relative flex-1 min-w-[120px]">
      <select
        value={value}
        disabled={disabled || loading}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full appearance-none rounded-[4px] border bg-card/60 backdrop-blur-sm text-[10px] uppercase tracking-[0.2em] h-11 pl-3 pr-8 cursor-pointer focus:outline-none focus:border-foreground/40 focus:ring-1 focus:ring-foreground/15 transition-all duration-300 ${
          value
            ? "border-foreground/30 text-foreground"
            : disabled
              ? "border-border/40 text-muted-foreground/30 cursor-not-allowed"
              : "border-border/60 text-muted-foreground/60 hover:text-foreground hover:border-foreground/30"
        }`}
      >
        <option value="">{loading ? "…" : placeholder}</option>
        {options.map((opt) => (
          <option key={opt.slug} value={opt.slug}>
            {opt.label} {opt.count > 0 ? `(${opt.count})` : ""}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
    </div>
  );
}

/* ─── Product card ───────────────────────────────────────────── */

function ProductCard({ item, locale }: { item: StockItem; locale: string }) {
  // Active currency from global Header switcher (UAH/EUR/USD). API gives
  // us `item.price` in USD; this hook lets us re-format in the user-chosen
  // currency without an extra round-trip.
  const { currency, rates } = useShopCurrency();
  const isUa = locale === "ua";
  // ShopProduct items resolve to a per-brand storefront, BUT only when the
  // brand actually has a `/shop/{slug}/...` route. REMUS (and any future
  // B2B-only brand without a public store) lacks that route — without this
  // guard the link would 404. resolveShopStorefrontSegment returns null
  // when there's no registered segment for the brand.
  const shopSegment =
    item.source === "shop" && item.slug
      ? resolveShopStorefrontSegment({
          brand: item.brand,
          vendor: item.vendor ?? null,
          tags: item.tags ?? [],
        })
      : null;
  const detailHref =
    item.source === "shop" && item.slug && shopSegment
      ? buildShopStorefrontProductPath(locale, {
          slug: item.slug,
          brand: item.brand,
          vendor: item.vendor ?? null,
          tags: item.tags ?? [],
        })
      : item.source === "turn14"
        ? `/${locale}/shop/stock/${item.turn14Id || item.id}`
        : null;

  const dealerPrice = item.price ?? null;
  const msrp = item.originalPrice && item.originalPrice !== dealerPrice ? item.originalPrice : null;

  const titleNode = (
    <h3 className="text-sm font-medium text-foreground leading-snug line-clamp-2 transition-colors group-hover:text-foreground/95">
      {item.name}
    </h3>
  );

  const imageNode = (
    <div className="aspect-square rounded-[6px] bg-surface-elevated overflow-hidden flex items-center justify-center relative">
      {/* Radial background highlight glow on hover */}
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-foreground/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

      {item.thumbnail ? (
        <ShopProductImage
          src={item.thumbnail}
          alt={item.name}
          width={400}
          height={400}
          className="w-full h-full object-contain p-5 transition-transform duration-500 ease-out group-hover:scale-105"
          unoptimized
        />
      ) : (
        <Package className="w-12 h-12 text-muted-foreground/40" />
      )}
      {SHOW_STOCK_BADGE && item.inStock && (
        <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-[4px] bg-background/80 backdrop-blur-md border border-emerald-500/20 px-2 py-0.5 text-[9px] uppercase tracking-[0.18em] text-emerald-400 font-medium z-10">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          {isUa ? "В наявності" : "In Stock"}
        </span>
      )}
    </div>
  );

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="product-card-premium group relative flex flex-col rounded-[6px] border border-border/40 bg-card p-4 transition-all duration-300 hover:border-foreground/20 hover:shadow-2xl"
    >
      {detailHref ? (
        <Link href={detailHref} aria-label={item.name} className="block">
          {imageNode}
        </Link>
      ) : (
        imageNode
      )}

      <div className="mt-4 flex-1 flex flex-col gap-2">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          <span className="truncate max-w-[60%] tracking-[0.12em] group-hover:text-foreground transition-colors">
            {item.brand}
          </span>
          {item.partNumber && (
            <span className="font-mono lowercase tracking-tight opacity-75">
              #{item.partNumber}
            </span>
          )}
        </div>
        {detailHref ? (
          <Link href={detailHref} className="block">
            {titleNode}
          </Link>
        ) : (
          titleNode
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-border space-y-3">
        {dealerPrice != null ? (
          <div className="flex items-end justify-between gap-3">
            <div className="space-y-0.5">
              {msrp && (
                <>
                  <div className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                    {isUa ? "РРЦ" : "MSRP"}
                  </div>
                  <div className="text-xs text-muted-foreground line-through">
                    {formatPrice(msrp, locale, currency, rates)}
                  </div>
                </>
              )}
            </div>
            <div className="text-right space-y-0.5">
              <div className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground/80 font-semibold">
                {isUa ? "Ваша ціна" : "Your price"}
              </div>
              <div className="text-2xl font-semibold text-foreground tracking-tight tabular-nums">
                {formatPrice(dealerPrice, locale, currency, rates)}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-right">
            <div className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
              {isUa ? "Ціна" : "Pricing"}
            </div>
            <div className="text-lg font-light text-foreground tracking-tight">
              {isUa ? "За запитом" : "On request"}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          {detailHref && (
            <Link
              href={detailHref}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-[4px] border border-border bg-card px-3 py-2.5 text-[10px] uppercase tracking-[0.18em] text-foreground hover:bg-foreground/5 hover:border-foreground/30 hover:text-foreground transition-all duration-300"
            >
              {isUa ? "Деталі" : "Details"} →
            </Link>
          )}
          <AddToCartButton
            slug={item.source === "shop" ? item.slug : undefined}
            turn14Id={item.source === "turn14" ? item.turn14Id || item.id : undefined}
            locale={locale}
            variant="minimal"
            redirect={false}
            productName={item.name}
            label={
              dealerPrice == null
                ? isUa
                  ? "Запит ціни"
                  : "Request quote"
                : isUa
                  ? "Додати"
                  : "Add"
            }
            labelAdded={
              dealerPrice == null
                ? isUa
                  ? "Запит надіслано ✓"
                  : "Quote requested ✓"
                : isUa
                  ? "В кошику ✓"
                  : "In cart ✓"
            }
            className={`${detailHref ? "" : "flex-1"} inline-flex items-center justify-center gap-1.5 rounded-[4px] px-4 py-2.5 text-[10px] uppercase tracking-[0.18em] font-semibold active:scale-[0.98] transition-all duration-300 ${
              dealerPrice == null
                ? "border border-border bg-card text-foreground hover:border-foreground/30 hover:text-foreground hover:bg-foreground/5"
                : "bg-foreground text-background hover:bg-foreground/90 hover:shadow-lg hover:shadow-foreground/5"
            }`}
          />
        </div>
      </div>
    </motion.article>
  );
}

/* ─── Compact Product List Item ────────────────────────────────── */

function ProductListItem({ item, locale }: { item: StockItem; locale: string }) {
  const isUa = locale === "ua";
  // Same conversion path as ProductCard — `item.price` is USD from the API.
  const { currency, rates } = useShopCurrency();
  const shopSegment =
    item.source === "shop" && item.slug
      ? resolveShopStorefrontSegment({
          brand: item.brand,
          vendor: item.vendor ?? null,
          tags: item.tags ?? [],
        })
      : null;

  const detailHref =
    item.source === "shop" && item.slug && shopSegment
      ? buildShopStorefrontProductPath(locale, {
          slug: item.slug,
          brand: item.brand,
          vendor: item.vendor ?? null,
          tags: item.tags ?? [],
        })
      : item.source === "turn14"
        ? `/${locale}/shop/stock/${item.turn14Id || item.id}`
        : null;

  const dealerPrice = item.price ?? null;
  const msrp = item.originalPrice && item.originalPrice !== dealerPrice ? item.originalPrice : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-4 p-4 lg:p-3 rounded-[6px] border border-border/40 bg-card hover:border-foreground/20 hover:bg-foreground/[0.01] transition-all"
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Thumbnail */}
        <div className="w-12 h-12 rounded-[4px] bg-surface-elevated overflow-hidden flex items-center justify-center shrink-0 border border-border/40 relative">
          {item.thumbnail ? (
            <ShopProductImage
              src={item.thumbnail}
              alt={item.name}
              width={80}
              height={80}
              className="w-full h-full object-contain p-1"
              unoptimized
            />
          ) : (
            <Package className="w-5 h-5 text-muted-foreground/30" />
          )}
        </div>

        {/* Brand & Part Number + Name */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="text-[10px] uppercase tracking-[0.15em] font-semibold text-foreground">
              {item.brand}
            </span>
            {item.partNumber && (
              <span className="font-mono text-[10px] text-muted-foreground select-all">
                #{item.partNumber}
              </span>
            )}
          </div>
          <div className="mt-1">
            {detailHref ? (
              <Link
                href={detailHref}
                className="text-xs text-foreground font-medium hover:text-foreground/80 transition-colors line-clamp-2 lg:line-clamp-1"
              >
                {item.name}
              </Link>
            ) : (
              <span className="text-xs text-foreground font-medium line-clamp-2 lg:line-clamp-1">
                {item.name}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between lg:justify-end gap-x-4 gap-y-3 pt-3 lg:pt-0 border-t border-border/40 lg:border-t-0 shrink-0">
        {/* In Stock Badge */}
        <div className="w-28 shrink-0 flex items-center">
          {SHOW_STOCK_BADGE && item.inStock ? (
            <span className="inline-flex items-center gap-1.5 rounded-[4px] bg-emerald-500/5 border border-emerald-500/10 px-2 py-0.5 text-[9px] uppercase tracking-[0.15em] text-emerald-400 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {isUa ? "В наявності" : "In Stock"}
            </span>
          ) : (
            <span className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground/60">
              {isUa ? "Немає" : "Out of Stock"}
            </span>
          )}
        </div>

        {/* MSRP */}
        <div className="w-20 lg:w-24 shrink-0 text-left lg:text-right">
          <span className="text-[9px] block lg:hidden text-muted-foreground/60 uppercase tracking-[0.1em] mb-0.5 leading-none">
            {isUa ? "РРЦ" : "MSRP"}
          </span>
          {msrp ? (
            <div className="text-[11px] text-muted-foreground line-through tabular-nums">
              {formatPrice(msrp, locale, currency, rates)}
            </div>
          ) : (
            <span className="text-[10px] text-muted-foreground/40">—</span>
          )}
        </div>

        {/* Dealer Price */}
        <div className="w-24 lg:w-32 shrink-0 text-left lg:text-right">
          <span className="text-[9px] block lg:hidden text-muted-foreground/60 uppercase tracking-[0.1em] mb-0.5 leading-none">
            {isUa ? "Ваша ціна" : "Your price"}
          </span>
          {dealerPrice != null ? (
            <div className="tabular-nums">
              <span className="hidden lg:block text-[9px] text-muted-foreground/60 uppercase tracking-[0.1em] mb-0.5 leading-none">
                {isUa ? "Дилерська" : "Dealer"}
              </span>
              <span className="text-xs lg:text-sm font-semibold text-foreground">
                {formatPrice(dealerPrice, locale, currency, rates)}
              </span>
            </div>
          ) : (
            <span className="text-xs font-light text-muted-foreground">
              {isUa ? "За запитом" : "On request"}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="w-full sm:w-auto lg:w-48 shrink-0 flex items-center gap-2 justify-end">
          {detailHref && (
            <Link
              href={detailHref}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center rounded-[4px] border border-border bg-card px-2.5 py-1.5 text-[9px] uppercase tracking-[0.15em] text-foreground hover:bg-foreground/5 hover:border-foreground/30 hover:text-foreground transition-all"
            >
              {isUa ? "Деталі" : "Details"}
            </Link>
          )}
          <AddToCartButton
            slug={item.source === "shop" ? item.slug : undefined}
            turn14Id={item.source === "turn14" ? item.turn14Id || item.id : undefined}
            locale={locale}
            variant="minimal"
            redirect={false}
            productName={item.name}
            label={dealerPrice == null ? (isUa ? "Запит" : "Quote") : isUa ? "Додати" : "Add"}
            labelAdded={
              dealerPrice == null
                ? isUa
                  ? "Надіслано ✓"
                  : "Sent ✓"
                : isUa
                  ? "В кошику ✓"
                  : "In cart ✓"
            }
            className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1 rounded-[4px] px-3 py-1.5 text-[9px] uppercase tracking-[0.15em] font-semibold active:scale-[0.98] transition-all ${
              dealerPrice == null
                ? "border border-border bg-card text-foreground hover:border-foreground/30 hover:text-foreground hover:bg-foreground/5"
                : "bg-foreground text-background hover:bg-foreground/90"
            }`}
          />
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Page content ──────────────────────────────────────────── */

function StockPageContent() {
  const params = useParams<{ locale: string }>();
  const locale = params?.locale === "ua" ? "ua" : "en";
  const isUa = locale === "ua";
  const router = useRouter();
  const searchParams = useSearchParams();
  // Active display currency from global Header (UAH / EUR / USD).
  // The API returns `price` in USD; we convert here via NBU rates.
  const { currency, rates } = useShopCurrency();

  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  useEffect(() => {
    const saved = localStorage.getItem("onecompany-stock-viewmode");
    if (saved === "list" || saved === "grid") {
      setViewMode(saved);
    }
  }, []);

  const changeViewMode = (mode: "grid" | "list") => {
    setViewMode(mode);
    localStorage.setItem("onecompany-stock-viewmode", mode);
  };

  // Search state — initial value from URL so `?q=brake&brand=Brembo` is shareable.
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [brand, setBrand] = useState(searchParams.get("brand") ?? "");
  const [sort, setSort] = useState<SortMode>(parseSort(searchParams.get("sort")));
  const [inStockOnly, setInStockOnly] = useState(
    searchParams.get("inStock") === "1" || searchParams.get("inStock") === "true"
  );
  // Vehicle cascade (Make → Model → Trim slugs).
  const [vMake, setVMake] = useState((searchParams.get("make") ?? "").toLowerCase());
  const [vModel, setVModel] = useState((searchParams.get("model") ?? "").toLowerCase());
  const [vTrim, setVTrim] = useState((searchParams.get("trim") ?? "").toLowerCase());

  const [items, setItems] = useState<StockItem[]>([]);
  const [brands, setBrands] = useState<BrandOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(Math.max(1, Number(searchParams.get("page")) || 1));
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Cmd/Ctrl-K → focus search input.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Load brand list (single source — "all" — since UI no longer exposes
  // per-source tabs).
  useEffect(() => {
    fetch("/api/shop/stock/brands?source=all")
      .then((r) => r.json())
      .then((res) => setBrands(res.data || []))
      .catch(() => setBrands([]));
  }, []);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("source", "all");
    if (query) params.set("q", query);
    if (brand) params.set("brand", brand);
    if (sort !== "newest") params.set("sort", sort);
    if (inStockOnly) params.set("inStock", "1");
    if (vMake) params.set("make", vMake);
    if (vModel) params.set("model", vModel);
    if (vTrim) params.set("trim", vTrim);
    params.set("page", String(page));
    return params.toString();
  }, [query, brand, sort, inStockOnly, vMake, vModel, vTrim, page]);

  // Sync URL state (browser back/forward + shareable links) — debounced.
  useEffect(() => {
    const t = setTimeout(() => {
      const url = new URL(window.location.href);
      const sp = new URLSearchParams();
      if (query) sp.set("q", query);
      if (brand) sp.set("brand", brand);
      if (sort !== "newest") sp.set("sort", sort);
      if (inStockOnly) sp.set("inStock", "1");
      if (vMake) sp.set("make", vMake);
      if (vModel) sp.set("model", vModel);
      if (vTrim) sp.set("trim", vTrim);
      if (page > 1) sp.set("page", String(page));
      const next = sp.toString();
      const target = next ? `${url.pathname}?${next}` : url.pathname;
      router.replace(target, { scroll: false });
    }, 250);
    return () => clearTimeout(t);
  }, [query, brand, sort, inStockOnly, vMake, vModel, vTrim, page, router]);

  const fetchAbort = useRef<AbortController | null>(null);
  const doFetch = useCallback(async () => {
    fetchAbort.current?.abort();
    const ac = new AbortController();
    fetchAbort.current = ac;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/shop/stock/search?${queryString}`, {
        signal: ac.signal,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed");
      setItems(data.data || []);
      setTotalPages(data.meta?.totalPages || 1);
      setTotalItems(data.meta?.totalItems ?? (data.data || []).length);
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      setError(err?.message || "Search failed");
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  // Debounced fetch on filter changes; immediate on page change.
  useEffect(() => {
    const t = setTimeout(doFetch, 250);
    return () => clearTimeout(t);
  }, [doFetch]);

  // Reset page to 1 when filters (except page) change.
  useEffect(() => {
    setPage(1);
  }, [query, brand, sort, inStockOnly, vMake, vModel, vTrim]);

  function clearAllFilters() {
    setQuery("");
    setBrand("");
    setSort("newest");
    setInStockOnly(false);
    setVMake("");
    setVModel("");
    setVTrim("");
    setPage(1);
  }

  const hasActiveFilters = Boolean(
    query || brand || sort !== "newest" || inStockOnly || vMake || vModel || vTrim
  );

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30 pt-20 sm:pt-24 md:pt-28">
      <WelcomeBar isUa={isUa} />

      {/* Hero / page title */}
      <header className="max-w-[1400px] mx-auto px-6 pt-16 pb-10">
        <p className="text-[10px] uppercase tracking-[0.4em] font-semibold text-muted-foreground">
          {isUa ? "B2B склад запчастин" : "B2B Parts Hub"}
        </p>
        <h1 className="mt-3 hero-title text-4xl sm:text-6xl md:text-7xl font-bold tracking-wider leading-none text-foreground uppercase">
          {isUa ? "Усі товари One Company" : "Our entire catalog"}
        </h1>
        <div className="shimmer-line max-w-[200px] mt-4 mb-4 opacity-70" />
        <p className="mt-2 text-xs sm:text-sm text-muted-foreground max-w-2xl font-light leading-relaxed uppercase tracking-[0.05em]">
          {isUa
            ? "Професійний пошук за брендом, артикулом або назвою запчастини. Ціни автоматично перераховані з урахуванням вашої персональної дилерської знижки."
            : "Professional search by brand, SKU, or part designation. Pricing displays with your pre-calculated dealer discounts."}
        </p>
      </header>

      {/* Sticky toolbar */}
      <div className="sticky top-16 z-30 bg-background/80 backdrop-blur-xl border-y border-border py-4 my-2">
        <div className="max-w-[1400px] mx-auto px-6 flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="flex-1 min-w-[260px] flex items-center rounded-[4px] border border-border/60 bg-card/60 backdrop-blur-sm px-3 h-11 focus-within:border-foreground/30 focus-within:ring-1 focus-within:ring-foreground/10 transition-all duration-300">
            <Search className="w-4 h-4 text-muted-foreground/60 shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                isUa ? "Артикул, назва або бренд… (Ctrl-K)" : "SKU, name or brand… (Ctrl-K)"
              }
              className="w-full bg-transparent text-[11px] uppercase tracking-[0.15em] text-foreground placeholder:text-muted-foreground/60 focus:outline-none px-3"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                aria-label={isUa ? "Очистити" : "Clear"}
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <kbd className="hidden md:inline-flex items-center justify-center rounded border border-border/80 bg-surface-elevated/80 px-1.5 py-0.5 text-[9px] font-mono uppercase text-muted-foreground/80 ml-2">
              ⌘K
            </kbd>
          </div>

          <BrandCombobox
            options={brands}
            value={brand}
            onChange={setBrand}
            placeholder={isUa ? "Бренд: введіть або оберіть" : "Brand: type or pick"}
            clearLabel={isUa ? "Усі бренди" : "All brands"}
            ariaLabel={isUa ? "Фільтр по бренду" : "Brand filter"}
          />

          {/* Sort */}
          <div className="relative">
            <select
              value={sort}
              onChange={(e) => setSort(parseSort(e.target.value))}
              aria-label={isUa ? "Сортування" : "Sort"}
              className="appearance-none rounded-[4px] border border-border/60 bg-card/60 backdrop-blur-sm text-foreground text-[10px] uppercase tracking-[0.2em] h-11 pl-4 pr-9 cursor-pointer focus:outline-none focus:border-foreground/30 focus:ring-1 focus:ring-foreground/10 hover:border-foreground/20 transition-all duration-300"
            >
              <option value="newest">{isUa ? "Новіші" : "Newest"}</option>
              <option value="price-asc">{isUa ? "Дешевші" : "Cheapest"}</option>
              <option value="price-desc">{isUa ? "Дорожчі" : "Priciest"}</option>
              <option value="name-asc">{isUa ? "А → Я" : "A → Z"}</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          </div>

          {/* In-stock toggle */}
          <label
            className={`inline-flex items-center gap-2 rounded-[4px] border h-11 px-4 text-[10px] uppercase tracking-[0.2em] cursor-pointer transition-all duration-300 ${
              inStockOnly
                ? "border-foreground/30 bg-foreground/5 text-foreground"
                : "border-border/60 bg-card/60 backdrop-blur-sm text-muted-foreground hover:text-foreground hover:border-foreground/20"
            }`}
          >
            <input
              type="checkbox"
              checked={inStockOnly}
              onChange={(e) => setInStockOnly(e.target.checked)}
              className="sr-only"
            />
            <span
              className={`w-3.5 h-3.5 rounded-[3px] border flex items-center justify-center transition-colors ${
                inStockOnly ? "border-foreground bg-foreground text-background" : "border-border/60"
              }`}
            >
              {inStockOnly && <Check className="w-3 h-3" />}
            </span>
            {isUa ? "В наявності" : "In Stock"}
          </label>

          {/* View toggle & Counter */}
          <div className="ml-auto flex items-center gap-4">
            <div className="flex items-center gap-0.5 rounded-[4px] border border-border/60 bg-card/60 p-0.5">
              <button
                type="button"
                onClick={() => changeViewMode("grid")}
                className={`p-1.5 rounded-[3px] transition-all duration-200 ${
                  viewMode === "grid"
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title={isUa ? "Сітка" : "Grid"}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => changeViewMode("list")}
                className={`p-1.5 rounded-[3px] transition-all duration-200 ${
                  viewMode === "list"
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title={isUa ? "Список" : "List"}
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/80 font-mono tabular-nums shrink-0">
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  {totalItems.toLocaleString()} {isUa ? "товарів" : "items"}
                  {totalPages > 1 && (
                    <span className="ml-3 text-muted-foreground/50">
                      {isUa ? "Стор." : "Page"} {page}/{totalPages}
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Vehicle cascade — Make → Model → Trim */}
        <div className="max-w-[1400px] mx-auto px-6 pt-3 flex flex-wrap items-center gap-3">
          <span className="text-[9px] uppercase tracking-[0.3em] text-foreground font-semibold shrink-0">
            {isUa ? "Автомобіль:" : "Vehicle:"}
          </span>
          <VehicleFilter
            locale={locale}
            make={vMake}
            model={vModel}
            trim={vTrim}
            onChange={({ make, model, trim }) => {
              setVMake(make);
              setVModel(model);
              setVTrim(trim);
            }}
          />
        </div>
      </div>

      {/* Active filter chips */}
      {hasActiveFilters && (
        <div className="max-w-[1400px] mx-auto px-6 pt-4 flex flex-wrap gap-2">
          {query && <FilterChip onRemove={() => setQuery("")}>&quot;{query}&quot;</FilterChip>}
          {brand && <FilterChip onRemove={() => setBrand("")}>{brand}</FilterChip>}
          {sort !== "newest" && (
            <FilterChip onRemove={() => setSort("newest")}>
              {sort === "price-asc"
                ? isUa
                  ? "Дешевші"
                  : "Cheapest"
                : sort === "price-desc"
                  ? isUa
                    ? "Дорожчі"
                    : "Priciest"
                  : isUa
                    ? "А → Я"
                    : "A → Z"}
            </FilterChip>
          )}
          {inStockOnly && (
            <FilterChip onRemove={() => setInStockOnly(false)}>
              {isUa ? "В наявності" : "In Stock"}
            </FilterChip>
          )}
          {vMake && (
            <FilterChip
              onRemove={() => {
                setVMake("");
                setVModel("");
                setVTrim("");
              }}
            >
              {`${vMake.toUpperCase()}${vModel ? " · " + vModel : ""}${vTrim ? " · " + vTrim : ""}`}
            </FilterChip>
          )}
          <button
            type="button"
            onClick={clearAllFilters}
            className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground underline-offset-4 hover:underline ml-1"
          >
            {isUa ? "Скинути все" : "Reset all"}
          </button>
        </div>
      )}

      {/* Results */}
      <div className="max-w-[1400px] mx-auto px-6 py-8 pb-32">
        {error && (
          <div className="rounded-[6px] border border-destructive/40 bg-destructive/10 text-destructive p-4 mb-6 text-sm">
            {error}
          </div>
        )}

        {loading && items.length === 0 ? (
          viewMode === "grid" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-[6px] border border-border/40 bg-card p-4 h-[420px] flex flex-col justify-between overflow-hidden relative"
                >
                  {/* Image container skeleton */}
                  <div className="aspect-square rounded-[6px] bg-muted/20 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-foreground/5 to-transparent bg-[length:200%_100%] [animation:shimmer_2.5s_linear_infinite]" />
                  </div>
                  {/* Content skeletons */}
                  <div className="mt-4 flex-1 space-y-3">
                    <div className="h-3 rounded-[3px] bg-muted/25 w-1/3 relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-foreground/5 to-transparent bg-[length:200%_100%] [animation:shimmer_2.5s_linear_infinite]" />
                    </div>
                    <div className="h-4 rounded-[3px] bg-muted/30 w-full relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-foreground/5 to-transparent bg-[length:200%_100%] [animation:shimmer_2.5s_linear_infinite]" />
                    </div>
                    <div className="h-4 rounded-[3px] bg-muted/30 w-2/3 relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-foreground/5 to-transparent bg-[length:200%_100%] [animation:shimmer_2.5s_linear_infinite]" />
                    </div>
                  </div>
                  {/* Footer skeleton */}
                  <div className="mt-4 pt-4 border-t border-border/40 flex items-center justify-between gap-3">
                    <div className="h-6 rounded-[3px] bg-muted/20 w-1/4 relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-foreground/5 to-transparent bg-[length:200%_100%] [animation:shimmer_2.5s_linear_infinite]" />
                    </div>
                    <div className="h-9 rounded-[4px] bg-muted/15 border border-border/20 w-1/3 relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-foreground/5 to-transparent bg-[length:200%_100%] [animation:shimmer_2.5s_linear_infinite]" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-4 p-4 lg:p-3 rounded-[6px] border border-border/40 bg-card relative overflow-hidden h-[156px] lg:h-[70px]"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-foreground/5 to-transparent bg-[length:200%_100%] [animation:shimmer_2.5s_linear_infinite] pointer-events-none" />

                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-12 h-12 rounded-[4px] bg-muted/20 shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 rounded-[3px] bg-muted/25 w-1/4" />
                      <div className="h-4 rounded-[3px] bg-muted/30 w-3/4" />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between lg:justify-end gap-x-4 gap-y-3 pt-3 lg:pt-0 border-t border-border/40 lg:border-t-0 shrink-0">
                    <div className="w-28 shrink-0">
                      <div className="h-3 rounded-[3px] bg-muted/25 w-1/2" />
                    </div>
                    <div className="w-20 lg:w-24 shrink-0">
                      <div className="h-3 rounded-[3px] bg-muted/25 w-1/3 lg:ml-auto" />
                    </div>
                    <div className="w-24 lg:w-32 shrink-0">
                      <div className="h-4 rounded-[3px] bg-muted/30 w-1/2 lg:ml-auto" />
                    </div>
                    <div className="w-full sm:w-auto lg:w-48 shrink-0 flex items-center gap-2 justify-end">
                      <div className="h-8 rounded-[4px] bg-muted/15 border border-border/20 w-16" />
                      <div className="h-8 rounded-[4px] bg-muted/15 border border-border/20 w-20" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : items.length === 0 ? (
          <div className="text-center py-24 rounded-[6px] border border-border bg-card">
            <div className="w-16 h-16 mx-auto rounded-full bg-surface-elevated flex items-center justify-center mb-5">
              <Package className="w-7 h-7 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-light text-foreground mb-2 tracking-tight">
              {isUa ? "Нічого не знайдено" : "No results"}
            </h3>
            <p className="text-muted-foreground text-sm mb-6 max-w-md mx-auto">
              {isUa
                ? "Спробуйте змінити пошук або скинути фільтри."
                : "Try a different search or clear your filters."}
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="inline-flex items-center gap-2 rounded-[4px] bg-foreground text-background px-5 py-2.5 text-[10px] uppercase tracking-[0.18em] hover:bg-foreground/90 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                {isUa ? "Скинути фільтри" : "Clear filters"}
              </button>
            )}
          </div>
        ) : (
          <>
            {viewMode === "grid" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {items.map((item) => (
                  <ProductCard key={`${item.source}:${item.id}`} item={item} locale={locale} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {/* List Header */}
                <div className="hidden lg:flex items-center gap-4 px-3 py-2 text-[9px] uppercase tracking-[0.2em] text-muted-foreground font-semibold border-b border-border/40 mb-2">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-12 text-center">{isUa ? "Фото" : "Image"}</div>
                    <div className="pl-3">{isUa ? "Товар / Артикул" : "Product / SKU"}</div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="w-28">{isUa ? "Статус" : "Status"}</div>
                    <div className="w-20 lg:w-24 text-right">{isUa ? "РРЦ" : "MSRP"}</div>
                    <div className="w-24 lg:w-32 text-right">
                      {isUa ? "Ваша ціна" : "Your Price"}
                    </div>
                    <div className="w-48 text-right">{isUa ? "Дії" : "Actions"}</div>
                  </div>
                </div>
                {items.map((item) => (
                  <ProductListItem key={`${item.source}:${item.id}`} item={item} locale={locale} />
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-12 flex items-center justify-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="text-[10px] uppercase tracking-[0.18em] border border-border bg-card text-foreground px-4 py-2.5 rounded-[4px] hover:border-foreground/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  ← {isUa ? "Назад" : "Prev"}
                </button>
                <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground px-4 tabular-nums">
                  {page} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="text-[10px] uppercase tracking-[0.18em] border border-border bg-card text-foreground px-4 py-2.5 rounded-[4px] hover:border-foreground/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  {isUa ? "Далі" : "Next"} →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function FilterChip({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-[4px] border border-border bg-card px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-foreground">
      {children}
      <button
        type="button"
        onClick={onRemove}
        className="text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Remove filter"
      >
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}

export default function StockPage() {
  return (
    <Suspense fallback={null}>
      <StockPageContent />
    </Suspense>
  );
}
