"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  FlaskConical,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { ShopCountryCombobox } from "@/components/shop/ShopCountryCombobox";

type Currency = "EUR" | "USD" | "UAH";
type ShippingMode = "calculated" | "included";
type RuleMode = "fixed" | "multiplier" | "free" | "tiered" | "percent" | "manual_quote";

type ShippingZone = {
  id: string;
  name: string;
  currency?: Currency;
  enabled: boolean;
  shippingMode?: ShippingMode;
  calcMode?: "flat" | "volumetric";
  fallbackWeightKg?: number;
  fallbackLength?: number;
  fallbackWidth?: number;
  fallbackHeight?: number;
  volumetricDivisor?: number;
};

type Brand = { brand: string; productCount: number };

type CatalogProduct = {
  id: string;
  slug: string;
  sku: string | null;
  brand: string | null;
  titleUa: string | null;
  titleEn: string | null;
  priceEur: number | null;
  priceEurEurope: number | null;
  priceUsd: number | null;
  priceUah: number | null;
  stock: string;
  imageUrl?: string | null;
};

type CatalogProductDetail = CatalogProduct & {
  weight: number | null;
  length: number | null;
  width: number | null;
  height: number | null;
  isDimensionsEstimated: boolean;
  variants?: Array<{
    isDefault?: boolean;
    weight: number | null;
    length: number | null;
    width: number | null;
    height: number | null;
    priceEur: number | null;
    priceEurEurope: number | null;
    priceUsd: number | null;
    priceUah: number | null;
  }>;
};

type StoredRule = {
  id: string;
  brandName: string;
  shippingZoneId?: string | null;
  mode: RuleMode;
  value: number;
  warehouseRatePerKg: number;
  currency: Currency;
  enabled: boolean;
  brackets?: Array<{ maxAmount: number | null; fee: number }>;
};

type DraftRule = {
  id: string;
  brandName: string;
  shippingZoneId: string;
  mode: RuleMode;
  value: string;
  warehouseRatePerKg: string;
  currency: Currency;
  enabled: boolean;
};

type TestLine = {
  id: string;
  productId: string;
  productTitle: string;
  productSku: string;
  productDimensionsEstimated: boolean;
  brandName: string;
  total: string;
  quantity: string;
  pricingBaseRegion: "default" | "europe";
  weightKg: string;
  length: string;
  width: string;
  height: string;
  shippingToUaUsd: string;
};

type AddressPreset = {
  label: string;
  country: string;
  postcode: string;
  region: string;
  city: string;
};

const ADDRESS_PRESETS: AddressPreset[] = [
  { label: "Київ", country: "Ukraine", postcode: "01001", region: "Kyiv", city: "Kyiv" },
  { label: "Berlin", country: "Germany", postcode: "10115", region: "Berlin", city: "Berlin" },
  { label: "Warsaw", country: "Poland", postcode: "00-001", region: "Mazowieckie", city: "Warsaw" },
  {
    label: "New York",
    country: "United States",
    postcode: "10001",
    region: "NY",
    city: "New York",
  },
];

type StoredSettings = Record<string, unknown> & {
  defaultCurrency: Currency;
  enabledCurrencies: Currency[];
  shippingZones: ShippingZone[];
  brandShippingRules: StoredRule[];
};

type PreviewResponse = {
  currency: Currency;
  subtotal: number;
  regionalAdjustmentAmount: number;
  shippingCost: number;
  taxAmount: number;
  total: number;
  itemCount: number;
  shippingZone: { id: string; name: string; currency?: Currency } | null;
  taxRegion: { id: string; name: string; rate?: number } | null;
  regionalPricingRule: { id: string; name: string } | null;
  requiresQuote: boolean;
  brandsRequiringQuote: string[];
  showTaxesIncludedNotice?: boolean;
};

const RULE_MODE_LABELS: Record<RuleMode, string> = {
  fixed: "Фіксована сума",
  multiplier: "Множник стандартної",
  free: "Безкоштовно",
  tiered: "За сумою кошика",
  percent: "Відсоток від кошика",
  manual_quote: "Ручний прорахунок",
};

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function createLine(brandName = ""): TestLine {
  return {
    id: makeId("line"),
    productId: "",
    productTitle: "",
    productSku: "",
    productDimensionsEstimated: false,
    brandName,
    total: "1200",
    quantity: "1",
    pricingBaseRegion: "default",
    weightKg: "",
    length: "",
    width: "",
    height: "",
    shippingToUaUsd: "",
  };
}

function createRule(brandName = "", shippingZoneId = ""): DraftRule {
  return {
    id: makeId("demo-rule"),
    brandName,
    shippingZoneId,
    mode: "fixed",
    value: "120",
    warehouseRatePerKg: "0",
    currency: "EUR",
    enabled: true,
  };
}

function numberOrZero(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function money(value: number, currency: Currency) {
  return new Intl.NumberFormat("uk-UA", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function productTitle(product: CatalogProduct) {
  return product.titleUa?.trim() || product.titleEn?.trim() || product.sku || product.slug;
}

function productPrice(
  product: CatalogProductDetail,
  currency: Currency,
  region: TestLine["pricingBaseRegion"]
) {
  if (currency === "EUR") {
    return region === "europe" ? (product.priceEurEurope ?? product.priceEur) : product.priceEur;
  }
  if (currency === "USD") return product.priceUsd;
  return product.priceUah;
}

const INPUT_CLASS =
  "h-10 w-full rounded-none border border-white/10 bg-black/30 px-3 text-sm text-zinc-100 outline-hidden focus:border-blue-500/50";

export default function ShippingLabPage() {
  const [settings, setSettings] = useState<StoredSettings | null>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [zones, setZones] = useState<ShippingZone[]>([]);
  const [zoneModes, setZoneModes] = useState<Record<string, ShippingMode>>({});
  const [lines, setLines] = useState<TestLine[]>([createLine()]);
  const [draftRules, setDraftRules] = useState<DraftRule[]>([]);
  const [productPickerLineId, setProductPickerLineId] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [productResults, setProductResults] = useState<CatalogProduct[]>([]);
  const [productSearchLoading, setProductSearchLoading] = useState(false);
  const [productLoadingId, setProductLoadingId] = useState<string | null>(null);
  const [address, setAddress] = useState({
    country: "Germany",
    postcode: "10115",
    region: "",
    city: "Berlin",
  });
  const [currency, setCurrency] = useState<Currency>("EUR");
  const [quote, setQuote] = useState<PreviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [quoting, setQuoting] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [settingsResponse, brandsResponse] = await Promise.all([
        fetch("/api/admin/shop/settings", { cache: "no-store" }),
        fetch("/api/admin/shop/turn14/sync-dimensions", { cache: "no-store" }),
      ]);
      if (!settingsResponse.ok) throw new Error("Не вдалося завантажити налаштування магазину");

      const nextSettings = (await settingsResponse.json()) as StoredSettings;
      const brandsData = brandsResponse.ok ? await brandsResponse.json() : { brands: [] };
      const nextZones = Array.isArray(nextSettings.shippingZones) ? nextSettings.shippingZones : [];
      const nextBrands = Array.isArray(brandsData.brands) ? (brandsData.brands as Brand[]) : [];

      setSettings(nextSettings);
      setZones(nextZones);
      setBrands(nextBrands);
      setCurrency(nextSettings.defaultCurrency ?? "EUR");
      setZoneModes(
        Object.fromEntries(
          nextZones.map((zone) => [
            zone.id,
            zone.shippingMode === "included" ? "included" : "calculated",
          ])
        )
      );
      setLines((current) => {
        const firstBrand = nextBrands[0]?.brand ?? current[0]?.brandName ?? "";
        return current.length ? current : [createLine(firstBrand)];
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!productPickerLineId || productSearch.trim().length < 2) {
      setProductResults([]);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setProductSearchLoading(true);
      try {
        const params = new URLSearchParams({
          search: productSearch.trim(),
          page: "1",
          limit: "12",
          status: "ALL",
        });
        const response = await fetch(`/api/admin/shop/products?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Не вдалося знайти товари");
        setProductResults(Array.isArray(data.products) ? (data.products as CatalogProduct[]) : []);
      } catch (searchError) {
        if ((searchError as Error).name !== "AbortError") {
          setError(searchError instanceof Error ? searchError.message : String(searchError));
        }
      } finally {
        if (!controller.signal.aborted) setProductSearchLoading(false);
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [productPickerLineId, productSearch]);

  const brandOptions = useMemo(() => {
    const values = new Set(brands.map((brand) => brand.brand).filter(Boolean));
    for (const line of lines) if (line.brandName.trim()) values.add(line.brandName.trim());
    for (const rule of draftRules) if (rule.brandName.trim()) values.add(rule.brandName.trim());
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [brands, draftRules, lines]);

  const draftSettings = useMemo(() => {
    if (!settings) return null;
    const shippingZones = settings.shippingZones.map((zone) => ({
      ...zone,
      shippingMode: zoneModes[zone.id] ?? zone.shippingMode ?? "calculated",
    }));
    const temporaryRules = draftRules.map((rule) => ({
      id: rule.id,
      brandName: rule.brandName.trim(),
      shippingZoneId: rule.shippingZoneId || null,
      mode: rule.mode,
      value: numberOrZero(rule.value),
      warehouseRatePerKg: numberOrZero(rule.warehouseRatePerKg),
      currency: rule.currency,
      enabled: rule.enabled,
    }));
    return {
      ...settings,
      shippingZones,
      brandShippingRules: [...temporaryRules, ...(settings.brandShippingRules ?? [])],
    };
  }, [draftRules, settings, zoneModes]);

  const previewPayload = useMemo(() => {
    const previewItems = lines.map((line) => ({
      total: numberOrZero(line.total),
      quantity: Math.max(1, Math.floor(numberOrZero(line.quantity))),
      pricingBaseRegion: line.pricingBaseRegion,
      brandName: line.brandName.trim() || null,
      weightKg: nullableNumber(line.weightKg),
      length: nullableNumber(line.length),
      width: nullableNumber(line.width),
      height: nullableNumber(line.height),
      shippingToUaUsd: nullableNumber(line.shippingToUaUsd),
    }));
    return {
      settings: draftSettings,
      preview: {
        currency,
        subtotal: previewItems.reduce((sum, item) => sum + item.total, 0),
        itemCount: previewItems.reduce((sum, item) => sum + item.quantity, 0),
        items: previewItems,
        shippingAddress: {
          line1: "Shipping Lab",
          city: address.city,
          region: address.region,
          postcode: address.postcode,
          country: address.country,
        },
      },
    };
  }, [address, currency, draftSettings, lines]);

  useEffect(() => {
    if (loading || !draftSettings) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setQuoting(true);
      setError("");
      try {
        const response = await fetch("/api/admin/shop/settings/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(previewPayload),
          signal: controller.signal,
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Не вдалося порахувати доставку");
        setQuote(data as PreviewResponse);
      } catch (quoteError) {
        if ((quoteError as Error).name !== "AbortError") {
          setError(quoteError instanceof Error ? quoteError.message : String(quoteError));
        }
      } finally {
        if (!controller.signal.aborted) setQuoting(false);
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [draftSettings, loading, previewPayload]);

  function updateAddress(field: keyof typeof address, value: string) {
    setAddress((current) => ({ ...current, [field]: value }));
  }

  function updateLine(id: string, patch: Partial<TestLine>) {
    setLines((current) => current.map((line) => (line.id === id ? { ...line, ...patch } : line)));
  }

  function updateRule(id: string, patch: Partial<DraftRule>) {
    setDraftRules((current) =>
      current.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule))
    );
  }

  async function selectCatalogProduct(product: CatalogProduct) {
    setProductLoadingId(product.id);
    setError("");
    try {
      const response = await fetch(`/api/admin/shop/products/${product.id}`, { cache: "no-store" });
      const detail = (await response.json()) as CatalogProductDetail & { error?: string };
      if (!response.ok) throw new Error(detail.error || "Не вдалося завантажити товар");

      const variant = detail.variants?.find((entry) => entry.isDefault) ?? detail.variants?.[0];
      const weight = variant?.weight ?? detail.weight;
      const length = variant?.length ?? detail.length;
      const width = variant?.width ?? detail.width;
      const height = variant?.height ?? detail.height;
      const activeLine = lines.find((line) => line.id === productPickerLineId);
      const selectedCurrency = currency;
      const selectedRegion = activeLine?.pricingBaseRegion ?? "default";
      const price = productPrice(
        {
          ...detail,
          priceEur: variant?.priceEur ?? detail.priceEur,
          priceEurEurope: variant?.priceEurEurope ?? detail.priceEurEurope,
          priceUsd: variant?.priceUsd ?? detail.priceUsd,
          priceUah: variant?.priceUah ?? detail.priceUah,
        },
        selectedCurrency,
        selectedRegion
      );

      if (productPickerLineId) {
        updateLine(productPickerLineId, {
          productId: detail.id,
          productTitle: productTitle(detail),
          productSku: detail.sku ?? "",
          brandName: detail.brand ?? "",
          total: price != null && price > 0 ? String(price) : (activeLine?.total ?? "1200"),
          weightKg: weight == null ? "" : String(weight),
          length: length == null ? "" : String(length),
          width: width == null ? "" : String(width),
          height: height == null ? "" : String(height),
          productDimensionsEstimated: detail.isDimensionsEstimated,
        });
      }
      setProductPickerLineId(null);
      setProductSearch("");
    } catch (selectionError) {
      setError(selectionError instanceof Error ? selectionError.message : String(selectionError));
    } finally {
      setProductLoadingId(null);
    }
  }

  function estimatePackage() {
    const matchedZone = quote?.shippingZone
      ? zones.find((zone) => zone.id === quote.shippingZone?.id)
      : zones.find((zone) => zone.enabled);
    const fallbackWeight = matchedZone?.fallbackWeightKg ?? 2;
    const fallbackLength = matchedZone?.fallbackLength ?? 30;
    const fallbackWidth = matchedZone?.fallbackWidth ?? 20;
    const fallbackHeight = matchedZone?.fallbackHeight ?? 15;
    const divisor = matchedZone?.volumetricDivisor ?? 5000;

    let weightKg = 0;
    let volumeWeightKg = 0;
    let fallbackLines = 0;
    let catalogLines = 0;
    let estimatedLines = 0;
    for (const line of lines) {
      const quantity = Math.max(1, Math.floor(numberOrZero(line.quantity)));
      const weight = nullableNumber(line.weightKg);
      const length = nullableNumber(line.length) ?? fallbackLength;
      const width = nullableNumber(line.width) ?? fallbackWidth;
      const height = nullableNumber(line.height) ?? fallbackHeight;
      weightKg += (weight ?? fallbackWeight) * quantity;
      volumeWeightKg += ((length * width * height) / divisor) * quantity;
      if (weight == null) fallbackLines += 1;
      else if (line.productId) catalogLines += 1;
      if (line.productDimensionsEstimated) estimatedLines += 1;
    }

    return {
      weightKg,
      volumeWeightKg,
      chargeableWeightKg: Math.max(weightKg, volumeWeightKg),
      fallbackLines,
      catalogLines,
      estimatedLines,
    };
  }

  const packageEstimate = estimatePackage();

  const defaultZoneId = zones.find((zone) => zone.enabled)?.id ?? "";

  return (
    <div className="min-h-full bg-black text-white">
      <div className="mx-auto w-full max-w-[1500px] px-4 py-8 md:px-8 lg:px-12">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link
              href="/admin/shop/logistics/brand-rules"
              className="inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" /> Правила доставки
            </Link>
            <div className="mt-5 flex items-center gap-3">
              <FlaskConical className="h-7 w-7 text-blue-300" />
              <h1 className="text-3xl font-light tracking-tight">Демо-чекаут доставки</h1>
            </div>
            <p className="mt-2 max-w-3xl text-sm text-white/50">
              Live-перевірка правил доставки без збереження. Змінюйте ZIP, бренд, вагу або
              тимчасовий тариф і дивіться результат того самого checkout-движка.
            </p>
          </div>
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-2 border border-white/15 px-4 py-2 text-sm text-white hover:bg-white/5"
          >
            <RefreshCw className="h-4 w-4" /> Оновити налаштування
          </button>
        </div>

        {error ? (
          <div className="mt-5 border border-red-500/30 bg-red-950/20 p-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
          <div className="space-y-6">
            <section className="border border-white/10 bg-white/[0.03] p-5">
              <h2 className="text-lg font-medium">Адреса доставки</h2>
              <p className="mt-1 text-xs text-white/45">
                ZIP передається в quote і зберігається у snapshot замовлення.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="self-center text-[10px] uppercase tracking-[0.14em] text-white/35">
                  Швидкий пресет
                </span>
                {ADDRESS_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setAddress(preset)}
                    className="border border-white/10 px-3 py-1.5 text-xs text-white/70 hover:border-blue-500/40 hover:text-white"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Field label="Країна">
                  <ShopCountryCombobox
                    locale="ua"
                    value={address.country}
                    onChange={(value) => updateAddress("country", value)}
                    buttonClassName="min-h-10 rounded-none border-white/10 bg-black/30 px-3 py-2 text-sm dark:bg-black/30"
                  />
                </Field>
                <Field label="ZIP / Postcode">
                  <input
                    className={INPUT_CLASS}
                    value={address.postcode}
                    onChange={(event) => updateAddress("postcode", event.target.value)}
                    placeholder="10115"
                  />
                </Field>
                <Field label="Region / State">
                  <input
                    className={INPUT_CLASS}
                    value={address.region}
                    onChange={(event) => updateAddress("region", event.target.value)}
                    placeholder="Bavaria"
                  />
                </Field>
                <Field label="Місто">
                  <input
                    className={INPUT_CLASS}
                    value={address.city}
                    onChange={(event) => updateAddress("city", event.target.value)}
                    placeholder="Berlin"
                  />
                </Field>
              </div>
              <div className="mt-4 max-w-[220px]">
                <Field label="Валюта checkout">
                  <select
                    className={INPUT_CLASS}
                    value={currency}
                    onChange={(event) => setCurrency(event.target.value as Currency)}
                  >
                    {(settings?.enabledCurrencies ?? ["EUR", "USD", "UAH"]).map((entry) => (
                      <option key={entry} value={entry}>
                        {entry}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </section>

            <section className="border border-white/10 bg-white/[0.03] p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-medium">Тестовий кошик</h2>
                  <p className="mt-1 text-xs text-white/45">
                    Розміри можна залишити порожніми, щоб перевірити fallback-вагу зони.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setLines((current) => [...current, createLine(brandOptions[0] ?? "")])
                  }
                  className="inline-flex items-center gap-2 border border-white/15 px-3 py-2 text-xs text-white hover:bg-white/5"
                >
                  <Plus className="h-4 w-4" /> Додати товар
                </button>
              </div>
              <div className="mt-4 space-y-4">
                {lines.map((line, index) => (
                  <div key={line.id} className="border border-white/10 bg-zinc-950/60 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="text-xs uppercase tracking-[0.16em] text-white/45">
                        Товар {index + 1}
                      </div>
                      {lines.length > 1 ? (
                        <button
                          type="button"
                          onClick={() =>
                            setLines((current) => current.filter((entry) => entry.id !== line.id))
                          }
                          className="text-white/45 hover:text-red-300"
                          title="Видалити товар"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>
                    <div className="mb-4">
                      {line.productId ? (
                        <div className="flex flex-wrap items-center justify-between gap-3 border border-emerald-500/20 bg-emerald-950/10 px-3 py-2">
                          <div className="min-w-0">
                            <div className="truncate text-sm text-emerald-100">
                              {line.productTitle}
                            </div>
                            <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-emerald-200/60">
                              <span>{line.brandName || "Без бренду"}</span>
                              {line.productSku ? <span>SKU {line.productSku}</span> : null}
                              <span>
                                {line.productDimensionsEstimated
                                  ? "Габарити оцінені"
                                  : "Дані з каталогу"}
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              updateLine(line.id, {
                                productId: "",
                                productTitle: "",
                                productSku: "",
                                productDimensionsEstimated: false,
                              })
                            }
                            className="inline-flex items-center gap-1 text-xs text-white/45 hover:text-white"
                          >
                            <X className="h-3.5 w-3.5" /> Очистити
                          </button>
                        </div>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => {
                          setProductPickerLineId((current) =>
                            current === line.id ? null : line.id
                          );
                          setProductSearch("");
                          setProductResults([]);
                        }}
                        className="mt-3 inline-flex items-center gap-2 border border-blue-500/30 px-3 py-2 text-xs text-blue-200 hover:bg-blue-500/10"
                      >
                        <Search className="h-3.5 w-3.5" /> Обрати товар з каталогу
                      </button>
                      {productPickerLineId === line.id ? (
                        <div className="mt-3 border border-blue-500/20 bg-blue-950/10 p-3">
                          <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                            <input
                              autoFocus
                              className={`${INPUT_CLASS} pl-9`}
                              value={productSearch}
                              onChange={(event) => setProductSearch(event.target.value)}
                              placeholder="Назва, SKU або бренд"
                            />
                          </div>
                          <div className="mt-3 max-h-64 space-y-1 overflow-y-auto">
                            {productSearchLoading ? (
                              <div className="px-2 py-3 text-xs text-white/45">
                                Шукаємо в каталозі…
                              </div>
                            ) : productSearch.trim().length < 2 ? (
                              <div className="px-2 py-3 text-xs text-white/45">
                                Введіть хоча б 2 символи.
                              </div>
                            ) : productResults.length ? (
                              productResults.map((product) => (
                                <button
                                  key={product.id}
                                  type="button"
                                  onClick={() => selectCatalogProduct(product)}
                                  className="flex w-full items-center justify-between gap-3 border border-white/5 px-3 py-2 text-left hover:bg-white/5"
                                >
                                  <span className="min-w-0">
                                    <span className="block truncate text-sm text-white">
                                      {productTitle(product)}
                                    </span>
                                    <span className="mt-1 block text-[11px] text-white/40">
                                      {product.brand || "Без бренду"} ·{" "}
                                      {product.sku || product.slug}
                                    </span>
                                  </span>
                                  {productLoadingId === product.id ? (
                                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-blue-300" />
                                  ) : (
                                    <Check className="h-4 w-4 shrink-0 text-white/20" />
                                  )}
                                </button>
                              ))
                            ) : (
                              <div className="px-2 py-3 text-xs text-white/45">
                                Товарів не знайдено.
                              </div>
                            )}
                          </div>
                        </div>
                      ) : null}
                    </div>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <Field label="Бренд">
                        <select
                          className={INPUT_CLASS}
                          value={line.brandName}
                          onChange={(event) =>
                            updateLine(line.id, { brandName: event.target.value })
                          }
                        >
                          <option value="">Без бренду</option>
                          {brandOptions.map((brand) => (
                            <option key={brand} value={brand}>
                              {brand}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Ціна товару">
                        <input
                          className={INPUT_CLASS}
                          inputMode="decimal"
                          value={line.total}
                          onChange={(event) => updateLine(line.id, { total: event.target.value })}
                        />
                      </Field>
                      <Field label="Кількість">
                        <input
                          className={INPUT_CLASS}
                          inputMode="numeric"
                          value={line.quantity}
                          onChange={(event) =>
                            updateLine(line.id, { quantity: event.target.value })
                          }
                        />
                      </Field>
                      <Field label="Ціновий ринок">
                        <select
                          className={INPUT_CLASS}
                          value={line.pricingBaseRegion}
                          onChange={(event) =>
                            updateLine(line.id, {
                              pricingBaseRegion: event.target
                                .value as TestLine["pricingBaseRegion"],
                            })
                          }
                        >
                          <option value="default">Default</option>
                          <option value="europe">Europe</option>
                        </select>
                      </Field>
                      <Field label="Вага, кг">
                        <input
                          className={INPUT_CLASS}
                          inputMode="decimal"
                          value={line.weightKg}
                          onChange={(event) =>
                            updateLine(line.id, { weightKg: event.target.value })
                          }
                          placeholder="fallback"
                        />
                      </Field>
                      <Field label="Довжина, см">
                        <input
                          className={INPUT_CLASS}
                          inputMode="decimal"
                          value={line.length}
                          onChange={(event) => updateLine(line.id, { length: event.target.value })}
                          placeholder="fallback"
                        />
                      </Field>
                      <Field label="Ширина, см">
                        <input
                          className={INPUT_CLASS}
                          inputMode="decimal"
                          value={line.width}
                          onChange={(event) => updateLine(line.id, { width: event.target.value })}
                          placeholder="fallback"
                        />
                      </Field>
                      <Field label="Висота, см">
                        <input
                          className={INPUT_CLASS}
                          inputMode="decimal"
                          value={line.height}
                          onChange={(event) => updateLine(line.id, { height: event.target.value })}
                          placeholder="fallback"
                        />
                      </Field>
                      <Field label="Ukraine supplier fee, USD">
                        <input
                          className={INPUT_CLASS}
                          inputMode="decimal"
                          value={line.shippingToUaUsd}
                          onChange={(event) =>
                            updateLine(line.id, { shippingToUaUsd: event.target.value })
                          }
                          placeholder="optional"
                        />
                      </Field>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="border border-white/10 bg-white/[0.03] p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-medium">Тимчасові правила для тесту</h2>
                  <p className="mt-1 text-xs text-white/45">
                    Вони мають пріоритет у цьому демо й нікуди не зберігаються.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setDraftRules((current) => [
                      ...current,
                      createRule(brandOptions[0] ?? "", defaultZoneId),
                    ])
                  }
                  className="inline-flex items-center gap-2 border border-blue-500/30 px-3 py-2 text-xs text-blue-200 hover:bg-blue-500/10"
                >
                  <Plus className="h-4 w-4" /> Додати тестове правило
                </button>
              </div>
              {draftRules.length ? (
                <div className="mt-4 space-y-3">
                  {draftRules.map((rule) => (
                    <div
                      key={rule.id}
                      className="grid gap-3 border border-blue-500/20 bg-blue-950/10 p-3 md:grid-cols-2 xl:grid-cols-6"
                    >
                      <Field label="Бренд">
                        <select
                          className={INPUT_CLASS}
                          value={rule.brandName}
                          onChange={(event) =>
                            updateRule(rule.id, { brandName: event.target.value })
                          }
                        >
                          <option value="">Без бренду</option>
                          {brandOptions.map((brand) => (
                            <option key={brand} value={brand}>
                              {brand}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Зона">
                        <select
                          className={INPUT_CLASS}
                          value={rule.shippingZoneId}
                          onChange={(event) =>
                            updateRule(rule.id, { shippingZoneId: event.target.value })
                          }
                        >
                          <option value="">Усі регіони</option>
                          {zones.map((zone) => (
                            <option key={zone.id} value={zone.id}>
                              {zone.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Тип">
                        <select
                          className={INPUT_CLASS}
                          value={rule.mode}
                          onChange={(event) =>
                            updateRule(rule.id, { mode: event.target.value as RuleMode })
                          }
                        >
                          {Object.entries(RULE_MODE_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Сума / значення">
                        <input
                          className={INPUT_CLASS}
                          inputMode="decimal"
                          value={rule.value}
                          onChange={(event) => updateRule(rule.id, { value: event.target.value })}
                        />
                      </Field>
                      <Field label="Валюта">
                        <select
                          className={INPUT_CLASS}
                          value={rule.currency}
                          onChange={(event) =>
                            updateRule(rule.id, { currency: event.target.value as Currency })
                          }
                        >
                          {(["EUR", "USD", "UAH"] as Currency[]).map((entry) => (
                            <option key={entry} value={entry}>
                              {entry}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <div className="flex items-end gap-2">
                        <label className="flex h-10 flex-1 items-center gap-2 border border-white/10 px-3 text-xs text-white/70">
                          <input
                            type="checkbox"
                            checked={rule.enabled}
                            onChange={(event) =>
                              updateRule(rule.id, { enabled: event.target.checked })
                            }
                          />{" "}
                          Активне
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            setDraftRules((current) =>
                              current.filter((entry) => entry.id !== rule.id)
                            )
                          }
                          className="h-10 border border-white/10 px-3 text-white/45 hover:text-red-300"
                          title="Видалити тестове правило"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 border border-dashed border-white/10 p-4 text-sm text-white/40">
                  Зараз використовуються збережені правила магазину.
                </div>
              )}
            </section>

            <section className="border border-white/10 bg-white/[0.03] p-5">
              <h2 className="text-lg font-medium">Режим зон у цьому демо</h2>
              <p className="mt-1 text-xs text-white/45">
                Тимчасово перемикайте, чи доставка входить у ціну товару. Збережені налаштування не
                змінюються.
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {zones.map((zone) => (
                  <label key={zone.id} className="border border-white/10 bg-zinc-950/60 p-3">
                    <div className="text-sm text-white">{zone.name}</div>
                    <div className="mt-1 text-[11px] text-white/35">{zone.id}</div>
                    <select
                      className={`${INPUT_CLASS} mt-3`}
                      value={zoneModes[zone.id] ?? "calculated"}
                      onChange={(event) =>
                        setZoneModes((current) => ({
                          ...current,
                          [zone.id]: event.target.value as ShippingMode,
                        }))
                      }
                    >
                      <option value="calculated">Розраховувати доставку</option>
                      <option value="included">Доставка включена в ціну</option>
                    </select>
                  </label>
                ))}
              </div>
            </section>
          </div>

          <aside className="h-fit border border-blue-500/20 bg-blue-950/10 p-5 xl:sticky xl:top-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-medium">Live результат</h2>
                <p className="mt-1 text-xs text-white/45">Перерахунок після кожної зміни</p>
              </div>
              {quoting ? (
                <Loader2 className="h-5 w-5 animate-spin text-blue-300" />
              ) : (
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
              )}
            </div>
            {quote ? (
              <div className="mt-6 space-y-4">
                <div className="space-y-2 text-sm">
                  <SummaryRow label="Subtotal" value={money(quote.subtotal, quote.currency)} />
                  <SummaryRow label="Shipping" value={money(quote.shippingCost, quote.currency)} />
                  <SummaryRow
                    label="VAT"
                    value={
                      quote.showTaxesIncludedNotice && quote.taxAmount === 0
                        ? "Included"
                        : money(quote.taxAmount, quote.currency)
                    }
                  />
                  <div className="my-3 border-t border-white/10" />
                  <SummaryRow label="Total" value={money(quote.total, quote.currency)} strong />
                </div>
                <div className="space-y-2 border border-white/10 bg-black/20 p-3 text-xs text-white/65">
                  <SummaryRow
                    label="Matched zone"
                    value={
                      quote.shippingZone
                        ? `${quote.shippingZone.name} (${quote.shippingZone.id})`
                        : "Немає збігу"
                    }
                  />
                  <SummaryRow label="ZIP" value={address.postcode || "—"} />
                  <SummaryRow label="Items" value={String(quote.itemCount)} />
                  <SummaryRow label="Tax rule" value={quote.taxRegion?.name ?? "Немає"} />
                </div>
                {quote.requiresQuote ? (
                  <div className="border border-amber-500/30 bg-amber-950/20 p-3 text-sm text-amber-100">
                    Потрібен ручний прорахунок: {quote.brandsRequiringQuote.join(", ") || "товар"}.
                  </div>
                ) : null}
                <div className="border border-white/10 bg-black/20 p-3 text-xs leading-5 text-white/45">
                  Зараз це внутрішній rule engine. ZIP уже передається в quote, але зони ще
                  зіставляються за країною та регіоном. Carrier API підключимо окремим шаром після
                  підтвердження профілів товарів.
                </div>
              </div>
            ) : (
              <div className="mt-6 text-sm text-white/45">
                Введіть адресу й товар, щоб побачити розрахунок.
              </div>
            )}
            <div className="mt-5 border border-emerald-500/20 bg-emerald-950/10 p-3">
              <div className="text-sm font-medium text-emerald-100">Орієнтовна посилка</div>
              <div className="mt-1 text-[11px] leading-5 text-emerald-200/55">
                Попередня оцінка для carrier API. Для кількох товарів це не фінальна схема
                пакування.
              </div>
              <div className="mt-3 space-y-2 text-xs">
                <SummaryRow
                  label="Фактична вага"
                  value={`~ ${packageEstimate.weightKg.toFixed(2)} кг`}
                />
                <SummaryRow
                  label="Об'ємна вага"
                  value={`~ ${packageEstimate.volumeWeightKg.toFixed(2)} кг`}
                />
                <SummaryRow
                  label="Chargeable weight"
                  value={`~ ${packageEstimate.chargeableWeightKg.toFixed(2)} кг`}
                  strong
                />
                <SummaryRow
                  label="Джерело"
                  value={
                    packageEstimate.fallbackLines
                      ? `${packageEstimate.fallbackLines} ряд. fallback`
                      : packageEstimate.estimatedLines
                        ? `${packageEstimate.estimatedLines} ряд. оцінено`
                        : `${packageEstimate.catalogLines} ряд. з каталогу`
                  }
                />
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-[10px] uppercase tracking-[0.14em] text-white/45">{label}</div>
      {children}
    </label>
  );
}

function SummaryRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-4 ${strong ? "text-base font-semibold text-white" : "text-white/70"}`}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
