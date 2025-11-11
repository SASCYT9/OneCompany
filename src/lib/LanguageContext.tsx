'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { translations, Locale, TranslationKeys } from '@/lib/translations';

interface LanguageContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: TranslationKeys;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('ua');
  // We no longer gate rendering on mount to ensure context exists during SSR.

  useEffect(() => {
    // Load saved locale from localStorage (client only)
    const savedLocale = localStorage.getItem('locale') as Locale;
    if (savedLocale && (savedLocale === 'ua' || savedLocale === 'en')) {
      setLocaleState(savedLocale);
      document.documentElement.setAttribute('lang', savedLocale);
    } else {
      document.documentElement.setAttribute('lang', 'ua');
    }
  }, []);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem('locale', newLocale);
    // Reflect locale in <html lang>
    document.documentElement.setAttribute('lang', newLocale);
  };

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t: translations[locale] }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    // Fallback during prerendering (e.g., not-found) to avoid build errors
    return {
      locale: 'ua',
      setLocale: () => {},
      t: translations['ua'],
    };
  }
  return context;
}
