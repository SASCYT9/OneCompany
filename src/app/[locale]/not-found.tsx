"use client";

import Link from "next/link";
import { useLocale } from "next-intl";
import { Home, Search, ArrowLeft } from "lucide-react";

const translations = {
  en: {
    title: "404",
    subtitle: "Page not found",
    description: "The page you are looking for does not exist or has been moved.",
    home: "Go Home",
    back: "Go Back",
    search: "Browse Categories",
  },
  ua: {
    title: "404",
    subtitle: "Сторінку не знайдено",
    description: "Сторінка, яку ви шукаєте, не існує або була переміщена.",
    home: "На головну",
    back: "Назад",
    search: "Переглянути категорії",
  },
};

export default function NotFound() {
  const locale = useLocale();
  const t = translations[locale as keyof typeof translations] || translations.ua;

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="text-center max-w-lg">
        {/* Large 404 */}
        <div className="mb-6">
          <h1 className="text-[150px] sm:text-[200px] font-bold leading-none text-transparent bg-clip-text bg-linear-to-b from-foreground/40 to-foreground select-none">
            {t.title}
          </h1>
        </div>

        {/* Text */}
        <h2 className="text-2xl sm:text-3xl font-semibold text-foreground mb-3">{t.subtitle}</h2>
        <p className="text-foreground/65 mb-8 leading-relaxed">{t.description}</p>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href={`/${locale}`}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
          >
            <Home className="w-4 h-4" />
            {t.home}
          </Link>

          <Link
            href={`/${locale}/auto`}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-foreground/5 hover:bg-foreground/10 text-foreground font-medium rounded-xl border border-foreground/15 transition-all duration-200"
          >
            <Search className="w-4 h-4" />
            {t.search}
          </Link>
        </div>
      </div>
    </div>
  );
}
