"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useSession } from "next-auth/react";
import { DEFAULT_CURRENCY_RATES, type ShopCurrencyCode } from "@/lib/shopAdminSettings";

type CurrencyCode = ShopCurrencyCode;
type RegionCode = "UA" | "EU" | "US";

type Rates = {
  base: CurrencyCode;
  UAH: number;
  EUR: number;
  USD: number;
};

type ShopCurrencyContextValue = {
  region: RegionCode;
  currency: CurrencyCode;
  rates: Rates | null;
  setRegion: (region: RegionCode) => void;
  setCurrency: (currency: CurrencyCode) => void;
};

const DEFAULT_VALUE: ShopCurrencyContextValue = {
  region: "UA",
  currency: "UAH",
  rates: null,
  setRegion: () => {},
  setCurrency: () => {},
};

const STORAGE_KEY = "onecompany.shop.currency.v1";

const ShopCurrencyContext = createContext<ShopCurrencyContextValue>(DEFAULT_VALUE);

function currencyToRegion(currency: CurrencyCode): RegionCode {
  if (currency === "USD") return "US";
  if (currency === "EUR") return "EU";
  return "UA";
}

function normalizeCurrency(value: unknown, fallback: CurrencyCode): CurrencyCode {
  const normalized = String(value ?? "").trim().toUpperCase();
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
  const [region, setRegionState] = useState<RegionCode>(currencyToRegion(normalizedDefaultCurrency));
  const [currency, setCurrencyState] = useState<CurrencyCode>(normalizedDefaultCurrency);
  const [rates, setRates] = useState<Rates | null>(normalizeRates(initialRates));
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === "authenticated" && session?.user?.currencyPref) {
      const nextCurrency = normalizeCurrency(session.user.currencyPref, normalizedDefaultCurrency);
      setCurrencyState(nextCurrency);
      setRegionState(currencyToRegion(nextCurrency));
    }
  }, [normalizedDefaultCurrency, session, status]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { region?: RegionCode; currency?: CurrencyCode };
      const nextCurrency = normalizeCurrency(parsed.currency, normalizedDefaultCurrency);
      const nextRegion = parsed.region ?? currencyToRegion(nextCurrency);
      setRegionState(nextRegion);
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
        currency,
      })
    );
  }, [region, currency]);

  useEffect(() => {
    async function fetchRates() {
      try {
        const [eurRes, usdRes] = await Promise.all([
          fetch("https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?valcode=EUR&json"),
          fetch("https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?valcode=USD&json"),
        ]);
        const eurJson = await eurRes.json();
        const usdJson = await usdRes.json();
        const eurRate = typeof eurJson?.[0]?.rate === "number" ? eurJson[0].rate : Number(eurJson?.[0]?.rate);
        const usdRate = typeof usdJson?.[0]?.rate === "number" ? usdJson[0].rate : Number(usdJson?.[0]?.rate);
        if (!Number.isFinite(eurRate) || !Number.isFinite(usdRate)) return;
        setRates({
          base: "EUR",
          UAH: eurRate,
          EUR: 1,
          USD: eurRate / usdRate,
        });
      } catch {
        // fail silently – використовуємо вбудовані прайси
      }
    }
    fetchRates();
  }, []);

  function setRegion(next: RegionCode) {
    setRegionState(next);
    if (next === "UA") setCurrencyState("UAH");
    if (next === "EU") setCurrencyState("EUR");
    if (next === "US") setCurrencyState("USD");
  }

  function setCurrency(next: CurrencyCode) {
    setCurrencyState(next);
  }

  return (
    <ShopCurrencyContext.Provider
      value={{
        region,
        currency,
        rates,
        setRegion,
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

