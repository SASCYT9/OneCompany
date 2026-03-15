import { Prisma, PrismaClient } from '@prisma/client';

export const SHOP_CURRENCIES = ['EUR', 'USD', 'UAH'] as const;
export type ShopCurrencyCode = (typeof SHOP_CURRENCIES)[number];

export type ShopShippingZone = {
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

export type ShopTaxRegion = {
  id: string;
  name: string;
  countries: string[];
  regions: string[];
  rate: number;
  appliesToShipping: boolean;
  enabled: boolean;
};

export type ShopSettingsRuntime = {
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
  createdAt: Date;
  updatedAt: Date;
};

export type ShopSettingsRecord = {
  key: string;
  b2bVisibilityMode: string;
  defaultB2bDiscountPercent: Prisma.Decimal | number | null;
  defaultCurrency: string;
  enabledCurrencies: string[];
  currencyRates: Prisma.JsonValue;
  shippingZones: Prisma.JsonValue;
  taxRegions: Prisma.JsonValue;
  orderNotificationEmail: string | null;
  b2bNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ShopSettingsPayload = {
  b2bVisibilityMode: string;
  defaultB2bDiscountPercent: number | null;
  defaultCurrency: string;
  enabledCurrencies: string[];
  currencyRates: Record<string, number>;
  shippingZones: Array<Record<string, unknown>>;
  taxRegions: Array<Record<string, unknown>>;
  orderNotificationEmail: string | null;
  b2bNotes: string | null;
};

export const DEFAULT_CURRENCY_RATES: Record<ShopCurrencyCode, number> = {
  EUR: 1,
  USD: 1.08,
  UAH: 45,
};

export const DEFAULT_SHIPPING_ZONES: ShopShippingZone[] = [
  {
    id: 'ua-standard',
    name: 'Ukraine',
    countries: ['Ukraine', 'UA'],
    regions: [],
    baseRate: 0,
    perItemRate: 0,
    freeOver: 0,
    minimumSubtotal: null,
    currency: 'UAH',
    enabled: true,
  },
  {
    id: 'worldwide-standard',
    name: 'Worldwide',
    countries: ['*'],
    regions: [],
    baseRate: 95,
    perItemRate: 0,
    freeOver: 2500,
    minimumSubtotal: null,
    currency: 'EUR',
    enabled: true,
  },
];

export const DEFAULT_TAX_REGIONS: ShopTaxRegion[] = [
  {
    id: 'ua-vat',
    name: 'Ukraine VAT',
    countries: ['Ukraine', 'UA'],
    regions: [],
    rate: 0.2,
    appliesToShipping: true,
    enabled: false,
  },
  {
    id: 'eu-vat',
    name: 'EU VAT',
    countries: ['AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK'],
    regions: [],
    rate: 0.2,
    appliesToShipping: true,
    enabled: false,
  },
];

function stringValue(value: unknown, fallback = ''): string {
  return String(value ?? fallback).trim();
}

function nullableString(value: unknown): string | null {
  const trimmed = stringValue(value);
  return trimmed || null;
}

function nullableNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function stringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry ?? '').trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value.split(',').map((entry) => entry.trim()).filter(Boolean);
  }
  return [];
}

function asNumberRecord(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...DEFAULT_CURRENCY_RATES };
  }

  const result: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) {
      result[key.toUpperCase()] = parsed;
    }
  }

  if (!Object.keys(result).length) {
    return { ...DEFAULT_CURRENCY_RATES };
  }

  return result;
}

function asObjectArray(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry));
}

function normalizeCurrencyCode(value: unknown, fallback: ShopCurrencyCode = 'EUR'): ShopCurrencyCode {
  const normalized = stringValue(value, fallback).toUpperCase();
  return (SHOP_CURRENCIES as readonly string[]).includes(normalized) ? (normalized as ShopCurrencyCode) : fallback;
}

function normalizeShopShippingZones(value: unknown): ShopShippingZone[] {
  const zones = asObjectArray(value).map((entry, index) => {
    const countries = stringArray(entry.countries);
    const regions = stringArray(entry.regions);
    const baseRate = Number(entry.baseRate ?? 0);
    const perItemRate = Number(entry.perItemRate ?? 0);
    const freeOverRaw = entry.freeOver;
    const minimumSubtotalRaw = entry.minimumSubtotal;
    const freeOver = freeOverRaw == null || freeOverRaw === '' ? null : Number(freeOverRaw);
    const minimumSubtotal = minimumSubtotalRaw == null || minimumSubtotalRaw === '' ? null : Number(minimumSubtotalRaw);

    return {
      id: stringValue(entry.id, `zone-${index + 1}`) || `zone-${index + 1}`,
      name: stringValue(entry.name, `Zone ${index + 1}`) || `Zone ${index + 1}`,
      countries: countries.length ? countries : ['*'],
      regions,
      baseRate: Number.isFinite(baseRate) ? baseRate : 0,
      perItemRate: Number.isFinite(perItemRate) ? perItemRate : 0,
      freeOver: freeOver != null && Number.isFinite(freeOver) ? freeOver : null,
      minimumSubtotal: minimumSubtotal != null && Number.isFinite(minimumSubtotal) ? minimumSubtotal : null,
      currency: normalizeCurrencyCode(entry.currency, 'EUR'),
      enabled: entry.enabled !== false,
    } satisfies ShopShippingZone;
  });

  return zones.length ? zones : DEFAULT_SHIPPING_ZONES.map((zone) => ({ ...zone }));
}

function normalizeShopTaxRegions(value: unknown): ShopTaxRegion[] {
  const regions = asObjectArray(value).map((entry, index) => {
    const countries = stringArray(entry.countries);
    const ruleRegions = stringArray(entry.regions);
    const rate = Number(entry.rate ?? 0);

    return {
      id: stringValue(entry.id, `tax-${index + 1}`) || `tax-${index + 1}`,
      name: stringValue(entry.name, `Tax rule ${index + 1}`) || `Tax rule ${index + 1}`,
      countries: countries.length ? countries : ['*'],
      regions: ruleRegions,
      rate: Number.isFinite(rate) ? rate : 0,
      appliesToShipping: entry.appliesToShipping !== false,
      enabled: entry.enabled === true,
    } satisfies ShopTaxRegion;
  });

  return regions.length ? regions : DEFAULT_TAX_REGIONS.map((region) => ({ ...region }));
}

function normalizeEnabledCurrencies(value: unknown, fallback: ShopCurrencyCode): ShopCurrencyCode[] {
  const values = Array.from(
    new Set(
      stringArray(value)
        .map((entry) => entry.toUpperCase())
        .filter((entry): entry is ShopCurrencyCode => (SHOP_CURRENCIES as readonly string[]).includes(entry))
    )
  );

  return values.length ? values : [fallback];
}

export function normalizeShopSettingsPayload(input: unknown) {
  const source = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const defaultCurrency = normalizeCurrencyCode(source.defaultCurrency, 'EUR');

  const payload: ShopSettingsPayload = {
    b2bVisibilityMode: ['approved_only', 'public_dual', 'request_quote'].includes(stringValue(source.b2bVisibilityMode, 'approved_only'))
      ? stringValue(source.b2bVisibilityMode, 'approved_only')
      : 'approved_only',
    defaultB2bDiscountPercent: (() => {
      const parsed = nullableNumber(source.defaultB2bDiscountPercent);
      if (parsed == null) return null;
      return parsed >= 0 ? Math.min(parsed, 100) : 0;
    })(),
    defaultCurrency,
    enabledCurrencies: normalizeEnabledCurrencies(source.enabledCurrencies, defaultCurrency),
    currencyRates: normalizeShopCurrencyRates(source.currencyRates),
    shippingZones: normalizeShopShippingZones(source.shippingZones),
    taxRegions: normalizeShopTaxRegions(source.taxRegions),
    orderNotificationEmail: nullableString(source.orderNotificationEmail),
    b2bNotes: nullableString(source.b2bNotes),
  };

  if (!payload.enabledCurrencies.length) {
    payload.enabledCurrencies = [defaultCurrency];
  }

  return payload;
}

export function normalizeShopCurrencyRates(value: unknown): Record<ShopCurrencyCode, number> {
  const raw = asNumberRecord(value);
  if ((raw.EUR ?? 1) === 1 && (raw.USD ?? 1) === 1 && (raw.UAH ?? 1) === 1) {
    return { ...DEFAULT_CURRENCY_RATES };
  }
  const rates = {
    EUR: raw.EUR ?? DEFAULT_CURRENCY_RATES.EUR,
    USD: raw.USD ?? DEFAULT_CURRENCY_RATES.USD,
    UAH: raw.UAH ?? DEFAULT_CURRENCY_RATES.UAH,
  } satisfies Record<ShopCurrencyCode, number>;

  return {
    EUR: rates.EUR > 0 ? rates.EUR : DEFAULT_CURRENCY_RATES.EUR,
    USD: rates.USD > 0 ? rates.USD : DEFAULT_CURRENCY_RATES.USD,
    UAH: rates.UAH > 0 ? rates.UAH : DEFAULT_CURRENCY_RATES.UAH,
  };
}

export function buildShopSettingsRuntimeFromPayload(
  payload: ShopSettingsPayload,
  overrides?: {
    key?: string;
    createdAt?: Date;
    updatedAt?: Date;
  }
): ShopSettingsRuntime {
  const defaultCurrency = normalizeCurrencyCode(payload.defaultCurrency, 'EUR');
  const enabledCurrencies = normalizeEnabledCurrencies(payload.enabledCurrencies, defaultCurrency);

  return {
    key: overrides?.key ?? 'shop',
    b2bVisibilityMode: payload.b2bVisibilityMode,
    defaultB2bDiscountPercent: payload.defaultB2bDiscountPercent,
    defaultCurrency,
    enabledCurrencies,
    currencyRates: normalizeShopCurrencyRates(payload.currencyRates),
    shippingZones: normalizeShopShippingZones(payload.shippingZones),
    taxRegions: normalizeShopTaxRegions(payload.taxRegions),
    orderNotificationEmail: payload.orderNotificationEmail,
    b2bNotes: payload.b2bNotes,
    createdAt: overrides?.createdAt ?? new Date(),
    updatedAt: overrides?.updatedAt ?? new Date(),
  };
}

export function getShopSettingsRuntime(record: ShopSettingsRecord): ShopSettingsRuntime {
  return buildShopSettingsRuntimeFromPayload(
    normalizeShopSettingsPayload({
      b2bVisibilityMode: record.b2bVisibilityMode,
      defaultB2bDiscountPercent: record.defaultB2bDiscountPercent,
      defaultCurrency: record.defaultCurrency,
      enabledCurrencies: record.enabledCurrencies,
      currencyRates: record.currencyRates,
      shippingZones: record.shippingZones,
      taxRegions: record.taxRegions,
      orderNotificationEmail: record.orderNotificationEmail,
      b2bNotes: record.b2bNotes,
    }),
    {
      key: record.key,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }
  );
}

export function serializeShopSettings(record: ShopSettingsRecord) {
  const runtime = getShopSettingsRuntime(record);
  return {
    key: runtime.key,
    b2bVisibilityMode: runtime.b2bVisibilityMode,
    defaultB2bDiscountPercent: runtime.defaultB2bDiscountPercent,
    defaultCurrency: runtime.defaultCurrency,
    enabledCurrencies: runtime.enabledCurrencies,
    currencyRates: runtime.currencyRates,
    shippingZones: runtime.shippingZones,
    taxRegions: runtime.taxRegions,
    orderNotificationEmail: runtime.orderNotificationEmail,
    b2bNotes: runtime.b2bNotes,
    createdAt: runtime.createdAt.toISOString(),
    updatedAt: runtime.updatedAt.toISOString(),
  };
}

export async function getOrCreateShopSettings(prisma: PrismaClient) {
  return prisma.shopSettings.upsert({
    where: { key: 'shop' },
    create: {
      key: 'shop',
      b2bVisibilityMode: 'approved_only',
      defaultB2bDiscountPercent: null,
      defaultCurrency: 'EUR',
      enabledCurrencies: ['EUR', 'USD', 'UAH'],
      currencyRates: DEFAULT_CURRENCY_RATES,
      shippingZones: DEFAULT_SHIPPING_ZONES,
      taxRegions: DEFAULT_TAX_REGIONS,
    },
    update: {},
  });
}
