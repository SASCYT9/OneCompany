import type { ShopMoneySet } from '@/lib/shopCatalog';
import type { ShopCurrencyCode } from '@/lib/shopMoneyFormat';

type DisplayRates = {
  EUR: number;
  USD: number;
  UAH?: number;
} | null | undefined;

function normalizeAmount(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function roundAmount(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function computeShopDisplayPrices(
  price: Partial<ShopMoneySet> | null | undefined,
  rates: DisplayRates
): ShopMoneySet {
  let eur = normalizeAmount(price?.eur);
  let usd = normalizeAmount(price?.usd);
  let uah = normalizeAmount(price?.uah);

  const eurToUsd = normalizeAmount(rates?.USD);
  const eurToUah = normalizeAmount(rates?.UAH);

  if (uah > 0 && eurToUah > 0) {
    if (eur <= 0) eur = uah / eurToUah;
    if (usd <= 0 && eurToUsd > 0) usd = (uah / eurToUah) * eurToUsd;
  }

  if (eur > 0) {
    if (usd <= 0 && eurToUsd > 0) usd = eur * eurToUsd;
    if (uah <= 0 && eurToUah > 0) uah = eur * eurToUah;
  }

  if (usd > 0 && eurToUsd > 0) {
    if (eur <= 0) eur = usd / eurToUsd;
    if (uah <= 0 && eurToUah > 0) uah = (usd / eurToUsd) * eurToUah;
  }

  return {
    eur: roundAmount(eur),
    usd: roundAmount(usd),
    uah: roundAmount(uah),
  };
}

export function hasAnyShopPrice(price: Partial<ShopMoneySet> | null | undefined, rates: DisplayRates) {
  const computed = computeShopDisplayPrices(price, rates);
  return computed.eur > 0 || computed.usd > 0 || computed.uah > 0;
}

export function pickShopSortableAmount(
  price: Partial<ShopMoneySet> | null | undefined,
  currency: ShopCurrencyCode,
  rates: DisplayRates
) {
  const computed = computeShopDisplayPrices(price, rates);
  const preferred =
    currency === 'USD' ? computed.usd : currency === 'UAH' ? computed.uah : computed.eur;

  if (preferred > 0) {
    return preferred;
  }

  return computed.eur || computed.usd || computed.uah || 0;
}
