import { Prisma, PrismaClient } from '@prisma/client';

export const SHOP_CURRENCIES = ['EUR', 'USD', 'UAH'] as const;
export type ShopCurrencyCode = (typeof SHOP_CURRENCIES)[number];

export type ShopShippingZone = {
  id: string;
  name: string;
  countries: string[];
  regions: string[];
  calcMode: 'flat' | 'volumetric';
  baseRate: number;
  perItemRate: number;
  ratePerKg: number;
  volSurchargePerKg: number;
  volumetricDivisor: number;
  fallbackWeightKg: number;
  fallbackLength: number;
  fallbackWidth: number;
  fallbackHeight: number;
  freeOver: number | null;
  minimumSubtotal: number | null;
  currency: ShopCurrencyCode;
  enabled: boolean;
  etaMinDays: number | null;
  etaMaxDays: number | null;
};

export type ShopBrandShippingRule = {
  id: string;
  brandName: string;
  mode: 'fixed' | 'multiplier' | 'free';
  value: number;
  warehouseRatePerKg: number;
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

export type ShopRegionalPricingRule = {
  id: string;
  name: string;
  countries: string[];
  regions: string[];
  mode: 'percent' | 'fixed';
  value: number;
  currency: ShopCurrencyCode;
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
  regionalPricingRules: Prisma.JsonValue;
  brandShippingRules?: Prisma.JsonValue;
  orderNotificationEmail: string | null;
  b2bNotes: string | null;
  showTaxesIncludedNotice: boolean;
  fopCompanyName: string | null;
  fopIban: string | null;
  fopBankName: string | null;
  fopEdrpou: string | null;
  fopDetails: string | null;
  whiteBitEnabled: boolean;
  appAccentColor: string;
  appAddress: string | null;
  appCompanyName: string | null;
  appContactEmail: string | null;
  appContactPhone: string | null;
  appDarkMode: boolean;
  appDefaultLanguage: string;
  appDefaultMarkup: number;
  appLogoUrl: string | null;
  appMetaDescription: string | null;
  appMetaTitle: string | null;
  appOgImage: string | null;
  appShowPricesWithVat: boolean;
  appSoundEnabled: boolean;
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
  brandShippingRules: Array<Record<string, unknown>>;
  taxRegions: Array<Record<string, unknown>>;
  regionalPricingRules: Array<Record<string, unknown>>;
  orderNotificationEmail: string | null;
  b2bNotes: string | null;
  showTaxesIncludedNotice: boolean;
  fopCompanyName: string | null;
  fopIban: string | null;
  fopBankName: string | null;
  fopEdrpou: string | null;
  fopDetails: string | null;
  whiteBitEnabled: boolean;
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
    calcMode: 'flat',
    baseRate: 0,
    perItemRate: 0,
    ratePerKg: 1.5,
    volSurchargePerKg: 0.5,
    volumetricDivisor: 5000,
    fallbackWeightKg: 2,
    fallbackLength: 30,
    fallbackWidth: 20,
    fallbackHeight: 15,
    freeOver: 0,
    minimumSubtotal: null,
    currency: 'UAH',
    enabled: true,
    etaMinDays: 1,
    etaMaxDays: 3,
  },
  {
    id: 'worldwide-standard',
    name: 'Worldwide',
    countries: ['*'],
    regions: [],
    calcMode: 'flat',
    baseRate: 0,
    perItemRate: 0,
    ratePerKg: 10,
    volSurchargePerKg: 2,
    volumetricDivisor: 5000,
    fallbackWeightKg: 0.5,
    fallbackLength: 10,
    fallbackWidth: 10,
    fallbackHeight: 10,
    freeOver: null,
    minimumSubtotal: null,
    currency: 'EUR',
    enabled: true,
    etaMinDays: 7,
    etaMaxDays: 14,
  },
];

export const DEFAULT_BRAND_SHIPPING_RULES: ShopBrandShippingRule[] = [];

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

export const DEFAULT_REGIONAL_PRICING_RULES: ShopRegionalPricingRule[] = [];

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
    const ratePerKg = Number(entry.ratePerKg ?? 1.5);
    const volSurchargePerKg = Number(entry.volSurchargePerKg ?? 0.5);
    const volumetricDivisor = Number(entry.volumetricDivisor ?? 5000);
    const fallbackWeightKg = Number(entry.fallbackWeightKg ?? 2);
    const fallbackLength = Number(entry.fallbackLength ?? 30);
    const fallbackWidth = Number(entry.fallbackWidth ?? 20);
    const fallbackHeight = Number(entry.fallbackHeight ?? 15);
    const calcMode = entry.calcMode === 'volumetric' ? 'volumetric' : 'flat';
    
    const freeOverRaw = entry.freeOver;
    const minimumSubtotalRaw = entry.minimumSubtotal;
    const freeOver = freeOverRaw == null || freeOverRaw === '' ? null : Number(freeOverRaw);
    const minimumSubtotal = minimumSubtotalRaw == null || minimumSubtotalRaw === '' ? null : Number(minimumSubtotalRaw);

    const etaMinDaysRaw = entry.etaMinDays;
    const etaMaxDaysRaw = entry.etaMaxDays;
    const etaMinDays = etaMinDaysRaw == null || etaMinDaysRaw === '' ? null : Number(etaMinDaysRaw);
    const etaMaxDays = etaMaxDaysRaw == null || etaMaxDaysRaw === '' ? null : Number(etaMaxDaysRaw);

    return {
      id: stringValue(entry.id, `zone-${index + 1}`) || `zone-${index + 1}`,
      name: stringValue(entry.name, `Zone ${index + 1}`) || `Zone ${index + 1}`,
      countries: countries.length ? countries : ['*'],
      regions,
      calcMode,
      baseRate: Number.isFinite(baseRate) ? baseRate : 0,
      perItemRate: Number.isFinite(perItemRate) ? perItemRate : 0,
      ratePerKg: Number.isFinite(ratePerKg) ? ratePerKg : 1.5,
      volSurchargePerKg: Number.isFinite(volSurchargePerKg) ? volSurchargePerKg : 0.5,
      volumetricDivisor: Number.isFinite(volumetricDivisor) ? volumetricDivisor : 5000,
      fallbackWeightKg: Number.isFinite(fallbackWeightKg) ? fallbackWeightKg : 2,
      fallbackLength: Number.isFinite(fallbackLength) ? fallbackLength : 30,
      fallbackWidth: Number.isFinite(fallbackWidth) ? fallbackWidth : 20,
      fallbackHeight: Number.isFinite(fallbackHeight) ? fallbackHeight : 15,
      freeOver: freeOver != null && Number.isFinite(freeOver) ? freeOver : null,
      minimumSubtotal: minimumSubtotal != null && Number.isFinite(minimumSubtotal) ? minimumSubtotal : null,
      currency: normalizeCurrencyCode(entry.currency, 'EUR'),
      enabled: entry.enabled !== false,
      etaMinDays: etaMinDays != null && Number.isFinite(etaMinDays) ? etaMinDays : null,
      etaMaxDays: etaMaxDays != null && Number.isFinite(etaMaxDays) ? etaMaxDays : null,
    } satisfies ShopShippingZone;
  });

  return zones.length ? zones : DEFAULT_SHIPPING_ZONES.map((zone) => ({ ...zone }));
}

function normalizeShopBrandShippingRules(value: unknown): ShopBrandShippingRule[] {
  const rules = asObjectArray(value).map((entry, index) => {
    const modeRaw = stringValue(entry.mode, 'fixed');
    const mode = ['fixed', 'multiplier', 'free'].includes(modeRaw) ? (modeRaw as 'fixed' | 'multiplier' | 'free') : 'fixed';
    const valueNum = Number(entry.value ?? 0);

    const warehouseRatePerKgNum = Number(entry.warehouseRatePerKg ?? 0);

    return {
      id: stringValue(entry.id, `brand-rule-${index + 1}`) || `brand-rule-${index + 1}`,
      brandName: stringValue(entry.brandName, ''),
      mode,
      value: Number.isFinite(valueNum) ? valueNum : 0,
      warehouseRatePerKg: Number.isFinite(warehouseRatePerKgNum) ? warehouseRatePerKgNum : 0,
      currency: normalizeCurrencyCode(entry.currency, 'EUR'),
      enabled: entry.enabled !== false,
    } satisfies ShopBrandShippingRule;
  });

  return rules.filter((r) => r.brandName);
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

function normalizeShopRegionalPricingRules(value: unknown): ShopRegionalPricingRule[] {
  return asObjectArray(value).map((entry, index) => {
    const countries = stringArray(entry.countries);
    const regions = stringArray(entry.regions);
    const mode = stringValue(entry.mode, 'percent') === 'fixed' ? 'fixed' : 'percent';
    const parsedValue = Number(entry.value ?? 0);

    return {
      id: stringValue(entry.id, `regional-rule-${index + 1}`) || `regional-rule-${index + 1}`,
      name: stringValue(entry.name, `Regional rule ${index + 1}`) || `Regional rule ${index + 1}`,
      countries: countries.length ? countries : ['*'],
      regions,
      mode,
      value: Number.isFinite(parsedValue) ? parsedValue : 0,
      currency: normalizeCurrencyCode(entry.currency, 'EUR'),
      enabled: entry.enabled === true,
    } satisfies ShopRegionalPricingRule;
  });
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

  const b2bVis = stringValue(source.b2bVisibilityMode, 'approved_only');

  const payload: ShopSettingsPayload = {
    b2bVisibilityMode: ['approved_only', 'public_dual', 'request_quote'].includes(b2bVis) ? b2bVis : 'approved_only',
    defaultB2bDiscountPercent: nullableNumber(source.defaultB2bDiscountPercent),
    defaultCurrency,
    enabledCurrencies: stringArray(source.enabledCurrencies).map((c) => normalizeCurrencyCode(c, 'EUR')),
    currencyRates: asNumberRecord(source.currencyRates),
    shippingZones: asObjectArray(source.shippingZones),
    brandShippingRules: asObjectArray(source.brandShippingRules),
    taxRegions: asObjectArray(source.taxRegions),
    regionalPricingRules: asObjectArray(source.regionalPricingRules),
    orderNotificationEmail: nullableString(source.orderNotificationEmail),
    b2bNotes: nullableString(source.b2bNotes),
    showTaxesIncludedNotice: source.showTaxesIncludedNotice === true,
    fopCompanyName: nullableString(source.fopCompanyName),
    fopIban: nullableString(source.fopIban),
    fopBankName: nullableString(source.fopBankName),
    fopEdrpou: nullableString(source.fopEdrpou),
    fopDetails: nullableString(source.fopDetails),
    whiteBitEnabled: source.whiteBitEnabled === true,
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
    brandShippingRules: normalizeShopBrandShippingRules(payload.brandShippingRules),
    taxRegions: normalizeShopTaxRegions(payload.taxRegions),
    regionalPricingRules: normalizeShopRegionalPricingRules(payload.regionalPricingRules),
    orderNotificationEmail: payload.orderNotificationEmail,
    b2bNotes: payload.b2bNotes,
    showTaxesIncludedNotice: payload.showTaxesIncludedNotice,
    fopCompanyName: payload.fopCompanyName,
    fopIban: payload.fopIban,
    fopBankName: payload.fopBankName,
    fopEdrpou: payload.fopEdrpou,
    fopDetails: payload.fopDetails,
    whiteBitEnabled: payload.whiteBitEnabled,
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
      brandShippingRules: record.brandShippingRules,
      taxRegions: record.taxRegions,
      regionalPricingRules: record.regionalPricingRules,
      orderNotificationEmail: record.orderNotificationEmail,
      b2bNotes: record.b2bNotes,
      showTaxesIncludedNotice: record.showTaxesIncludedNotice,
      fopCompanyName: record.fopCompanyName,
      fopIban: record.fopIban,
      fopBankName: record.fopBankName,
      fopEdrpou: record.fopEdrpou,
      fopDetails: record.fopDetails,
      whiteBitEnabled: record.whiteBitEnabled,
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
    brandShippingRules: runtime.brandShippingRules,
    taxRegions: runtime.taxRegions,
    regionalPricingRules: runtime.regionalPricingRules,
    orderNotificationEmail: runtime.orderNotificationEmail,
    b2bNotes: runtime.b2bNotes,
    showTaxesIncludedNotice: runtime.showTaxesIncludedNotice,
    fopCompanyName: runtime.fopCompanyName,
    fopIban: runtime.fopIban,
    fopBankName: runtime.fopBankName,
    fopEdrpou: runtime.fopEdrpou,
    fopDetails: runtime.fopDetails,
    whiteBitEnabled: runtime.whiteBitEnabled,
    createdAt: runtime.createdAt.toISOString(),
    updatedAt: runtime.updatedAt.toISOString(),
  };
}

let cachedShopSettingsRecord: ShopSettingsRecord | null = null;
let cachedShopSettingsFetchedAt = 0;
let cachedShopSettingsPromise: Promise<ShopSettingsRecord> | null = null;

let cachedShopSettingsSnapshot: ShopSettingsRecord | null | undefined = undefined;

async function loadShopSettingsSnapshot(): Promise<ShopSettingsRecord | null> {
  if (cachedShopSettingsSnapshot !== undefined) return cachedShopSettingsSnapshot;
  try {
    // Dynamic node-prefixed imports keep fs/path out of the client bundle
    // (this module is transitively imported by client components for types).
    const [{ default: fs }, { default: path }] = await Promise.all([
      import('node:fs'),
      import('node:path'),
    ]);
    const filePath = path.join(process.cwd(), 'data', 'shop-settings.snapshot.json');
    if (fs.existsSync(filePath)) {
      const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (raw && typeof raw === 'object') {
        if (typeof raw.createdAt === 'string') raw.createdAt = new Date(raw.createdAt);
        if (typeof raw.updatedAt === 'string') raw.updatedAt = new Date(raw.updatedAt);
        cachedShopSettingsSnapshot = raw as ShopSettingsRecord;
        return cachedShopSettingsSnapshot;
      }
    }
  } catch {
    // fall through to null
  }
  cachedShopSettingsSnapshot = null;
  return null;
}

export async function getOrCreateShopSettings(prisma: PrismaClient) {
  // Build phase: prefer pre-fetched snapshot to avoid DB connection storm
  // during static prerender of dozens of shop pages × locales. The snapshot
  // is produced by `scripts/prebuild-shop-snapshot.ts` before `next build`.
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    const snap = await loadShopSettingsSnapshot();
    if (snap) {
      cachedShopSettingsRecord = snap;
      cachedShopSettingsFetchedAt = Date.now();
      return snap;
    }
  }

  const now = Date.now();
  if (cachedShopSettingsRecord && now - cachedShopSettingsFetchedAt < 60_000) {
    return cachedShopSettingsRecord;
  }

  if (cachedShopSettingsPromise) {
    return cachedShopSettingsPromise;
  }

  // FAST PATH: Prevent massive transactional upserts during Vercel static build
  cachedShopSettingsPromise = (async () => {
    const existing = await prisma.shopSettings.findUnique({
      where: { key: 'shop' }
    });
    if (existing) {
      cachedShopSettingsRecord = existing;
      cachedShopSettingsFetchedAt = Date.now();
      return existing;
    }

    // FALLBACK: create if it completely doesn't exist
    const created = await prisma.shopSettings.upsert({
      where: { key: 'shop' },
      update: {},
      create: {
        key: 'shop',
        b2bVisibilityMode: 'approved_only',
        defaultB2bDiscountPercent: null,
        defaultCurrency: 'EUR',
        enabledCurrencies: ['EUR', 'USD', 'UAH'],
        currencyRates: DEFAULT_CURRENCY_RATES,
        shippingZones: DEFAULT_SHIPPING_ZONES,
        brandShippingRules: DEFAULT_BRAND_SHIPPING_RULES as unknown as Prisma.InputJsonValue,
        taxRegions: DEFAULT_TAX_REGIONS,
        regionalPricingRules: DEFAULT_REGIONAL_PRICING_RULES,
        showTaxesIncludedNotice: false,
        whiteBitEnabled: false,
      },
    });

    cachedShopSettingsRecord = created;
    cachedShopSettingsFetchedAt = Date.now();
    return created;
  })();

  try {
    return await cachedShopSettingsPromise;
  } finally {
    cachedShopSettingsPromise = null;
  }
}
