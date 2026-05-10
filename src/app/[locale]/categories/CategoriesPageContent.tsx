"use client";

import Link from "next/link";
import { useLocale } from "next-intl";
import { CATEGORY_META } from "@/lib/categoryMeta";

export default function CategoriesPageContent() {
  const locale = useLocale();

  return (
    <div className="relative bg-background min-h-screen text-foreground overflow-hidden">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-[radial-gradient(circle,hsl(var(--foreground)/0.05)_0%,transparent_70%)] rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-[radial-gradient(circle,hsl(var(--foreground)/0.03)_0%,transparent_70%)] rounded-full blur-3xl" />
      </div>

      <main className="relative container mx-auto px-6 py-24">
        <header className="text-center mb-16">
          <p className="text-[10px] tracking-[0.35em] uppercase text-primary font-light mb-4">
            {locale === "ua" ? "Категорії" : "Categories"}
          </p>
          <h1 className="text-5xl md:text-6xl font-light tracking-tight mb-4 bg-clip-text text-transparent bg-linear-to-b from-foreground to-foreground/70 text-balance">
            {locale === "ua" ? "Оберіть напрям" : "Choose a segment"}
          </h1>
          <p className="text-foreground/80 dark:text-foreground/60 font-light max-w-3xl mx-auto text-pretty">
            {locale === "ua"
              ? "В кожній категорії — пояснення та бренди за алфавітом для швидкого вибору."
              : "Each category includes an intro and A–Z brand index for quick selection."}
          </p>
        </header>

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {CATEGORY_META.map((cat) => (
            <Link
              key={cat.slug}
              href={cat.slug}
              className="group relative p-8 bg-card hover:bg-foreground/5 transition-all duration-500 backdrop-blur-3xl rounded-3xl border border-foreground/10 shadow-[0_12px_30px_rgba(0,0,0,0.06)] dark:shadow-[0_30px_60px_rgba(0,0,0,0.5)] hover:scale-[1.02]"
            >
              <div className="mb-4 text-[10px] tracking-[0.3em] uppercase text-foreground/60 dark:text-foreground/40">
                {locale === "ua" ? "Категорія" : "Category"}
              </div>
              <h2 className="text-2xl font-light mb-3 text-foreground/95 group-hover:text-foreground">
                {locale === "ua" ? cat.title.ua : cat.title.en}
              </h2>
              <p className="text-sm text-foreground/80 dark:text-foreground/60 font-light line-clamp-3">
                {locale === "ua" ? cat.intro.ua : cat.intro.en}
              </p>
              <div className="mt-6 text-xs text-foreground/85 dark:text-foreground/70 group-hover:text-foreground tracking-wider">
                {locale === "ua" ? "Перейти →" : "Open →"}
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-primary/0 to-transparent group-hover:via-primary transition-all duration-500" />
            </Link>
          ))}
        </section>
      </main>
    </div>
  );
}
