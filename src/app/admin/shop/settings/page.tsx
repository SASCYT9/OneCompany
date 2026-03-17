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
  fopCompanyName: string | null;
  fopIban: string | null;
  fopBankName: string | null;
  fopEdrpou: string | null;
  fopDetails: string | null;
  stripeEnabled: boolean;
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
  fopCompanyName: string;
  fopIban: string;
  fopBankName: string;
  fopEdrpou: string;
  fopDetails: string;
  stripeEnabled: boolean;
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
    fopCompanyName: '',
    fopIban: '',
    fopBankName: '',
    fopEdrpou: '',
    fopDetails: '',
    stripeEnabled: false,
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
    fopCompanyName: settings.fopCompanyName ?? '',
    fopIban: settings.fopIban ?? '',
    fopBankName: settings.fopBankName ?? '',
    fopEdrpou: settings.fopEdrpou ?? '',
    fopDetails: settings.fopDetails ?? '',
    stripeEnabled: settings.stripeEnabled ?? false,
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
    fopCompanyName: form.fopCompanyName.trim() || null,
    fopIban: form.fopIban.trim() || null,
    fopBankName: form.fopBankName.trim() || null,
    fopEdrpou: form.fopEdrpou.trim() || null,
    fopDetails: form.fopDetails.trim() || null,
    stripeEnabled: form.stripeEnabled,
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

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-6 text-white/60">
        <Settings2 className="h-5 w-5 animate-pulse" />
        Завантаження налаштувань магазину…
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
              Назад до каталогу
            </Link>
            <h2 className="mt-3 text-2xl font-semibold text-white">Налаштування магазину</h2>
            <p className="mt-2 max-w-3xl text-sm text-white/45">
              Валюти вітрини, правила доставки та податків, видимість B2B та знижка B2B за замовчуванням. Порядок правил важливий: застосовується перша збіжна зона доставки або податкове правило.
            </p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-right">
            <div className="text-xs uppercase tracking-[0.24em] text-white/40">Оновлено</div>
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
                        className="h-4 w-4 rounded border-white/20 bg-zinc-950"
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
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
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
              <div className="flex flex-wrap gap-6 border-t border-white/10 pt-4">
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-white/80">
                  <input
                    type="checkbox"
                    checked={form.stripeEnabled}
                    onChange={(e) => updateField('stripeEnabled', e.target.checked)}
                    className="h-4 w-4 rounded border-white/20 bg-zinc-950"
                  />
                  Увімкнено Stripe (картка)
                </label>
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-white/80">
                  <input
                    type="checkbox"
                    checked={form.whiteBitEnabled}
                    onChange={(e) => updateField('whiteBitEnabled', e.target.checked)}
                    className="h-4 w-4 rounded border-white/20 bg-zinc-950"
                  />
                  Увімкнено White Bit (згодом)
                </label>
              </div>
              <p className="text-xs text-white/45">
                Stripe: встановіть STRIPE_SECRET_KEY та STRIPE_WEBHOOK_SECRET у середовищі; webhook URL: /api/shop/stripe/webhook
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-medium text-white">Валюти</h3>
                <p className="mt-1 text-sm text-white/45">
                  Опорні курси відносно EUR. Якщо у товару немає ціни в валюті, оформлення використовує ці курси.
                </p>
              </div>
              <div className="rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-xs text-white/50">
                Приклад: 1 EUR = {form.currencyRates.USD || '1.08'} USD
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {SHOP_CURRENCIES.map((currency) => (
                <div key={currency} className="rounded-xl border border-white/10 bg-zinc-950/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-white">{currency}</div>
                      <div className="mt-1 text-xs text-white/45">
                        {form.defaultCurrency === currency ? 'Валюта вітрини за замовч.' : 'Резервна валюта конвертації'}
                      </div>
                    </div>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] ${
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

          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
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
                className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-sm text-white hover:bg-white/5"
              >
                <Plus className="h-4 w-4" />
                Додати зону доставки
              </button>
            </div>
            <div className="space-y-4">
              {form.shippingZones.map((zone, index) => (
                <div key={`${zone.id}-${index}`} className="rounded-xl border border-white/10 bg-zinc-950/70 p-4">
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
                        className="rounded border border-white/15 p-2 text-white/70 hover:bg-white/10 disabled:opacity-35"
                        title="Вгору"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveShippingZone(index, 1)}
                        disabled={index === form.shippingZones.length - 1}
                        className="rounded border border-white/15 p-2 text-white/70 hover:bg-white/10 disabled:opacity-35"
                        title="Вниз"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeShippingZone(index)}
                        className="rounded border border-red-500/25 p-2 text-red-300 hover:bg-red-500/10"
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
                    <InputField
                      label="Базовий тариф"
                      value={zone.baseRate}
                      onChange={(value) => updateShippingZone(index, 'baseRate', value)}
                      placeholder="95"
                    />
                    <InputField
                      label="Тариф за одиницю"
                      value={zone.perItemRate}
                      onChange={(value) => updateShippingZone(index, 'perItemRate', value)}
                      placeholder="0"
                    />
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

          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
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
                className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-sm text-white hover:bg-white/5"
              >
                <Plus className="h-4 w-4" />
                Додати правило податку
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
                        title="Вгору"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveTaxRegion(index, 1)}
                        disabled={index === form.taxRegions.length - 1}
                        className="rounded border border-white/15 p-2 text-white/70 hover:bg-white/10 disabled:opacity-35"
                        title="Вниз"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeTaxRegion(index)}
                        className="rounded border border-red-500/25 p-2 text-red-300 hover:bg-red-500/10"
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

          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-medium text-white">Попередній перегляд оформлення</h3>
                <p className="mt-1 text-sm text-white/45">
                  Перегляд використовує той самий движок цін, що й оформлення замовлення, і показує незбережені зміни до натискання «Зберегти».
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
