'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowDown,
  ArrowUp,
  Download,
  Globe2,
  Percent,
  Plus,
  RefreshCw,
  Save,
  Settings2,
  Trash2,
} from 'lucide-react';

import {
  AdminActionBar,
  AdminEditorSection,
  AdminInlineAlert,
  AdminMetricCard,
  AdminMetricGrid,
  AdminPage,
  AdminPageHeader,
} from '@/components/admin/AdminPrimitives';
import {
  AdminCheckboxField as CheckboxField,
  AdminInputField as InputField,
  AdminSelectField as SelectField,
  AdminTextareaField as TextareaField,
} from '@/components/admin/AdminFormFields';

type ShopCurrencyCode = 'EUR' | 'USD' | 'UAH';

type ShopShippingZone = {
  id: string;
  name: string;
  countries: string[];
  regions: string[];
  baseRate: number;
  perItemRate: number;
  ratePerKg: number;
  volSurchargePerKg: number;
  volumetricDivisor: number;
  fallbackWeightKg: number;
  fallbackLength: number;
  fallbackWidth: number;
  fallbackHeight: number;
  calcMode: 'flat' | 'volumetric';
  freeOver: number | null;
  minimumSubtotal: number | null;
  currency: ShopCurrencyCode;
  enabled: boolean;
};

type ShopBrandShippingRule = {
  id: string;
  brandName: string;
  mode: 'fixed' | 'multiplier' | 'free';
  value: number;
  warehouseRatePerKg: number;
  currency: ShopCurrencyCode;
  enabled: boolean;
};

type ShopTaxRegion = {
  id: string;
  name: string;
  countries: string[];
  regions: string[];
  rate: number;
  appliesToShipping: boolean;
  enabled: boolean;
};

type ShopRegionalPricingRule = {
  id: string;
  name: string;
  countries: string[];
  regions: string[];
  mode: 'percent' | 'fixed';
  value: number;
  currency: ShopCurrencyCode;
  enabled: boolean;
};

type ShopSettingsResponse = {
  key: string;
  b2bVisibilityMode: string;
  defaultB2bDiscountPercent: number | null;
  defaultCurrency: ShopCurrencyCode;
  enabledCurrencies: ShopCurrencyCode[];
  currencyRates: Record<ShopCurrencyCode, number>;
  shippingZones: ShopShippingZone[];
  brandShippingRules: ShopBrandShippingRule[];
  taxRegions: ShopTaxRegion[];
  regionalPricingRules: ShopRegionalPricingRule[];
  orderNotificationEmail: string | null;
  b2bNotes: string | null;
  showTaxesIncludedNotice: boolean;
  fopCompanyName: string | null;
  fopIban: string | null;
  fopBankName: string | null;
  fopEdrpou: string | null;
  fopDetails: string | null;
  whiteBitEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

type ShippingZoneForm = {
  id: string;
  name: string;
  countriesText: string;
  regionsText: string;
  baseRate: string;
  perItemRate: string;
  ratePerKg: string;
  volSurchargePerKg: string;
  volumetricDivisor: string;
  fallbackWeightKg: string;
  fallbackLength: string;
  fallbackWidth: string;
  fallbackHeight: string;
  calcMode: 'flat' | 'volumetric';
  freeOver: string;
  minimumSubtotal: string;
  currency: ShopCurrencyCode;
  enabled: boolean;
};

type BrandShippingRuleForm = {
  id: string;
  brandName: string;
  mode: 'fixed' | 'multiplier' | 'free';
  value: string;
  warehouseRatePerKg: string;
  currency: ShopCurrencyCode;
  enabled: boolean;
};

type TaxRegionForm = {
  id: string;
  name: string;
  countriesText: string;
  regionsText: string;
  rate: string;
  appliesToShipping: boolean;
  enabled: boolean;
};

type ShopSettingsFormState = {
  b2bVisibilityMode: string;
  defaultB2bDiscountPercent: string;
  defaultCurrency: ShopCurrencyCode;
  enabledCurrencies: ShopCurrencyCode[];
  currencyRates: Record<ShopCurrencyCode, string>;
  shippingZones: ShippingZoneForm[];
  brandShippingRules: BrandShippingRuleForm[];
  taxRegions: TaxRegionForm[];
  regionalPricingRules: RegionalPricingRuleForm[];
  orderNotificationEmail: string;
  b2bNotes: string;
  showTaxesIncludedNotice: boolean;
  fopCompanyName: string;
  fopIban: string;
  fopBankName: string;
  fopEdrpou: string;
  fopDetails: string;
  whiteBitEnabled: boolean;
};

type PreviewFormState = {
  currency: ShopCurrencyCode;
  subtotal: string;
  itemCount: string;
  country: string;
  region: string;
  city: string;
  postcode: string;
};

type PreviewResponse = {
  currency: ShopCurrencyCode;
  subtotal: number;
  regionalAdjustmentAmount: number;
  shippingCost: number;
  taxAmount: number;
  total: number;
  itemCount: number;
  shippingZone: null | {
    id: string;
    name: string;
    currency?: ShopCurrencyCode;
  };
  taxRegion: null | {
    id: string;
    name: string;
    rate?: number;
  };
  regionalPricingRule: null | {
    id: string;
    name: string;
    value?: number;
    mode?: 'percent' | 'fixed';
    currency?: ShopCurrencyCode;
  };
  showTaxesIncludedNotice: boolean;
};

type NbuRefreshResponse = {
  settings: ShopSettingsResponse;
  nbu: {
    source: 'nbu';
    exchangedAt: string;
    eurToUah: number;
    usdToUah: number;
    usdPerEur: number;
    usdSpecial: boolean;
  };
};

type EnTranslationResponse = {
  mode: 'dry-run' | 'commit';
  totalLoaded: number;
  candidates: number;
  updated?: number;
  failed?: number;
  stoppedBecauseQuota?: boolean;
  scan: number;
  limit: number;
  includeUnpublished: boolean;
  translateHtml: boolean;
  items: Array<{
    id: string;
    slug: string;
    fields: string[];
  }>;
  errors?: Array<{
    slug: string;
    message: string;
  }>;
};

type RegionalPricingRuleForm = {
  id: string;
  name: string;
  countriesText: string;
  regionsText: string;
  mode: 'percent' | 'fixed';
  value: string;
  currency: ShopCurrencyCode;
  enabled: boolean;
};

const SHOP_CURRENCIES: ShopCurrencyCode[] = ['EUR', 'USD', 'UAH'];

const B2B_OPTIONS = [
  { value: 'approved_only', label: 'Тільки схвалені B2B (оптові ціни приховані)' },
  { value: 'public_dual', label: 'Публічно B2C і B2B (обидва цінові канали видимі)' },
  { value: 'request_quote', label: 'Запит комерційної пропозиції (B2B через запит)' },
] as const;

function formatNumber(value: number | null | undefined) {
  return value == null ? '' : String(value);
}

function splitCommaList(value: string) {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function joinCommaList(values: string[]) {
  return values.join(', ');
}

function parseNumber(value: string, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseNullableNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function createShippingZoneForm(seed: number): ShippingZoneForm {
  return {
    id: `zone-${seed}`,
    name: `Зона доставки ${seed}`,
    countriesText: '*',
    regionsText: '',
    baseRate: '0',
    perItemRate: '0',
    ratePerKg: '1.5',
    volSurchargePerKg: '0.5',
    volumetricDivisor: '5000',
    fallbackWeightKg: '2',
    fallbackLength: '30',
    fallbackWidth: '20',
    fallbackHeight: '15',
    calcMode: 'volumetric',
    freeOver: '',
    minimumSubtotal: '',
    currency: 'EUR',
    enabled: true,
  };
}

function createBrandShippingRuleForm(seed: number): BrandShippingRuleForm {
  return {
    id: `brand-rule-${seed}`,
    brandName: '',
    mode: 'free',
    value: '0',
    warehouseRatePerKg: '0',
    currency: 'EUR',
    enabled: true,
  };
}

function createTaxRegionForm(seed: number): TaxRegionForm {
  return {
    id: `tax-${seed}`,
    name: `Tax rule ${seed}`,
    countriesText: '*',
    regionsText: '',
    rate: '0',
    appliesToShipping: true,
    enabled: false,
  };
}

function createRegionalPricingRuleForm(seed: number): RegionalPricingRuleForm {
  return {
    id: `regional-rule-${seed}`,
    name: `Регіональна корекція ${seed}`,
    countriesText: '*',
    regionsText: '',
    mode: 'percent',
    value: '0',
    currency: 'EUR',
    enabled: false,
  };
}

function createEmptyForm(): ShopSettingsFormState {
  return {
    b2bVisibilityMode: 'approved_only',
    defaultB2bDiscountPercent: '',
    defaultCurrency: 'EUR',
    enabledCurrencies: ['EUR', 'USD', 'UAH'],
    currencyRates: {
      EUR: '1',
      USD: '1.08',
      UAH: '45',
    },
    shippingZones: [createShippingZoneForm(1)],
    brandShippingRules: [],
    taxRegions: [createTaxRegionForm(1)],
    regionalPricingRules: [],
    orderNotificationEmail: '',
    b2bNotes: '',
    showTaxesIncludedNotice: false,
    fopCompanyName: '',
    fopIban: '',
    fopBankName: '',
    fopEdrpou: '',
    fopDetails: '',
    whiteBitEnabled: false,
  };
}

function createPreviewState(currency: ShopCurrencyCode): PreviewFormState {
  return {
    currency,
    subtotal: '1200',
    itemCount: '2',
    country: 'Germany',
    region: '',
    city: 'Berlin',
    postcode: '10115',
  };
}

function settingsToForm(settings: ShopSettingsResponse): ShopSettingsFormState {
  return {
    b2bVisibilityMode: settings.b2bVisibilityMode,
    defaultB2bDiscountPercent: formatNumber(settings.defaultB2bDiscountPercent),
    defaultCurrency: settings.defaultCurrency,
    enabledCurrencies: settings.enabledCurrencies,
    currencyRates: {
      EUR: formatNumber(settings.currencyRates.EUR),
      USD: formatNumber(settings.currencyRates.USD),
      UAH: formatNumber(settings.currencyRates.UAH),
    },
    shippingZones: settings.shippingZones.map((zone) => ({
      id: zone.id,
      name: zone.name,
      countriesText: joinCommaList(zone.countries),
      regionsText: joinCommaList(zone.regions),
      baseRate: formatNumber(zone.baseRate),
      perItemRate: formatNumber(zone.perItemRate),
      ratePerKg: formatNumber(zone.ratePerKg),
      volSurchargePerKg: formatNumber(zone.volSurchargePerKg),
      volumetricDivisor: formatNumber(zone.volumetricDivisor),
      fallbackWeightKg: formatNumber(zone.fallbackWeightKg),
      fallbackLength: formatNumber(zone.fallbackLength),
      fallbackWidth: formatNumber(zone.fallbackWidth),
      fallbackHeight: formatNumber(zone.fallbackHeight),
      calcMode: zone.calcMode,
      freeOver: formatNumber(zone.freeOver),
      minimumSubtotal: formatNumber(zone.minimumSubtotal),
      currency: zone.currency,
      enabled: zone.enabled,
    })),
    brandShippingRules: settings.brandShippingRules?.map((rule) => ({
      id: rule.id,
      brandName: rule.brandName,
      mode: rule.mode,
      value: formatNumber(rule.value),
      warehouseRatePerKg: formatNumber(rule.warehouseRatePerKg),
      currency: rule.currency,
      enabled: rule.enabled,
    })) || [],
    taxRegions: settings.taxRegions.map((region) => ({
      id: region.id,
      name: region.name,
      countriesText: joinCommaList(region.countries),
      regionsText: joinCommaList(region.regions),
      rate: formatNumber(region.rate),
      appliesToShipping: region.appliesToShipping,
      enabled: region.enabled,
    })),
    regionalPricingRules: settings.regionalPricingRules.map((rule) => ({
      id: rule.id,
      name: rule.name,
      countriesText: joinCommaList(rule.countries),
      regionsText: joinCommaList(rule.regions),
      mode: rule.mode,
      value: formatNumber(rule.value),
      currency: rule.currency,
      enabled: rule.enabled,
    })),
    orderNotificationEmail: settings.orderNotificationEmail ?? '',
    b2bNotes: settings.b2bNotes ?? '',
    showTaxesIncludedNotice: settings.showTaxesIncludedNotice ?? false,
    fopCompanyName: settings.fopCompanyName ?? '',
    fopIban: settings.fopIban ?? '',
    fopBankName: settings.fopBankName ?? '',
    fopEdrpou: settings.fopEdrpou ?? '',
    fopDetails: settings.fopDetails ?? '',
    whiteBitEnabled: settings.whiteBitEnabled ?? false,
  };
}

function formToPayload(form: ShopSettingsFormState) {
  return {
    b2bVisibilityMode: form.b2bVisibilityMode,
    defaultB2bDiscountPercent: parseNullableNumber(form.defaultB2bDiscountPercent),
    defaultCurrency: form.defaultCurrency,
    enabledCurrencies: form.enabledCurrencies,
    currencyRates: {
      EUR: parseNumber(form.currencyRates.EUR, 1),
      USD: parseNumber(form.currencyRates.USD, 1.08),
      UAH: parseNumber(form.currencyRates.UAH, 45),
    },
    shippingZones: form.shippingZones.map((zone) => ({
      id: zone.id.trim(),
      name: zone.name.trim(),
      countries: splitCommaList(zone.countriesText),
      regions: splitCommaList(zone.regionsText),
      baseRate: parseNumber(zone.baseRate),
      perItemRate: parseNumber(zone.perItemRate),
      ratePerKg: parseNumber(zone.ratePerKg, 1.5),
      volSurchargePerKg: parseNumber(zone.volSurchargePerKg, 0.5),
      volumetricDivisor: parseNumber(zone.volumetricDivisor, 5000),
      fallbackWeightKg: parseNumber(zone.fallbackWeightKg, 2),
      fallbackLength: parseNumber(zone.fallbackLength, 30),
      fallbackWidth: parseNumber(zone.fallbackWidth, 20),
      fallbackHeight: parseNumber(zone.fallbackHeight, 15),
      calcMode: zone.calcMode,
      freeOver: parseNullableNumber(zone.freeOver),
      minimumSubtotal: parseNullableNumber(zone.minimumSubtotal),
      currency: zone.currency,
      enabled: zone.enabled,
    })),
    brandShippingRules: form.brandShippingRules.map((rule) => ({
      id: rule.id.trim(),
      brandName: rule.brandName.trim(),
      mode: rule.mode,
      value: parseNumber(rule.value),
      warehouseRatePerKg: parseNumber(rule.warehouseRatePerKg),
      currency: rule.currency,
      enabled: rule.enabled,
    })),
    taxRegions: form.taxRegions.map((region) => ({
      id: region.id.trim(),
      name: region.name.trim(),
      countries: splitCommaList(region.countriesText),
      regions: splitCommaList(region.regionsText),
      rate: parseNumber(region.rate),
      appliesToShipping: region.appliesToShipping,
      enabled: region.enabled,
    })),
    regionalPricingRules: form.regionalPricingRules.map((rule) => ({
      id: rule.id.trim(),
      name: rule.name.trim(),
      countries: splitCommaList(rule.countriesText),
      regions: splitCommaList(rule.regionsText),
      mode: rule.mode,
      value: parseNumber(rule.value),
      currency: rule.currency,
      enabled: rule.enabled,
    })),
    orderNotificationEmail: form.orderNotificationEmail.trim() || null,
    b2bNotes: form.b2bNotes.trim() || null,
    showTaxesIncludedNotice: form.showTaxesIncludedNotice,
    fopCompanyName: form.fopCompanyName.trim() || null,
    fopIban: form.fopIban.trim() || null,
    fopBankName: form.fopBankName.trim() || null,
    fopEdrpou: form.fopEdrpou.trim() || null,
    fopDetails: form.fopDetails.trim() || null,
    whiteBitEnabled: form.whiteBitEnabled,
  };
}

function formatMoney(value: number, currency: ShopCurrencyCode) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function moveItem<T>(items: T[], index: number, direction: -1 | 1) {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= items.length) {
    return items;
  }

  const next = [...items];
  const [item] = next.splice(index, 1);
  next.splice(nextIndex, 0, item);
  return next;
}

export default function AdminShopSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [updatedAt, setUpdatedAt] = useState('');
  const [form, setForm] = useState<ShopSettingsFormState>(createEmptyForm());
  const [preview, setPreview] = useState<PreviewFormState>(createPreviewState('EUR'));
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [previewResult, setPreviewResult] = useState<PreviewResponse | null>(null);
  const [currencySyncLoading, setCurrencySyncLoading] = useState(false);
  const [currencySyncMeta, setCurrencySyncMeta] = useState<NbuRefreshResponse['nbu'] | null>(null);
  const [translationLoading, setTranslationLoading] = useState(false);
  const [translationParams, setTranslationParams] = useState({
    scan: '500',
    limit: '50',
    includeUnpublished: false,
    translateHtml: false,
  });
  const [translationResult, setTranslationResult] = useState<EnTranslationResponse | null>(null);

  const settingsMetrics = useMemo(
    () => ({
      currencies: form.enabledCurrencies.length,
      shippingZones: form.shippingZones.length,
      taxRules: form.taxRegions.length,
      regionalRules: form.regionalPricingRules.filter((rule) => rule.enabled).length,
    }),
    [form.enabledCurrencies.length, form.regionalPricingRules, form.shippingZones.length, form.taxRegions.length]
  );

  useEffect(() => {
    void load();
  }, []);

  const exportSettings = () => {
    try {
      const dataStr = JSON.stringify(form, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
      const exportFileDefaultName = `shop-settings-${new Date().toISOString().slice(0, 10)}.json`;

      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
    } catch (e: any) {
      console.error('Failed to export settings', e);
      alert('Помилка при експорті налаштувань');
    }
  };

  const previewPayload = useMemo(
    () =>
      JSON.stringify({
        settings: formToPayload(form),
        preview: {
          currency: preview.currency,
          subtotal: parseNumber(preview.subtotal),
          itemCount: parseNumber(preview.itemCount, 1),
          shippingAddress: {
            line1: 'Preview line 1',
            city: preview.city,
            region: preview.region,
            postcode: preview.postcode,
            country: preview.country,
          },
        },
      }),
    [form, preview]
  );

  useEffect(() => {
    if (loading) return;

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setPreviewLoading(true);
      setPreviewError('');

      try {
        const response = await fetch('/api/admin/shop/settings/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: previewPayload,
          signal: controller.signal,
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.error || 'Не вдалося побудувати попередній перегляд');
        }
        setPreviewResult(data as PreviewResponse);
      } catch (previewRequestError) {
        if ((previewRequestError as Error).name === 'AbortError') {
          return;
        }
        setPreviewError((previewRequestError as Error).message);
      } finally {
        if (!controller.signal.aborted) {
          setPreviewLoading(false);
        }
      }
    }, 300);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [loading, previewPayload]);

  useEffect(() => {
    if (form.enabledCurrencies.includes(preview.currency)) {
      return;
    }

    setPreview((current) => ({
      ...current,
      currency: form.defaultCurrency,
    }));
  }, [form.defaultCurrency, form.enabledCurrencies, preview.currency]);

  async function load() {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const response = await fetch('/api/admin/shop/settings');
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || 'Не вдалося завантажити налаштування магазину');
        return;
      }

      const settings = data as ShopSettingsResponse;
      setForm(settingsToForm(settings));
      setPreview(createPreviewState(settings.defaultCurrency));
      setUpdatedAt(settings.updatedAt);
    } finally {
      setLoading(false);
    }
  }

  function updateField<K extends keyof ShopSettingsFormState>(key: K, value: ShopSettingsFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updatePreviewField<K extends keyof PreviewFormState>(key: K, value: PreviewFormState[K]) {
    setPreview((current) => ({ ...current, [key]: value }));
  }

  function toggleCurrency(currency: ShopCurrencyCode) {
    setForm((current) => {
      const isEnabled = current.enabledCurrencies.includes(currency);
      if (isEnabled && current.enabledCurrencies.length === 1) {
        return current;
      }

      const enabledCurrencies = isEnabled
        ? current.enabledCurrencies.filter((entry) => entry !== currency)
        : [...current.enabledCurrencies, currency];
      const defaultCurrency = enabledCurrencies.includes(current.defaultCurrency)
        ? current.defaultCurrency
        : enabledCurrencies[0];

      return {
        ...current,
        enabledCurrencies,
        defaultCurrency,
      };
    });
  }

  function updateCurrencyRate(currency: ShopCurrencyCode, value: string) {
    setForm((current) => ({
      ...current,
      currencyRates: {
        ...current.currencyRates,
        [currency]: value,
      },
    }));
  }

  function updateShippingZone(index: number, field: keyof ShippingZoneForm, value: ShippingZoneForm[keyof ShippingZoneForm]) {
    setForm((current) => ({
      ...current,
      shippingZones: current.shippingZones.map((zone, zoneIndex) =>
        zoneIndex === index ? { ...zone, [field]: value } : zone
      ),
    }));
  }

  function updateBrandShippingRule(index: number, field: keyof BrandShippingRuleForm, value: BrandShippingRuleForm[keyof BrandShippingRuleForm]) {
    setForm((current) => ({
      ...current,
      brandShippingRules: current.brandShippingRules.map((rule, ruleIndex) =>
        ruleIndex === index ? { ...rule, [field]: value } : rule
      ),
    }));
  }

  function updateTaxRegion(index: number, field: keyof TaxRegionForm, value: TaxRegionForm[keyof TaxRegionForm]) {
    setForm((current) => ({
      ...current,
      taxRegions: current.taxRegions.map((region, regionIndex) =>
        regionIndex === index ? { ...region, [field]: value } : region
      ),
    }));
  }

  function updateRegionalPricingRule(
    index: number,
    field: keyof RegionalPricingRuleForm,
    value: RegionalPricingRuleForm[keyof RegionalPricingRuleForm]
  ) {
    setForm((current) => ({
      ...current,
      regionalPricingRules: current.regionalPricingRules.map((rule, ruleIndex) =>
        ruleIndex === index ? { ...rule, [field]: value } : rule
      ),
    }));
  }

  function addShippingZone() {
    setForm((current) => ({
      ...current,
      shippingZones: [...current.shippingZones, createShippingZoneForm(current.shippingZones.length + 1)],
    }));
  }

  function addBrandShippingRule() {
    setForm((current) => ({
      ...current,
      brandShippingRules: [...current.brandShippingRules, createBrandShippingRuleForm(current.brandShippingRules.length + 1)],
    }));
  }

  function addTaxRegion() {
    setForm((current) => ({
      ...current,
      taxRegions: [...current.taxRegions, createTaxRegionForm(current.taxRegions.length + 1)],
    }));
  }

  function addRegionalPricingRule() {
    setForm((current) => ({
      ...current,
      regionalPricingRules: [...current.regionalPricingRules, createRegionalPricingRuleForm(current.regionalPricingRules.length + 1)],
    }));
  }

  function removeShippingZone(index: number) {
    setForm((current) => ({
      ...current,
      shippingZones: current.shippingZones.filter((_, zoneIndex) => zoneIndex !== index),
    }));
  }

  function removeBrandShippingRule(index: number) {
    setForm((current) => ({
      ...current,
      brandShippingRules: current.brandShippingRules.filter((_, ruleIndex) => ruleIndex !== index),
    }));
  }

  function removeTaxRegion(index: number) {
    setForm((current) => ({
      ...current,
      taxRegions: current.taxRegions.filter((_, regionIndex) => regionIndex !== index),
    }));
  }

  function removeRegionalPricingRule(index: number) {
    setForm((current) => ({
      ...current,
      regionalPricingRules: current.regionalPricingRules.filter((_, ruleIndex) => ruleIndex !== index),
    }));
  }

  function moveShippingZone(index: number, direction: -1 | 1) {
    setForm((current) => ({
      ...current,
      shippingZones: moveItem(current.shippingZones, index, direction),
    }));
  }

  function moveBrandShippingRule(index: number, direction: -1 | 1) {
    setForm((current) => ({
      ...current,
      brandShippingRules: moveItem(current.brandShippingRules, index, direction),
    }));
  }

  function moveTaxRegion(index: number, direction: -1 | 1) {
    setForm((current) => ({
      ...current,
      taxRegions: moveItem(current.taxRegions, index, direction),
    }));
  }

  function moveRegionalPricingRule(index: number, direction: -1 | 1) {
    setForm((current) => ({
      ...current,
      regionalPricingRules: moveItem(current.regionalPricingRules, index, direction),
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/admin/shop/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formToPayload(form)),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Не вдалося зберегти налаштування');
      }

      const settings = data as ShopSettingsResponse;
      setForm(settingsToForm(settings));
      setUpdatedAt(settings.updatedAt);
      setSuccess('Налаштування магазину збережено.');
    } catch (saveError) {
      setError((saveError as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleRefreshRatesFromNbu() {
    setCurrencySyncLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/admin/shop/settings/currency-rates/nbu', {
        method: 'POST',
      });
      const data = (await response.json().catch(() => ({}))) as Partial<NbuRefreshResponse> & { error?: string };
      if (!response.ok || !data.settings || !data.nbu) {
        throw new Error(data.error || 'Не вдалося оновити курси з НБУ');
      }
      const settings = data.settings;
      const nbu = data.nbu;

      setForm((current) => ({
        ...current,
        currencyRates: {
          EUR: formatNumber(settings.currencyRates.EUR),
          USD: formatNumber(settings.currencyRates.USD),
          UAH: formatNumber(settings.currencyRates.UAH),
        },
      }));
      setUpdatedAt(settings.updatedAt);
      setCurrencySyncMeta(nbu);
      setSuccess(
        `Курси з НБУ оновлено. 1 EUR = ${nbu.eurToUah} UAH, 1 EUR = ${nbu.usdPerEur} USD на ${nbu.exchangedAt}.`
      );
    } catch (refreshError) {
      setError((refreshError as Error).message);
    } finally {
      setCurrencySyncLoading(false);
    }
  }

  async function handleEnTranslation(commit: boolean) {
    setTranslationLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/admin/shop/translations/en', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commit,
          scan: parseNumber(translationParams.scan, 500),
          limit: parseNumber(translationParams.limit, 50),
          includeUnpublished: translationParams.includeUnpublished,
          translateHtml: translationParams.translateHtml,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as Partial<EnTranslationResponse> & { error?: string };
      if (!response.ok) {
        throw new Error(data.error || 'Не вдалося запустити EN переклад');
      }

      setTranslationResult(data as EnTranslationResponse);
      if (commit) {
        setSuccess(
          data.stoppedBecauseQuota
            ? `DeepL зупинив переклад через квоту. Оновлено ${data.updated ?? 0} товарів.`
            : `EN переклад завершено. Оновлено ${data.updated ?? 0} товарів.`
        );
      } else {
        setSuccess(`Сканування EN полів завершено. Кандидатів: ${data.candidates ?? 0}.`);
      }
    } catch (translationError) {
      setError((translationError as Error).message);
    } finally {
      setTranslationLoading(false);
    }
  }

  if (loading) {
    return (
      <AdminPage>
        <div className="flex items-center gap-3 rounded-[28px] border border-white/10 bg-[#101010] px-5 py-6 text-sm text-stone-400">
          <Settings2 className="h-4 w-4 animate-pulse" />
          Завантаження налаштувань магазину…
        </div>
      </AdminPage>
    );
  }

  return (
    <AdminPage className="space-y-6">
      <div className="space-y-4">
        <Link href="/admin/shop" className="inline-flex items-center gap-2 text-sm text-stone-400 transition hover:text-stone-100">
          Назад до каталогу
        </Link>
        <AdminPageHeader
          eyebrow="Catalog"
          title="Налаштування магазину"
          description="Валюти вітрини, правила доставки та податків, видимість B2B, платіжні реквізити та операційні інтеграції каталогу. Порядок правил важливий: застосовується перша збіжна зона доставки або податкове правило."
          actions={
            <div className="rounded-[24px] border border-white/10 bg-[#101010] px-4 py-3 text-right">
              <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-stone-500">Оновлено</div>
              <div className="mt-2 text-sm text-stone-200">{updatedAt ? new Date(updatedAt).toLocaleString() : '—'}</div>
            </div>
          }
        />
      </div>

      <AdminMetricGrid>
        <AdminMetricCard label="Enabled currencies" value={settingsMetrics.currencies} meta="Storefront currencies available in checkout" tone="accent" />
        <AdminMetricCard label="Shipping zones" value={settingsMetrics.shippingZones} meta="Ordered matching rules for delivery quotes" />
        <AdminMetricCard label="Tax rules" value={settingsMetrics.taxRules} meta="Active tax rule stack for checkout pricing" />
        <AdminMetricCard label="Regional pricing" value={settingsMetrics.regionalRules} meta="Enabled regional price adjustment rules" />
      </AdminMetricGrid>

      {error ? <AdminInlineAlert tone="error">{error}</AdminInlineAlert> : null}
      {success ? <AdminInlineAlert tone="success">{success}</AdminInlineAlert> : null}

      <AdminActionBar className="bg-[#101010]">
        <div className="space-y-1">
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-stone-500">Settings actions</div>
          <div className="text-sm text-stone-300">Save the operational catalog defaults, reload from API, or export the current draft.</div>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            form="admin-shop-settings-form"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-2xl bg-stone-100 px-5 py-2.5 text-sm font-medium text-black transition hover:bg-white disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving…' : 'Save settings'}
          </button>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-2xl border border-white/15 px-5 py-2.5 text-sm text-stone-200 transition hover:bg-white/5"
          >
            Reload
          </button>
          <button
            type="button"
            onClick={exportSettings}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/15 px-5 py-2.5 text-sm text-stone-200 transition hover:bg-white/5"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>
      </AdminActionBar>

      <form id="admin-shop-settings-form" onSubmit={handleSubmit} className="space-y-6">
          <AdminEditorSection
            id="settings-core"
            title="Core rules"
            description="Storefront defaults, global B2B discount policy and operational notification settings."
          >
            <div className="mb-5">
              <h3 className="text-lg font-medium text-white">Core rules</h3>
              <p className="mt-1 text-sm text-white/45">Storefront defaults, global B2B discount policy and team notifications.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <SelectField
                label="Режим видимості B2B"
                value={form.b2bVisibilityMode}
                onChange={(value) => updateField('b2bVisibilityMode', value)}
                options={B2B_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
              />
              <InputField
                label="Default B2B discount %"
                value={form.defaultB2bDiscountPercent}
                onChange={(value) => updateField('defaultB2bDiscountPercent', value)}
                placeholder="8"
              />
              <SelectField
                label="Валюта за замовч."
                value={form.defaultCurrency}
                onChange={(value) => {
                  const nextCurrency = value as ShopCurrencyCode;
                  setForm((current) => ({
                    ...current,
                    defaultCurrency: nextCurrency,
                    enabledCurrencies: current.enabledCurrencies.includes(nextCurrency)
                      ? current.enabledCurrencies
                      : [...current.enabledCurrencies, nextCurrency],
                  }));
                  updatePreviewField('currency', nextCurrency);
                }}
                options={SHOP_CURRENCIES.map((currency) => ({ value: currency, label: currency }))}
              />
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-[1fr_1.2fr_1fr]">
              <InputField
                label="Order notification email"
                value={form.orderNotificationEmail}
                onChange={(value) => updateField('orderNotificationEmail', value)}
                placeholder="sales@onecompany.global"
              />
              <div>
                <div className="mb-1.5 block text-xs text-white/50">Увімкнені валюти</div>
                <div className="flex flex-wrap gap-3">
                  {SHOP_CURRENCIES.map((currency) => (
                    <label key={currency} className="inline-flex items-center gap-2 text-sm text-white/80">
                      <input
                        type="checkbox"
                        checked={form.enabledCurrencies.includes(currency)}
                        onChange={() => toggleCurrency(currency)}
                        className="h-4 w-4 rounded-none border-white/20 bg-zinc-950"
                      />
                      {currency}
                    </label>
                  ))}
                </div>
              </div>
              <TextareaField
                label="Примітки B2B"
                value={form.b2bNotes}
                onChange={(value) => updateField('b2bNotes', value)}
                rows={4}
              />
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <CheckboxField
                label="Показувати “Податки включено”, якщо окремий податок = 0"
                checked={form.showTaxesIncludedNotice}
                onChange={(checked) => updateField('showTaxesIncludedNotice', checked)}
              />
            </div>
          </AdminEditorSection>

          <section className="rounded-none border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-medium text-white">EN переклад каталогу</h3>
                <p className="mt-1 max-w-[1920px] text-sm text-white/45">
                  DeepL backfill для товарів, де англійські назви чи описи порожні, дублюють українську або ще містять кирилицю.
                </p>
              </div>
              <div className="rounded-none border border-white/10 bg-zinc-950 px-3 py-2 text-xs text-white/45">
                <div>Оновлює: titleEn, seoTitleEn, shortDescEn, longDescEn</div>
                <div className="mt-1">HTML-опис можна вмикати окремо, щоб не спалювати квоту зайвими текстами.</div>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-[160px_160px_1fr]">
              <InputField
                label="Сканувати записів"
                value={translationParams.scan}
                onChange={(value) => setTranslationParams((current) => ({ ...current, scan: value }))}
                placeholder="500"
              />
              <InputField
                label="Макс. оновлень"
                value={translationParams.limit}
                onChange={(value) => setTranslationParams((current) => ({ ...current, limit: value }))}
                placeholder="50"
              />
              <div className="grid gap-3 md:grid-cols-2">
                <CheckboxField
                  label="Включати неопубліковані товари"
                  checked={translationParams.includeUnpublished}
                  onChange={(checked) => setTranslationParams((current) => ({ ...current, includeUnpublished: checked }))}
                />
                <CheckboxField
                  label="Перекладати HTML bodyHtmlEn"
                  checked={translationParams.translateHtml}
                  onChange={(checked) => setTranslationParams((current) => ({ ...current, translateHtml: checked }))}
                />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void handleEnTranslation(false)}
                disabled={translationLoading}
                className="inline-flex items-center gap-2 rounded-none border border-white/15 px-4 py-2 text-sm text-white hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Globe2 className="h-4 w-4" />
                Сканувати EN прогалини
              </button>
              <button
                type="button"
                onClick={() => void handleEnTranslation(true)}
                disabled={translationLoading}
                className="inline-flex items-center gap-2 rounded-none bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${translationLoading ? 'animate-spin' : ''}`} />
                Перекласти EN через DeepL
              </button>
            </div>
            {translationResult ? (
              <div className="mt-4 rounded-none border border-white/10 bg-zinc-950/60 p-4">
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="rounded-none border border-white/10 bg-white/[0.03] p-3">
                    <div className="text-[11px] uppercase tracking-[0.24em] text-white/35">Завантажено</div>
                    <div className="mt-2 text-lg font-medium text-white">{translationResult.totalLoaded}</div>
                  </div>
                  <div className="rounded-none border border-white/10 bg-white/[0.03] p-3">
                    <div className="text-[11px] uppercase tracking-[0.24em] text-white/35">Кандидати</div>
                    <div className="mt-2 text-lg font-medium text-white">{translationResult.candidates}</div>
                  </div>
                  <div className="rounded-none border border-white/10 bg-white/[0.03] p-3">
                    <div className="text-[11px] uppercase tracking-[0.24em] text-white/35">Оновлено</div>
                    <div className="mt-2 text-lg font-medium text-emerald-200">{translationResult.updated ?? 0}</div>
                  </div>
                  <div className="rounded-none border border-white/10 bg-white/[0.03] p-3">
                    <div className="text-[11px] uppercase tracking-[0.24em] text-white/35">Помилки</div>
                    <div className="mt-2 text-lg font-medium text-amber-200">{translationResult.failed ?? 0}</div>
                  </div>
                </div>
                {translationResult.stoppedBecauseQuota ? (
                  <div className="mt-4 rounded-none border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                    DeepL зупинився через вичерпану квоту. Уже перекладені записи збережені.
                  </div>
                ) : null}
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <div className="text-xs uppercase tracking-[0.24em] text-white/35">Перші кандидати</div>
                    <div className="mt-3 space-y-2">
                      {translationResult.items.length ? (
                        translationResult.items.slice(0, 8).map((item) => (
                          <div key={item.id} className="rounded-none border border-white/10 bg-white/[0.03] px-3 py-2">
                            <div className="text-sm font-medium text-white">{item.slug}</div>
                            <div className="mt-1 text-xs text-white/45">{item.fields.join(', ')}</div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-none border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/50">
                          Немає кандидатів на переклад.
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.24em] text-white/35">Останні помилки</div>
                    <div className="mt-3 space-y-2">
                      {translationResult.errors?.length ? (
                        translationResult.errors.slice(0, 8).map((item, index) => (
                          <div key={`${item.slug}-${index}`} className="rounded-none border border-red-500/15 bg-red-950/10 px-3 py-2">
                            <div className="text-sm font-medium text-red-100">{item.slug}</div>
                            <div className="mt-1 text-xs text-red-200/70">{item.message}</div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-none border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/50">
                          Порожньо. Якщо все добре, тут не буде записів.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </section>

          <section className="rounded-none border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-5">
              <h3 className="text-lg font-medium text-white">Оплата</h3>
              <p className="mt-1 text-sm text-white/45">Оплата на ФОП (реквізити), Stripe (картка), White Bit (згодом).</p>
            </div>
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <InputField
                  label="ФОП — назва / ПІБ"
                  value={form.fopCompanyName}
                  onChange={(value) => updateField('fopCompanyName', value)}
                  placeholder="ФОП Іваненко І. І."
                />
                <InputField
                  label="ФОП — IBAN"
                  value={form.fopIban}
                  onChange={(value) => updateField('fopIban', value)}
                  placeholder="UA123456789012345678901234567"
                />
                <InputField
                  label="ФОП — банк"
                  value={form.fopBankName}
                  onChange={(value) => updateField('fopBankName', value)}
                  placeholder="ПриватБанк"
                />
                <InputField
                  label="ФОП — ЄДРПОУ"
                  value={form.fopEdrpou}
                  onChange={(value) => updateField('fopEdrpou', value)}
                  placeholder="12345678"
                />
              </div>
              <TextareaField
                label="ФОП — додаткові реквізити (текст)"
                value={form.fopDetails}
                onChange={(value) => updateField('fopDetails', value)}
                rows={3}
              />
              <div className="mt-8 flex flex-col gap-4">
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-white/80">
                  <input
                    type="checkbox"
                    checked={form.whiteBitEnabled}
                    onChange={(e) => updateField('whiteBitEnabled', e.target.checked)}
                    className="h-4 w-4 rounded-none border-white/20 bg-zinc-950"
                  />
                  Увімкнено White Bit (згодом)
                </label>
                <p className="text-xs text-white/45">
                  White Bit (незабаром): налаштуйте ключі доступу в середовищі.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-none border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-medium text-white">Валюти</h3>
                <p className="mt-1 text-sm text-white/45">
                  Опорні курси відносно EUR. Якщо у товару немає ціни в валюті, оформлення використовує ці курси.
                </p>
              </div>
              <div className="flex flex-wrap items-start justify-end gap-3">
                <button
                  type="button"
                  onClick={handleRefreshRatesFromNbu}
                  disabled={currencySyncLoading}
                  className="inline-flex items-center gap-2 rounded-none border border-white/15 px-4 py-2 text-sm text-white hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RefreshCw className={`h-4 w-4 ${currencySyncLoading ? 'animate-spin' : ''}`} />
                  Оновити з НБУ
                </button>
                <div className="rounded-none border border-white/10 bg-zinc-950 px-3 py-2 text-xs text-white/50">
                  <div>Приклад: 1 EUR = {form.currencyRates.USD || '1.08'} USD</div>
                  {currencySyncMeta ? (
                    <div className="mt-1 text-[11px] text-white/35">
                      НБУ: {currencySyncMeta.exchangedAt}
                      {currencySyncMeta.usdSpecial ? ' · USD за особливих умов' : ''}
                    </div>
                  ) : (
                    <div className="mt-1 text-[11px] text-white/35">Джерело: офіційний курс НБУ</div>
                  )}
                </div>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {SHOP_CURRENCIES.map((currency) => (
                <div key={currency} className="rounded-none border border-white/10 bg-zinc-950/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-white">{currency}</div>
                      <div className="mt-1 text-xs text-white/45">
                        {form.defaultCurrency === currency ? 'Валюта вітрини за замовч.' : 'Резервна валюта конвертації'}
                      </div>
                    </div>
                    <span
                      className={`rounded-none-full border px-2 py-0.5 text-[11px] ${
                        form.enabledCurrencies.includes(currency)
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                          : 'border-white/10 bg-white/5 text-white/40'
                      }`}
                    >
                      {form.enabledCurrencies.includes(currency) ? 'Увімкнено' : 'Вимкнено'}
                    </span>
                  </div>
                  <div className="mt-4">
                    <InputField
                      label="Курс до EUR"
                      value={form.currencyRates[currency]}
                      onChange={(value) => updateCurrencyRate(currency, value)}
                      placeholder="0"
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-none border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-medium text-white">Зони доставки</h3>
                <p className="mt-1 text-sm text-white/45">
                  Правила доставки по регіонах. При оформленні замовлення застосовується перша збіжна увімкнена зона.
                </p>
              </div>
              <button
                type="button"
                onClick={addShippingZone}
                className="inline-flex items-center gap-2 rounded-none border border-white/15 px-4 py-2 text-sm text-white hover:bg-white/5"
              >
                <Plus className="h-4 w-4" />
                Додати зону доставки
              </button>
            </div>
            <div className="space-y-4">
              {form.shippingZones.map((zone, index) => (
                <div key={`${zone.id}-${index}`} className="rounded-none border border-white/10 bg-zinc-950/70 p-4">
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-medium text-white">
                        <Globe2 className="h-4 w-4 text-white/55" />
                        {zone.name || `Зона доставки ${index + 1}`}
                      </div>
                      <div className="mt-1 text-xs font-mono text-white/40">{zone.id || 'missing-id'}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => moveShippingZone(index, -1)}
                        disabled={index === 0}
                        className="rounded-none border border-white/15 p-2 text-white/70 hover:bg-white/10 disabled:opacity-35"
                        title="Вгору"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveShippingZone(index, 1)}
                        disabled={index === form.shippingZones.length - 1}
                        className="rounded-none border border-white/15 p-2 text-white/70 hover:bg-white/10 disabled:opacity-35"
                        title="Вниз"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeShippingZone(index)}
                        className="rounded-none border border-red-500/25 p-2 text-red-300 hover:bg-red-950/30 border border-red-900/50 text-red-500/10"
                        title="Видалити зону"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <InputField
                      label="ID зони"
                      value={zone.id}
                      onChange={(value) => updateShippingZone(index, 'id', value)}
                      placeholder="worldwide-standard"
                    />
                    <InputField
                      label="Назва зони"
                      value={zone.name}
                      onChange={(value) => updateShippingZone(index, 'name', value)}
                      placeholder="Worldwide"
                    />
                    <InputField
                      label="Країни"
                      value={zone.countriesText}
                      onChange={(value) => updateShippingZone(index, 'countriesText', value)}
                      placeholder="DE, FR, IT or *"
                    />
                    <InputField
                      label="Регіони"
                      value={zone.regionsText}
                      onChange={(value) => updateShippingZone(index, 'regionsText', value)}
                      placeholder="Berlin, Bavaria"
                    />
                    <SelectField
                      label="Валюта тарифу"
                      value={zone.currency}
                      onChange={(value) => updateShippingZone(index, 'currency', value as ShopCurrencyCode)}
                      options={SHOP_CURRENCIES.map((currency) => ({ value: currency, label: currency }))}
                    />
                    <SelectField
                      label="Модель розрахунку"
                      value={zone.calcMode}
                      onChange={(value) => updateShippingZone(index, 'calcMode', value as 'flat' | 'volumetric')}
                      options={[
                        { value: 'flat', label: 'За кількість (Flat)' },
                        { value: 'volumetric', label: 'За вагою (Volumetric)' },
                      ]}
                    />
                    <InputField
                      label="Базовий тариф"
                      value={zone.baseRate}
                      onChange={(value) => updateShippingZone(index, 'baseRate', value)}
                      placeholder="95"
                    />
                    <InputField
                      label={zone.calcMode === 'volumetric' ? 'Тариф за одиницю (ігнорується)' : 'Тариф за одиницю'}
                      value={zone.perItemRate}
                      onChange={(value) => updateShippingZone(index, 'perItemRate', value)}
                      placeholder="0"
                      disabled={zone.calcMode === 'volumetric'}
                    />
                    <InputField
                      label={zone.calcMode === 'flat' ? 'Тариф за КГ (ігнорується)' : 'Тариф за КГ'}
                      value={zone.ratePerKg}
                      onChange={(value) => updateShippingZone(index, 'ratePerKg', value)}
                      placeholder="1.5"
                      disabled={zone.calcMode === 'flat'}
                    />
                    <InputField
                      label={zone.calcMode === 'flat' ? 'Об\'ємна вага за КГ (ігнорується)' : 'Об\'ємна вага за КГ'}
                      value={zone.volSurchargePerKg}
                      onChange={(value) => updateShippingZone(index, 'volSurchargePerKg', value)}
                      placeholder="0.5"
                      disabled={zone.calcMode === 'flat'}
                    />
                    <InputField
                      label={zone.calcMode === 'flat' ? 'Ділитель (ігнорується)' : 'Ділитель габаритів (напр. 5000)'}
                      value={zone.volumetricDivisor}
                      onChange={(value) => updateShippingZone(index, 'volumetricDivisor', value)}
                      placeholder="5000"
                      disabled={zone.calcMode === 'flat'}
                    />
                    <InputField
                      label={zone.calcMode === 'flat' ? 'Вага за замовч. (ігнорується)' : 'Вага за замовч. (КГ)'}
                      value={zone.fallbackWeightKg}
                      onChange={(value) => updateShippingZone(index, 'fallbackWeightKg', value)}
                      placeholder="2"
                      disabled={zone.calcMode === 'flat'}
                    />
                    <div className="flex gap-4 col-span-1 md:col-span-2">
                       <InputField
                         label={zone.calcMode === 'flat' ? 'Довжина замовч. (ігн)' : 'Довжина замовч. (см)'}
                         value={zone.fallbackLength}
                         onChange={(value) => updateShippingZone(index, 'fallbackLength', value)}
                         placeholder="30"
                         disabled={zone.calcMode === 'flat'}
                       />
                       <InputField
                         label={zone.calcMode === 'flat' ? 'Ширина замовч. (ігн)' : 'Ширина замовч. (см)'}
                         value={zone.fallbackWidth}
                         onChange={(value) => updateShippingZone(index, 'fallbackWidth', value)}
                         placeholder="20"
                         disabled={zone.calcMode === 'flat'}
                       />
                       <InputField
                         label={zone.calcMode === 'flat' ? 'Висота замовч. (ігн)' : 'Висота замовч. (см)'}
                         value={zone.fallbackHeight}
                         onChange={(value) => updateShippingZone(index, 'fallbackHeight', value)}
                         placeholder="15"
                         disabled={zone.calcMode === 'flat'}
                       />
                    </div>
                    <InputField
                      label="Безкоштовна доставка від"
                      value={zone.freeOver}
                      onChange={(value) => updateShippingZone(index, 'freeOver', value)}
                      placeholder="2500"
                    />
                    <InputField
                      label="Мінімальна сума замовлення"
                      value={zone.minimumSubtotal}
                      onChange={(value) => updateShippingZone(index, 'minimumSubtotal', value)}
                      placeholder="Необов'язково"
                    />
                    <CheckboxField
                      label="Увімкнено"
                      checked={zone.enabled}
                      onChange={(checked) => updateShippingZone(index, 'enabled', checked)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-none border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-medium text-white">Правила доставки брендів</h3>
                <p className="mt-1 text-sm text-white/45">
                  Спеціальні умови для окремих брендів. Працюють тільки якщо Модель розрахунку обрана як 'Volumetric' у зоні.
                </p>
              </div>
              <button
                type="button"
                onClick={addBrandShippingRule}
                className="inline-flex items-center gap-2 rounded-none border border-white/15 px-4 py-2 text-sm text-white hover:bg-white/5"
              >
                <Plus className="h-4 w-4" />
                Додати правило бренду
              </button>
            </div>
            <div className="space-y-4">
              {form.brandShippingRules.map((rule, index) => (
                <div key={`${rule.id}-${index}`} className="rounded-none border border-white/10 bg-zinc-950/70 p-4">
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-medium text-white">
                        <Globe2 className="h-4 w-4 text-white/55" />
                        {rule.brandName || `Правило бренду ${index + 1}`}
                      </div>
                      <div className="mt-1 text-xs font-mono text-white/40">{rule.id || 'missing-id'}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => moveBrandShippingRule(index, -1)}
                        disabled={index === 0}
                        className="rounded-none border border-white/15 p-2 text-white/70 hover:bg-white/10 disabled:opacity-35"
                        title="Вгору"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveBrandShippingRule(index, 1)}
                        disabled={index === form.brandShippingRules.length - 1}
                        className="rounded-none border border-white/15 p-2 text-white/70 hover:bg-white/10 disabled:opacity-35"
                        title="Вниз"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeBrandShippingRule(index)}
                        className="rounded-none border border-red-500/25 p-2 text-red-300 hover:bg-red-950/30 border border-red-900/50 text-red-500/10"
                        title="Видалити"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <InputField
                      label="ID правила"
                      value={rule.id}
                      onChange={(value) => updateBrandShippingRule(index, 'id', value)}
                      placeholder="do88-free"
                    />
                    <InputField
                      label="Бренд"
                      value={rule.brandName}
                      onChange={(value) => updateBrandShippingRule(index, 'brandName', value)}
                      placeholder="DO88"
                    />
                    <SelectField
                      label="Тип правила"
                      value={rule.mode}
                      onChange={(value) => updateBrandShippingRule(index, 'mode', value as 'free' | 'multiplier' | 'fixed')}
                      options={[
                        { value: 'free', label: 'Безкоштовно (Free)' },
                        { value: 'multiplier', label: 'Множник ваги (Multiplier)' },
                        { value: 'fixed', label: 'Фіксована ставка (Fixed)' },
                      ]}
                    />
                    <InputField
                      label={rule.mode === 'free' ? 'Значення (ігнорується)' : 'Значення'}
                      value={rule.value}
                      onChange={(value) => updateBrandShippingRule(index, 'value', value)}
                      placeholder={rule.mode === 'multiplier' ? '1.25' : '150'}
                      disabled={rule.mode === 'free'}
                    />
                    <InputField
                      label="Доставка: Виробник → Склад (за 1 КГ)"
                      value={rule.warehouseRatePerKg}
                      onChange={(value) => updateBrandShippingRule(index, 'warehouseRatePerKg', value)}
                      placeholder="Напр. 5"
                    />
                    <SelectField
                      label="Валюта (тільки Fixed)"
                      value={rule.currency}
                      onChange={(value) => updateBrandShippingRule(index, 'currency', value as ShopCurrencyCode)}
                      options={SHOP_CURRENCIES.map((currency) => ({ value: currency, label: currency }))}
                    />
                    <CheckboxField
                      label="Увімкнено"
                      checked={rule.enabled}
                      onChange={(checked) => updateBrandShippingRule(index, 'enabled', checked)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-none border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-medium text-white">Правила податку</h3>
                <p className="mt-1 text-sm text-white/45">
                  До оформлення застосовується перше збіжне увімкнене правило. Включати доставку в базу оподаткування лише якщо це вимагає локальне правило.
                </p>
              </div>
              <button
                type="button"
                onClick={addTaxRegion}
                className="inline-flex items-center gap-2 rounded-none border border-white/15 px-4 py-2 text-sm text-white hover:bg-white/5"
              >
                <Plus className="h-4 w-4" />
                Додати правило податку
              </button>
            </div>
            <div className="space-y-4">
              {form.taxRegions.map((region, index) => (
                <div key={`${region.id}-${index}`} className="rounded-none border border-white/10 bg-zinc-950/70 p-4">
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-medium text-white">
                        <Percent className="h-4 w-4 text-white/55" />
                        {region.name || `Tax rule ${index + 1}`}
                      </div>
                      <div className="mt-1 text-xs font-mono text-white/40">{region.id || 'missing-id'}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => moveTaxRegion(index, -1)}
                        disabled={index === 0}
                        className="rounded-none border border-white/15 p-2 text-white/70 hover:bg-white/10 disabled:opacity-35"
                        title="Вгору"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveTaxRegion(index, 1)}
                        disabled={index === form.taxRegions.length - 1}
                        className="rounded-none border border-white/15 p-2 text-white/70 hover:bg-white/10 disabled:opacity-35"
                        title="Вниз"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeTaxRegion(index)}
                        className="rounded-none border border-red-500/25 p-2 text-red-300 hover:bg-red-950/30 border border-red-900/50 text-red-500/10"
                        title="Видалити правило податку"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <InputField
                      label="ID правила"
                      value={region.id}
                      onChange={(value) => updateTaxRegion(index, 'id', value)}
                      placeholder="eu-vat"
                    />
                    <InputField
                      label="Назва правила"
                      value={region.name}
                      onChange={(value) => updateTaxRegion(index, 'name', value)}
                      placeholder="EU VAT"
                    />
                    <InputField
                      label="Країни"
                      value={region.countriesText}
                      onChange={(value) => updateTaxRegion(index, 'countriesText', value)}
                      placeholder="DE, FR, IT or *"
                    />
                    <InputField
                      label="Регіони"
                      value={region.regionsText}
                      onChange={(value) => updateTaxRegion(index, 'regionsText', value)}
                      placeholder="Berlin, Bavaria"
                    />
                    <InputField
                      label="Ставка податку"
                      value={region.rate}
                      onChange={(value) => updateTaxRegion(index, 'rate', value)}
                      placeholder="0.2"
                    />
                    <CheckboxField
                      label="Застосовувати до доставки"
                      checked={region.appliesToShipping}
                      onChange={(checked) => updateTaxRegion(index, 'appliesToShipping', checked)}
                    />
                    <CheckboxField
                      label="Увімкнено"
                      checked={region.enabled}
                      onChange={(checked) => updateTaxRegion(index, 'enabled', checked)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-none border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-medium text-white">Регіональна корекція ціни</h3>
                <p className="mt-1 text-sm text-white/45">
                  Використовуйте для націнок або знижок по країнах і регіонах. Наприклад: США = -10%, UAE = +12%. Застосовується перше збіжне увімкнене правило.
                </p>
              </div>
              <button
                type="button"
                onClick={addRegionalPricingRule}
                className="inline-flex items-center gap-2 rounded-none border border-white/15 px-4 py-2 text-sm text-white hover:bg-white/5"
              >
                <Plus className="h-4 w-4" />
                Додати регіональне правило
              </button>
            </div>
            <div className="space-y-4">
              {form.regionalPricingRules.length ? form.regionalPricingRules.map((rule, index) => (
                <div key={`${rule.id}-${index}`} className="rounded-none border border-white/10 bg-zinc-950/70 p-4">
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-medium text-white">
                        <Globe2 className="h-4 w-4 text-white/55" />
                        {rule.name || `Regional rule ${index + 1}`}
                      </div>
                      <div className="mt-1 text-xs font-mono text-white/40">{rule.id || 'missing-id'}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => moveRegionalPricingRule(index, -1)}
                        disabled={index === 0}
                        className="rounded-none border border-white/15 p-2 text-white/70 hover:bg-white/10 disabled:opacity-35"
                        title="Вгору"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveRegionalPricingRule(index, 1)}
                        disabled={index === form.regionalPricingRules.length - 1}
                        className="rounded-none border border-white/15 p-2 text-white/70 hover:bg-white/10 disabled:opacity-35"
                        title="Вниз"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeRegionalPricingRule(index)}
                        className="rounded-none border border-red-500/25 p-2 text-red-300 hover:bg-red-950/30 border border-red-900/50 text-red-500/10"
                        title="Видалити регіональне правило"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <InputField
                      label="ID правила"
                      value={rule.id}
                      onChange={(value) => updateRegionalPricingRule(index, 'id', value)}
                      placeholder="us-minus-10"
                    />
                    <InputField
                      label="Назва правила"
                      value={rule.name}
                      onChange={(value) => updateRegionalPricingRule(index, 'name', value)}
                      placeholder="USA -10%"
                    />
                    <InputField
                      label="Країни"
                      value={rule.countriesText}
                      onChange={(value) => updateRegionalPricingRule(index, 'countriesText', value)}
                      placeholder="US, USA"
                    />
                    <InputField
                      label="Регіони"
                      value={rule.regionsText}
                      onChange={(value) => updateRegionalPricingRule(index, 'regionsText', value)}
                      placeholder="California, Texas"
                    />
                    <SelectField
                      label="Тип корекції"
                      value={rule.mode}
                      onChange={(value) => updateRegionalPricingRule(index, 'mode', value as 'percent' | 'fixed')}
                      options={[
                        { value: 'percent', label: 'Відсоток' },
                        { value: 'fixed', label: 'Фіксована сума' },
                      ]}
                    />
                    <InputField
                      label={rule.mode === 'percent' ? 'Значення %' : 'Сума корекції'}
                      value={rule.value}
                      onChange={(value) => updateRegionalPricingRule(index, 'value', value)}
                      placeholder={rule.mode === 'percent' ? '-10' : '-150'}
                    />
                    <SelectField
                      label="Валюта суми"
                      value={rule.currency}
                      onChange={(value) => updateRegionalPricingRule(index, 'currency', value as ShopCurrencyCode)}
                      options={SHOP_CURRENCIES.map((currency) => ({ value: currency, label: currency }))}
                    />
                    <CheckboxField
                      label="Увімкнено"
                      checked={rule.enabled}
                      onChange={(checked) => updateRegionalPricingRule(index, 'enabled', checked)}
                    />
                  </div>
                </div>
              )) : (
                <div className="rounded-none border border-dashed border-white/10 bg-zinc-950/40 p-4 text-sm text-white/40">
                  Наразі регіональних корекцій ціни немає. Додайте правило, якщо хочете окрему ціну для США, ОАЕ або іншого ринку.
                </div>
              )}
            </div>
          </section>

          <section className="rounded-none border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-medium text-white">Попередній перегляд оформлення</h3>
                <p className="mt-1 text-sm text-white/45">
                  Перегляд використовує той самий движок цін, що й оформлення замовлення, і показує незбережені зміни до натискання «Зберегти».
                </p>
              </div>
              {previewLoading ? (
                <div className="rounded-none border border-white/10 bg-zinc-950 px-3 py-2 text-xs text-white/50">Refreshing preview…</div>
              ) : null}
            </div>
            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="grid gap-4 md:grid-cols-2">
                <SelectField
                  label="Preview currency"
                  value={preview.currency}
                  onChange={(value) => updatePreviewField('currency', value as ShopCurrencyCode)}
                  options={form.enabledCurrencies.map((currency) => ({ value: currency, label: currency }))}
                />
                <InputField
                  label="Preview subtotal"
                  value={preview.subtotal}
                  onChange={(value) => updatePreviewField('subtotal', value)}
                  placeholder="1200"
                />
                <InputField
                  label="Item count"
                  value={preview.itemCount}
                  onChange={(value) => updatePreviewField('itemCount', value)}
                  placeholder="2"
                />
                <InputField
                  label="Country"
                  value={preview.country}
                  onChange={(value) => updatePreviewField('country', value)}
                  placeholder="Germany"
                />
                <InputField
                  label="Region / State"
                  value={preview.region}
                  onChange={(value) => updatePreviewField('region', value)}
                  placeholder="Bavaria"
                />
                <InputField
                  label="City"
                  value={preview.city}
                  onChange={(value) => updatePreviewField('city', value)}
                  placeholder="Berlin"
                />
                <InputField
                  label="Postcode"
                  value={preview.postcode}
                  onChange={(value) => updatePreviewField('postcode', value)}
                  placeholder="10115"
                />
              </div>
              <div className="rounded-none border border-white/10 bg-zinc-950/70 p-4">
                {previewError ? (
                  <div className="rounded-none bg-red-900/20 p-3 text-sm text-red-300">{previewError}</div>
                ) : previewResult ? (
                  <div className="space-y-4">
                    <div className="grid gap-3 text-sm">
                      <SummaryRow
                        label="Subtotal"
                        value={formatMoney(previewResult.subtotal, previewResult.currency)}
                      />
                      <SummaryRow
                        label="Regional adjustment"
                        value={formatMoney(previewResult.regionalAdjustmentAmount, previewResult.currency)}
                      />
                      <SummaryRow
                        label="Shipping"
                        value={formatMoney(previewResult.shippingCost, previewResult.currency)}
                      />
                      <SummaryRow
                        label="Tax"
                        value={
                          previewResult.taxAmount > 0
                            ? formatMoney(previewResult.taxAmount, previewResult.currency)
                            : previewResult.showTaxesIncludedNotice
                              ? 'Taxes included'
                              : formatMoney(previewResult.taxAmount, previewResult.currency)
                        }
                      />
                      <SummaryRow
                        label="Total"
                        value={formatMoney(previewResult.total, previewResult.currency)}
                        strong
                      />
                    </div>
                    <div className="grid gap-3 rounded-none border border-white/10 bg-white/[0.03] p-3 text-sm text-white/70">
                      <SummaryRow
                        label="Matched shipping zone"
                        value={previewResult.shippingZone ? `${previewResult.shippingZone.name} (${previewResult.shippingZone.id})` : 'No match'}
                      />
                      <SummaryRow
                        label="Matched tax rule"
                        value={
                          previewResult.taxRegion
                            ? `${previewResult.taxRegion.name} (${previewResult.taxRegion.id})`
                            : 'No match'
                        }
                      />
                      <SummaryRow
                        label="Matched regional rule"
                        value={
                          previewResult.regionalPricingRule
                            ? `${previewResult.regionalPricingRule.name} (${previewResult.regionalPricingRule.id})`
                            : 'No match'
                        }
                      />
                      <SummaryRow label="Preview item count" value={String(previewResult.itemCount)} />
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-white/45">Preview will appear once the pricing engine responds.</div>
                )}
              </div>
            </div>
          </section>

          <div className="flex flex-wrap gap-3 pb-6">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-none bg-white px-5 py-2.5 text-sm font-medium text-black hover:bg-white/90 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Saving…' : 'Save settings'}
            </button>
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-none border border-white/15 px-5 py-2.5 text-sm text-white hover:bg-white/5"
            >
              Reload
            </button>
            <button
              type="button"
              onClick={exportSettings}
              className="inline-flex items-center gap-2 rounded-none border border-white/15 px-5 py-2.5 text-sm text-white hover:bg-white/5"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
          </div>
        </form>

        {/* Product Feed Links */}
        <section className="mt-6 rounded-none border border-white/10 bg-white/[0.03] p-5">
          <h3 className="text-lg font-medium text-white mb-1">Product Feed (Google Merchant)</h3>
          <p className="text-sm text-white/45 mb-4">
            XML-фід для Google Merchant Center, Facebook та маркетплейсів.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {[
              { label: '🇺🇦 UA · EUR', url: '/api/shop/feed/products?locale=ua&currency=EUR' },
              { label: '🇺🇦 UA · USD', url: '/api/shop/feed/products?locale=ua&currency=USD' },
              { label: '🇬🇧 EN · EUR', url: '/api/shop/feed/products?locale=en&currency=EUR' },
              { label: '🇬🇧 EN · USD', url: '/api/shop/feed/products?locale=en&currency=USD' },
            ].map(feed => (
              <div key={feed.url} className="flex items-center gap-3 rounded-none border border-white/10 bg-zinc-950/40 p-3">
                <span className="text-xs text-white/60 shrink-0">{feed.label}</span>
                <code className="flex-1 text-[10px] text-white/40 truncate font-mono">{feed.url}</code>
                <button
                  type="button"
                  onClick={() => { navigator.clipboard.writeText(window.location.origin + feed.url).catch(() => {}); }}
                  className="shrink-0 rounded-none border border-white/10 px-2 py-1 text-[10px] text-white/50 hover:text-white hover:bg-white/5 transition-colors"
                >
                  Копіювати
                </button>
              </div>
            ))}
          </div>
        </section>
        
        {/* Turn14 Dimensions Sync */}
        <section className="mt-6 rounded-none border border-white/10 bg-white/[0.03] p-5">
          <div className="mb-5">
            <h3 className="text-lg font-medium text-white mb-1">Синхронізація логістики з Turn14</h3>
            <p className="text-sm text-white/45 max-w-2xl">
              Автоматичне заповнення точних розмірів та ваги товару за допомогою Turn14 API. Скрипт знайде всі локальні товари без ваги, які відповідають Turn14-артикулам, і заповнить їх.
            </p>
          </div>
          <button
            type="button"
            disabled={saving} // using saving state to block multiple requests
            onClick={async () => {
              if (!confirm('Запустити масове оновлення розмірів на основі Turn14? Це може зайняти хвилину.')) return;
              try {
                const res = await fetch('/api/admin/shop/turn14/sync-dimensions', { method: 'POST' });
                const json = await res.json();
                if (res.ok) {
                  alert(`Синхронізацію успішно завершено! Оновлено товарів: ${json.updatedCount || 0}.`);
                } else {
                  alert(`Помилка: ${json.error}`);
                }
              } catch (e: any) {
                alert(`Помилка мережі: ${e.message}`);
              }
            }}
            className="inline-flex items-center gap-2 rounded-none bg-zinc-100 text-black px-5 py-2.5 text-sm font-medium hover:bg-zinc-100 text-black disabled:opacity-50"
          >
            <RefreshCw className="h-4 w-4" />
            Запустити синхронізацію габаритів
          </button>
        </section>

    </AdminPage>
  );
}

type SummaryRowProps = {
  label: string;
  value: string;
  strong?: boolean;
};

function SummaryRow({ label, value, strong = false }: SummaryRowProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className={`text-white/55 ${strong ? 'font-medium' : ''}`}>{label}</span>
      <span className={strong ? 'font-semibold text-white' : 'text-white/80'}>{value}</span>
    </div>
  );
}
