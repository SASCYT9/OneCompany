"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { DEFAULT_CURRENCY_RATES, type ShopCurrencyCode } from "@/lib/shopAdminSettings";
import { resolveShopCountry } from "@/lib/shopCountries";
import { isEuropePricingCountry } from "@/lib/shopEuropePricing";

type CurrencyCode = ShopCurrencyCode;
export type ShopRegionCode = "UA" | "EU" | "US";
const DEFAULT_COUNTRY = "Ukraine";

type Rates = {
  base: CurrencyCode;
  UAH: number;
  EUR: number;
  USD: number;
};

type ShopCurrencyContextValue = {
  region: ShopRegionCode;
  country: string;
  currency: CurrencyCode;
  rates: Rates | null;
  setRegion: (region: ShopRegionCode) => void;
  setCountry: (country: string) => void;
  setCurrency: (currency: CurrencyCode) => void;
};

const DEFAULT_VALUE: ShopCurrencyContextValue = {
  region: "UA",
  country: DEFAULT_COUNTRY,
  currency: "UAH",
  rates: null,
  setRegion: () => {},
  setCountry: () => {},
  setCurrency: () => {},
};

const STORAGE_KEY = "onecompany.shop.currency.v1";

const ShopCurrencyContext = createContext<ShopCurrencyContextValue>(DEFAULT_VALUE);

function currencyToRegion(currency: CurrencyCode): ShopRegionCode {
  if (currency === "USD") return "US";
  if (currency === "EUR") return "EU";
  return "UA";
}

function normalizeRegion(value: unknown, fallback: ShopRegionCode): ShopRegionCode {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase();
  if (normalized === "UA" || normalized === "EU" || normalized === "US") {
    return normalized;
  }
  return fallback;
}

function countryToRegion(country: string): ShopRegionCode {
  if (isEuropePricingCountry(country)) return "EU";
  if (country === "United States") return "US";
  return "UA";
}

function defaultCountryForRegion(region: ShopRegionCode): string {
  if (region === "EU") return "Germany";
  if (region === "US") return "United States";
  return DEFAULT_COUNTRY;
}

function normalizeCountry(value: unknown, fallback: string): string {
  return resolveShopCountry(String(value ?? "").trim())?.value ?? fallback;
}

export function getShopPriceCountryForRegion(region: ShopRegionCode): string | null {
  return defaultCountryForRegion(region);
}

export function getShopPriceCountryForCountry(country: string | null | undefined): string | null {
  const normalized = String(country ?? "").trim();
  if (!normalized || normalized === "Other") return null;
  return normalized;
}

function normalizeCurrency(value: unknown, fallback: CurrencyCode): CurrencyCode {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase();
  if (normalized === "USD" || normalized === "EUR" || normalized === "UAH") {
    return normalized;
  }
  return fallback;
}

function normalizeRates(value: Partial<Rates> | null | undefined): Rates {
  const eur = Number(value?.EUR ?? DEFAULT_CURRENCY_RATES.EUR);
  const usd = Number(value?.USD ?? DEFAULT_CURRENCY_RATES.USD);
  const uah = Number(value?.UAH ?? DEFAULT_CURRENCY_RATES.UAH);

  return {
    base: "EUR",
    EUR: eur > 0 ? eur : DEFAULT_CURRENCY_RATES.EUR,
    USD: usd > 0 ? usd : DEFAULT_CURRENCY_RATES.USD,
    UAH: uah > 0 ? uah : DEFAULT_CURRENCY_RATES.UAH,
  };
}

type ShopCurrencyProviderProps = {
  children: ReactNode;
  defaultCurrency?: CurrencyCode;
  initialRates?: Partial<Rates> | null;
};

export function ShopCurrencyProvider({
  children,
  defaultCurrency = "UAH",
  initialRates,
}: ShopCurrencyProviderProps) {
  const normalizedDefaultCurrency = normalizeCurrency(defaultCurrency, "UAH");
  const initialRegion = currencyToRegion(normalizedDefaultCurrency);
  const [region, setRegionState] = useState<ShopRegionCode>(initialRegion);
  const [country, setCountryState] = useState<string>(defaultCountryForRegion(initialRegion));
  const [currency, setCurrencyState] = useState<CurrencyCode>(normalizedDefaultCurrency);
  const [rates] = useState<Rates | null>(normalizeRates(initialRates));

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        region?: ShopRegionCode;
        country?: string;
        currency?: CurrencyCode;
      };
      const nextCurrency = normalizeCurrency(parsed.currency, normalizedDefaultCurrency);
      const nextRegion = normalizeRegion(parsed.region, currencyToRegion(nextCurrency));
      const nextCountry = normalizeCountry(parsed.country, defaultCountryForRegion(nextRegion));
      setRegionState(nextRegion);
      setCountryState(nextCountry);
      setCurrencyState(nextCurrency);
    } catch {
      // ignore
    }
  }, [normalizedDefaultCurrency]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        region,
        country,
        currency,
      })
    );
  }, [region, country, currency]);

  const setRegion = useCallback((next: ShopRegionCode) => {
    setRegionState(next);
    setCountryState(defaultCountryForRegion(next));
  }, []);

  const setCountry = useCallback((next: string) => {
    setCountryState((current) => {
      const normalized = normalizeCountry(next, current);
      setRegionState(countryToRegion(normalized));
      return normalized;
    });
  }, []);

  const setCurrency = useCallback((next: CurrencyCode) => {
    setCurrencyState(next);
  }, []);

  return (
    <ShopCurrencyContext.Provider
      value={{
        region,
        country,
        currency,
        rates,
        setRegion,
        setCountry,
        setCurrency,
      }}
    >
      {children}
    </ShopCurrencyContext.Provider>
  );
}

export function useShopCurrency() {
  return useContext(ShopCurrencyContext);
}
