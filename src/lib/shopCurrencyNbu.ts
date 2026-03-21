import type { ShopCurrencyCode } from '@/lib/shopAdminSettings';

type NbuExchangeItem = {
  rate?: number;
  cc?: string;
  exchangedate?: string;
  special?: string | null;
};

export type ShopNbuCurrencyRates = {
  currencyRates: Record<ShopCurrencyCode, number>;
  source: 'nbu';
  exchangedAt: string;
  eurToUah: number;
  usdToUah: number;
  usdPerEur: number;
  usdSpecial: boolean;
};

const NBU_EXCHANGE_ENDPOINT = 'https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?json';

function normalizeNbuItem(raw: unknown): NbuExchangeItem | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }

  const entry = raw as Record<string, unknown>;
  const cc = String(entry.cc ?? '').trim().toUpperCase();
  const rate = Number(entry.rate);
  const exchangedate = String(entry.exchangedate ?? '').trim();
  const special = entry.special == null ? null : String(entry.special).trim().toUpperCase();

  if (!cc || !Number.isFinite(rate) || rate <= 0 || !exchangedate) {
    return null;
  }

  return {
    cc,
    rate,
    exchangedate,
    special,
  };
}

async function fetchNbuCurrency(valcode: 'EUR' | 'USD'): Promise<NbuExchangeItem> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(`${NBU_EXCHANGE_ENDPOINT}&valcode=${valcode}`, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`NBU returned ${response.status}`);
    }

    const payload = (await response.json().catch(() => null)) as unknown;
    if (!Array.isArray(payload) || payload.length === 0) {
      throw new Error(`NBU payload for ${valcode} is empty`);
    }

    const item = normalizeNbuItem(payload[0]);
    if (!item || item.cc !== valcode) {
      throw new Error(`NBU payload for ${valcode} is invalid`);
    }

    return item;
  } finally {
    clearTimeout(timeoutId);
  }
}

function roundRate(value: number, maximumFractionDigits = 6) {
  return Number(value.toFixed(maximumFractionDigits));
}

export async function fetchShopCurrencyRatesFromNbu(): Promise<ShopNbuCurrencyRates> {
  const [eur, usd] = await Promise.all([fetchNbuCurrency('EUR'), fetchNbuCurrency('USD')]);

  if (eur.exchangedate !== usd.exchangedate) {
    throw new Error('NBU returned currency rates with mismatched dates');
  }

  const eurToUah = eur.rate as number;
  const usdToUah = usd.rate as number;
  const usdPerEur = eurToUah / usdToUah;

  return {
    currencyRates: {
      EUR: 1,
      USD: roundRate(usdPerEur),
      UAH: roundRate(eurToUah, 4),
    },
    source: 'nbu',
    exchangedAt: eur.exchangedate as string,
    eurToUah: roundRate(eurToUah, 4),
    usdToUah: roundRate(usdToUah, 4),
    usdPerEur: roundRate(usdPerEur),
    usdSpecial: usd.special === 'Y',
  };
}
