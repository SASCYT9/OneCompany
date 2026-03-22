"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useSession } from "next-auth/react";

type CurrencyCode = "UAH" | "EUR" | "USD";
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

export function ShopCurrencyProvider({ children }: { children: ReactNode }) {
  const [region, setRegionState] = useState<RegionCode>("UA");
  const [currency, setCurrencyState] = useState<CurrencyCode>("UAH");
  const [rates, setRates] = useState<Rates | null>(null);
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === "authenticated" && session?.user?.currencyPref) {
      setCurrencyState(session.user.currencyPref as CurrencyCode);
    }
  }, [session, status]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { region?: RegionCode; currency?: CurrencyCode };
      if (parsed.region) setRegionState(parsed.region);
      if (parsed.currency) setCurrencyState(parsed.currency);
    } catch {
      // ignore
    }
  }, []);

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
          base: "UAH",
          UAH: 1,
          EUR: eurRate,
          USD: usdRate,
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

