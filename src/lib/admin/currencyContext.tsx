'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

// ═══════════════════════════════
// Types
// ═══════════════════════════════

export type AdminCurrency = 'UAH' | 'USD' | 'EUR';

export interface ExchangeRates {
  UAH: number; // 1
  USD: number; // e.g. 41.5
  EUR: number; // e.g. 45.2
  updatedAt: string;
}

interface CurrencyContextValue {
  currency: AdminCurrency;
  setCurrency: (c: AdminCurrency) => void;
  rates: ExchangeRates;
  ratesLoading: boolean;

  /**
   * Convert an amount from source currency to currently selected display currency.
   * @param amount — raw number
   * @param source — the currency the amount is originally in ('UAH' | 'USD' | 'EUR')
   * @returns formatted string like "₴ 193,636" or "$4,689"
   */
  formatMoney: (amount: number, source: AdminCurrency) => string;

  /**
   * Convert raw number without formatting.
   */
  convert: (amount: number, from: AdminCurrency, to: AdminCurrency) => number;

  /** Symbol for given currency */
  symbol: (c?: AdminCurrency) => string;
}

// ═══════════════════════════════
// Defaults
// ═══════════════════════════════

const DEFAULT_RATES: ExchangeRates = {
  UAH: 1,
  USD: 41.35,
  EUR: 46.85,
  updatedAt: new Date().toISOString(),
};

const SYMBOLS: Record<AdminCurrency, string> = {
  UAH: '₴',
  USD: '$',
  EUR: '€',
};

const STORAGE_KEY = 'admin_currency';
const RATES_CACHE_KEY = 'admin_exchange_rates';

// ═══════════════════════════════
// Context
// ═══════════════════════════════

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function useAdminCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error('useAdminCurrency must be used within AdminCurrencyProvider');
  return ctx;
}

// ═══════════════════════════════
// Provider
// ═══════════════════════════════

export function AdminCurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<AdminCurrency>('UAH');
  const [rates, setRates] = useState<ExchangeRates>(DEFAULT_RATES);
  const [ratesLoading, setRatesLoading] = useState(false);

  // Load saved currency from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as AdminCurrency | null;
      if (saved && ['UAH', 'USD', 'EUR'].includes(saved)) {
        setCurrencyState(saved);
      }
      // Load cached rates
      const cachedRates = localStorage.getItem(RATES_CACHE_KEY);
      if (cachedRates) {
        const parsed = JSON.parse(cachedRates);
        setRates(parsed);
      }
    } catch { /* ignore */ }
  }, []);

  // Fetch exchange rates from NBU
  useEffect(() => {
    const fetchRates = async () => {
      setRatesLoading(true);
      try {
        const res = await fetch('https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?json');
        if (!res.ok) throw new Error('NBU API error');
        const data = await res.json();

        const usdRate = data.find((r: any) => r.cc === 'USD')?.rate || DEFAULT_RATES.USD;
        const eurRate = data.find((r: any) => r.cc === 'EUR')?.rate || DEFAULT_RATES.EUR;

        const newRates: ExchangeRates = {
          UAH: 1,
          USD: usdRate,
          EUR: eurRate,
          updatedAt: new Date().toISOString(),
        };

        setRates(newRates);
        localStorage.setItem(RATES_CACHE_KEY, JSON.stringify(newRates));
      } catch {
        // Keep defaults or cached rates
        console.warn('Failed to fetch NBU rates, using cached/defaults');
      } finally {
        setRatesLoading(false);
      }
    };

    fetchRates();
    // Refresh rates every 4 hours
    const interval = setInterval(fetchRates, 4 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const setCurrency = useCallback((c: AdminCurrency) => {
    setCurrencyState(c);
    localStorage.setItem(STORAGE_KEY, c);
  }, []);

  const convert = useCallback((amount: number, from: AdminCurrency, to: AdminCurrency): number => {
    if (from === to) return amount;
    // Convert from source to UAH first, then to target
    const inUAH = from === 'UAH' ? amount : amount * rates[from];
    const result = to === 'UAH' ? inUAH : inUAH / rates[to];
    return result;
  }, [rates]);

  const symbol = useCallback((c?: AdminCurrency): string => {
    return SYMBOLS[c || currency];
  }, [currency]);

  const formatMoney = useCallback((amount: number, source: AdminCurrency): string => {
    const converted = convert(amount, source, currency);
    const sym = SYMBOLS[currency];

    // Format number with locale-aware separators
    const formatted = Math.abs(converted) >= 1000
      ? converted.toLocaleString('en-US', { maximumFractionDigits: 0 })
      : converted.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    return `${sym}${formatted}`;
  }, [currency, convert]);

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, rates, ratesLoading, formatMoney, convert, symbol }}>
      {children}
    </CurrencyContext.Provider>
  );
}
