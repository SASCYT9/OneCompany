'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Globe2,
  Percent,
  Plus,
  Save,
  Settings2,
  Trash2,
} from 'lucide-react';

type ShopCurrencyCode = 'EUR' | 'USD' | 'UAH';

type ShopShippingZone = {
  id: string;
  name: string;
  countries: string[];
  regions: string[];
  baseRate: number;
  perItemRate: number;
  freeOver: number | null;
  minimumSubtotal: number | null;
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

type ShopSettingsResponse = {
  key: string;
  b2bVisibilityMode: string;
  defaultB2bDiscountPercent: number | null;
  defaultCurrency: ShopCurrencyCode;
  enabledCurrencies: ShopCurrencyCode[];
  currencyRates: Record<ShopCurrencyCode, number>;
  shippingZones: ShopShippingZone[];
  taxRegions: ShopTaxRegion[];
  orderNotificationEmail: string | null;
  b2bNotes: string | null;
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
  freeOver: string;
  minimumSubtotal: string;
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
  taxRegions: TaxRegionForm[];
  orderNotificationEmail: string;
  b2bNotes: string;
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
};

const SHOP_CURRENCIES: ShopCurrencyCode[] = ['EUR', 'USD', 'UAH'];

const B2B_OPTIONS = [
  { value: 'approved_only', label: 'approved_only' },
  { value: 'public_dual', label: 'public_dual' },
  { value: 'request_quote', label: 'request_quote' },
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
    name: `Shipping zone ${seed}`,
    countriesText: '*',
    regionsText: '',
    baseRate: '0',
    perItemRate: '0',
    freeOver: '',
    minimumSubtotal: '',
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
    taxRegions: [createTaxRegionForm(1)],
    orderNotificationEmail: '',
    b2bNotes: '',
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
      freeOver: formatNumber(zone.freeOver),
      minimumSubtotal: formatNumber(zone.minimumSubtotal),
      currency: zone.currency,
      enabled: zone.enabled,
    })),
    taxRegions: settings.taxRegions.map((region) => ({
      id: region.id,
      name: region.name,
      countriesText: joinCommaList(region.countries),
      regionsText: joinCommaList(region.regions),
      rate: formatNumber(region.rate),
      appliesToShipping: region.appliesToShipping,
      enabled: region.enabled,
    })),
    orderNotificationEmail: settings.orderNotificationEmail ?? '',
    b2bNotes: settings.b2bNotes ?? '',
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
      freeOver: parseNullableNumber(zone.freeOver),
      minimumSubtotal: parseNullableNumber(zone.minimumSubtotal),
      currency: zone.currency,
      enabled: zone.enabled,
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
    orderNotificationEmail: form.orderNotificationEmail.trim() || null,
    b2bNotes: form.b2bNotes.trim() || null,
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

  useEffect(() => {
    void load();
  }, []);

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
          throw new Error(data.error || 'Failed to build preview');
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
        setError(data.error || 'Failed to load shop settings');
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

  function updateTaxRegion(index: number, field: keyof TaxRegionForm, value: TaxRegionForm[keyof TaxRegionForm]) {
    setForm((current) => ({
      ...current,
      taxRegions: current.taxRegions.map((region, regionIndex) =>
        regionIndex === index ? { ...region, [field]: value } : region
      ),
    }));
  }

  function addShippingZone() {
    setForm((current) => ({
      ...current,
      shippingZones: [...current.shippingZones, createShippingZoneForm(current.shippingZones.length + 1)],
    }));
  }

  function addTaxRegion() {
    setForm((current) => ({
      ...current,
      taxRegions: [...current.taxRegions, createTaxRegionForm(current.taxRegions.length + 1)],
    }));
  }

  function removeShippingZone(index: number) {
    setForm((current) => ({
      ...current,
      shippingZones: current.shippingZones.filter((_, zoneIndex) => zoneIndex !== index),
    }));
  }

  function removeTaxRegion(index: number) {
    setForm((current) => ({
      ...current,
      taxRegions: current.taxRegions.filter((_, regionIndex) => regionIndex !== index),
    }));
  }

  function moveShippingZone(index: number, direction: -1 | 1) {
    setForm((current) => ({
      ...current,
      shippingZones: moveItem(current.shippingZones, index, direction),
    }));
  }

  function moveTaxRegion(index: number, direction: -1 | 1) {
    setForm((current) => ({
      ...current,
      taxRegions: moveItem(current.taxRegions, index, direction),
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
        throw new Error(data.error || 'Failed to save settings');
      }

      const settings = data as ShopSettingsResponse;
      setForm(settingsToForm(settings));
      setUpdatedAt(settings.updatedAt);
      setSuccess('Shop settings saved.');
    } catch (saveError) {
      setError((saveError as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-6 text-white/60">
        <Settings2 className="h-5 w-5 animate-pulse" />
        Loading shop settings…
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-6xl p-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href="/admin/shop" className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white">
              <ArrowLeft className="h-4 w-4" />
              Back to catalog
            </Link>
            <h2 className="mt-3 text-2xl font-semibold text-white">Shop settings</h2>
            <p className="mt-2 max-w-3xl text-sm text-white/45">
              Configure storefront currencies, shipping rules, tax rules, B2B visibility and the default B2B discount. Rule order matters:
              the first matching shipping zone or tax rule wins.
            </p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-right">
            <div className="text-xs uppercase tracking-[0.24em] text-white/40">Last updated</div>
            <div className="mt-2 text-sm text-white/80">{updatedAt ? new Date(updatedAt).toLocaleString() : '—'}</div>
          </div>
        </div>

        {error ? <div className="mb-4 rounded-lg bg-red-900/20 p-3 text-sm text-red-300">{error}</div> : null}
        {success ? <div className="mb-4 rounded-lg bg-green-900/20 p-3 text-sm text-green-200">{success}</div> : null}

        <form onSubmit={handleSubmit} className="space-y-6">
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-5">
              <h3 className="text-lg font-medium text-white">Core rules</h3>
              <p className="mt-1 text-sm text-white/45">Storefront defaults, global B2B discount policy and team notifications.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <SelectField
                label="B2B visibility mode"
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
                label="Default currency"
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
                <div className="mb-1.5 block text-xs text-white/50">Enabled currencies</div>
                <div className="flex flex-wrap gap-3">
                  {SHOP_CURRENCIES.map((currency) => (
                    <label key={currency} className="inline-flex items-center gap-2 text-sm text-white/80">
                      <input
                        type="checkbox"
                        checked={form.enabledCurrencies.includes(currency)}
                        onChange={() => toggleCurrency(currency)}
                        className="h-4 w-4 rounded border-white/20 bg-zinc-950"
                      />
                      {currency}
                    </label>
                  ))}
                </div>
              </div>
              <TextareaField
                label="B2B notes"
                value={form.b2bNotes}
                onChange={(value) => updateField('b2bNotes', value)}
                rows={4}
              />
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-medium text-white">Currency setup</h3>
                <p className="mt-1 text-sm text-white/45">
                  Reference rates are calculated from EUR. If a product misses a direct currency price, checkout falls back to these rates.
                </p>
              </div>
              <div className="rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-xs text-white/50">
                Example: 1 EUR = {form.currencyRates.USD || '1.08'} USD
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {SHOP_CURRENCIES.map((currency) => (
                <div key={currency} className="rounded-xl border border-white/10 bg-zinc-950/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-white">{currency}</div>
                      <div className="mt-1 text-xs text-white/45">
                        {form.defaultCurrency === currency ? 'Default storefront currency' : 'Fallback conversion target'}
                      </div>
                    </div>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] ${
                        form.enabledCurrencies.includes(currency)
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                          : 'border-white/10 bg-white/5 text-white/40'
                      }`}
                    >
                      {form.enabledCurrencies.includes(currency) ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <div className="mt-4">
                    <InputField
                      label="Rate vs EUR"
                      value={form.currencyRates[currency]}
                      onChange={(value) => updateCurrencyRate(currency, value)}
                      placeholder="0"
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-medium text-white">Shipping zones</h3>
                <p className="mt-1 text-sm text-white/45">
                  Define worldwide delivery rules. The first enabled matching zone is applied at checkout.
                </p>
              </div>
              <button
                type="button"
                onClick={addShippingZone}
                className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-sm text-white hover:bg-white/5"
              >
                <Plus className="h-4 w-4" />
                Add shipping zone
              </button>
            </div>
            <div className="space-y-4">
              {form.shippingZones.map((zone, index) => (
                <div key={`${zone.id}-${index}`} className="rounded-xl border border-white/10 bg-zinc-950/70 p-4">
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-medium text-white">
                        <Globe2 className="h-4 w-4 text-white/55" />
                        {zone.name || `Shipping zone ${index + 1}`}
                      </div>
                      <div className="mt-1 text-xs font-mono text-white/40">{zone.id || 'missing-id'}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => moveShippingZone(index, -1)}
                        disabled={index === 0}
                        className="rounded border border-white/15 p-2 text-white/70 hover:bg-white/10 disabled:opacity-35"
                        title="Move up"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveShippingZone(index, 1)}
                        disabled={index === form.shippingZones.length - 1}
                        className="rounded border border-white/15 p-2 text-white/70 hover:bg-white/10 disabled:opacity-35"
                        title="Move down"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeShippingZone(index)}
                        className="rounded border border-red-500/25 p-2 text-red-300 hover:bg-red-500/10"
                        title="Remove zone"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <InputField
                      label="Zone id"
                      value={zone.id}
                      onChange={(value) => updateShippingZone(index, 'id', value)}
                      placeholder="worldwide-standard"
                    />
                    <InputField
                      label="Zone name"
                      value={zone.name}
                      onChange={(value) => updateShippingZone(index, 'name', value)}
                      placeholder="Worldwide"
                    />
                    <InputField
                      label="Countries"
                      value={zone.countriesText}
                      onChange={(value) => updateShippingZone(index, 'countriesText', value)}
                      placeholder="DE, FR, IT or *"
                    />
                    <InputField
                      label="Regions"
                      value={zone.regionsText}
                      onChange={(value) => updateShippingZone(index, 'regionsText', value)}
                      placeholder="Berlin, Bavaria"
                    />
                    <SelectField
                      label="Rate currency"
                      value={zone.currency}
                      onChange={(value) => updateShippingZone(index, 'currency', value as ShopCurrencyCode)}
                      options={SHOP_CURRENCIES.map((currency) => ({ value: currency, label: currency }))}
                    />
                    <InputField
                      label="Base rate"
                      value={zone.baseRate}
                      onChange={(value) => updateShippingZone(index, 'baseRate', value)}
                      placeholder="95"
                    />
                    <InputField
                      label="Per-item rate"
                      value={zone.perItemRate}
                      onChange={(value) => updateShippingZone(index, 'perItemRate', value)}
                      placeholder="0"
                    />
                    <InputField
                      label="Free shipping over"
                      value={zone.freeOver}
                      onChange={(value) => updateShippingZone(index, 'freeOver', value)}
                      placeholder="2500"
                    />
                    <InputField
                      label="Minimum subtotal"
                      value={zone.minimumSubtotal}
                      onChange={(value) => updateShippingZone(index, 'minimumSubtotal', value)}
                      placeholder="Optional"
                    />
                    <CheckboxField
                      label="Enabled"
                      checked={zone.enabled}
                      onChange={(checked) => updateShippingZone(index, 'enabled', checked)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-medium text-white">Tax rules</h3>
                <p className="mt-1 text-sm text-white/45">
                  The first enabled matching rule applies to checkout. Use shipping inclusion only where the local rule requires it.
                </p>
              </div>
              <button
                type="button"
                onClick={addTaxRegion}
                className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-sm text-white hover:bg-white/5"
              >
                <Plus className="h-4 w-4" />
                Add tax rule
              </button>
            </div>
            <div className="space-y-4">
              {form.taxRegions.map((region, index) => (
                <div key={`${region.id}-${index}`} className="rounded-xl border border-white/10 bg-zinc-950/70 p-4">
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
                        className="rounded border border-white/15 p-2 text-white/70 hover:bg-white/10 disabled:opacity-35"
                        title="Move up"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveTaxRegion(index, 1)}
                        disabled={index === form.taxRegions.length - 1}
                        className="rounded border border-white/15 p-2 text-white/70 hover:bg-white/10 disabled:opacity-35"
                        title="Move down"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeTaxRegion(index)}
                        className="rounded border border-red-500/25 p-2 text-red-300 hover:bg-red-500/10"
                        title="Remove tax rule"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <InputField
                      label="Rule id"
                      value={region.id}
                      onChange={(value) => updateTaxRegion(index, 'id', value)}
                      placeholder="eu-vat"
                    />
                    <InputField
                      label="Rule name"
                      value={region.name}
                      onChange={(value) => updateTaxRegion(index, 'name', value)}
                      placeholder="EU VAT"
                    />
                    <InputField
                      label="Countries"
                      value={region.countriesText}
                      onChange={(value) => updateTaxRegion(index, 'countriesText', value)}
                      placeholder="DE, FR, IT or *"
                    />
                    <InputField
                      label="Regions"
                      value={region.regionsText}
                      onChange={(value) => updateTaxRegion(index, 'regionsText', value)}
                      placeholder="Berlin, Bavaria"
                    />
                    <InputField
                      label="Tax rate"
                      value={region.rate}
                      onChange={(value) => updateTaxRegion(index, 'rate', value)}
                      placeholder="0.2"
                    />
                    <CheckboxField
                      label="Apply to shipping"
                      checked={region.appliesToShipping}
                      onChange={(checked) => updateTaxRegion(index, 'appliesToShipping', checked)}
                    />
                    <CheckboxField
                      label="Enabled"
                      checked={region.enabled}
                      onChange={(checked) => updateTaxRegion(index, 'enabled', checked)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-medium text-white">Checkout preview</h3>
                <p className="mt-1 text-sm text-white/45">
                  Live preview runs on the same pricing engine as checkout and reflects unsaved changes before you hit save.
                </p>
              </div>
              {previewLoading ? (
                <div className="rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-xs text-white/50">Refreshing preview…</div>
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
              <div className="rounded-xl border border-white/10 bg-zinc-950/70 p-4">
                {previewError ? (
                  <div className="rounded-lg bg-red-900/20 p-3 text-sm text-red-300">{previewError}</div>
                ) : previewResult ? (
                  <div className="space-y-4">
                    <div className="grid gap-3 text-sm">
                      <SummaryRow
                        label="Subtotal"
                        value={formatMoney(previewResult.subtotal, previewResult.currency)}
                      />
                      <SummaryRow
                        label="Shipping"
                        value={formatMoney(previewResult.shippingCost, previewResult.currency)}
                      />
                      <SummaryRow
                        label="Tax"
                        value={formatMoney(previewResult.taxAmount, previewResult.currency)}
                      />
                      <SummaryRow
                        label="Total"
                        value={formatMoney(previewResult.total, previewResult.currency)}
                        strong
                      />
                    </div>
                    <div className="grid gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm text-white/70">
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
              className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-black hover:bg-white/90 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Saving…' : 'Save settings'}
            </button>
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-lg border border-white/15 px-5 py-2.5 text-sm text-white hover:bg-white/5"
            >
              Reload
            </button>
          </div>
        </form>
      </div>
    </div>
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

type InputFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

function InputField({ label, value, onChange, placeholder }: InputFieldProps) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs text-white/50">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white placeholder:text-white/25 focus:border-white/30 focus:outline-none"
      />
    </label>
  );
}

type TextareaFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
};

function TextareaField({ label, value, onChange, rows = 6 }: TextareaFieldProps) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs text-white/50">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white placeholder:text-white/25 focus:border-white/30 focus:outline-none"
      />
    </label>
  );
}

type SelectFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
};

function SelectField({ label, value, onChange, options }: SelectFieldProps) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs text-white/50">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

type CheckboxFieldProps = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

function CheckboxField({ label, checked, onChange }: CheckboxFieldProps) {
  return (
    <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-950 px-3 py-2.5 text-sm text-white/80">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-white/20 bg-zinc-950"
      />
      {label}
    </label>
  );
}
