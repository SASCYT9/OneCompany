'use client';

import Link from 'next/link';
import { useLanguage } from '@/lib/LanguageContext';
import { CATEGORY_META } from '@/lib/categoryMeta';

export default function CategoriesIndexPage() {
  const { locale } = useLanguage();

  return (
    <div className="relative bg-black min-h-screen text-white overflow-hidden">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-gradient-to-br from-orange-500/10 via-rose-500/5 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-gradient-to-tl from-amber-500/10 via-yellow-500/5 to-transparent rounded-full blur-3xl" />
      </div>

      <main className="relative container mx-auto px-6 py-24">
        <header className="text-center mb-16">
          <p className="text-[10px] tracking-[0.35em] uppercase text-white/30 font-light mb-4">{locale==='ua' ? 'Категорії' : 'Categories'}</p>
          <h1 className="text-5xl md:text-6xl font-light tracking-tight mb-4 bg-clip-text text-transparent bg-gradient-to-b from-white to-white/70">
            {locale==='ua' ? 'Оберіть напрям' : 'Choose a segment'}
          </h1>
          <p className="text-white/60 font-light max-w-3xl mx-auto">
            {locale==='ua' ? 'В кожній категорії — пояснення та бренди за алфавітом для швидкого вибору.' : 'Each category includes an intro and A–Z brand index for quick selection.'}
          </p>
        </header>

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {CATEGORY_META.map(cat => (
            <Link
              key={cat.slug}
              href={`/categories/${cat.slug}`}
              className="group relative p-8 bg-gradient-to-br from-white/[0.08] to-white/[0.03] hover:from-white/[0.12] hover:to-white/[0.06] transition-all duration-500 backdrop-blur-sm rounded-2xl border border-white/10"
            >
              <div className="mb-4 text-[10px] tracking-[0.3em] uppercase text-white/40">{locale==='ua' ? 'Категорія' : 'Category'}</div>
              <h2 className="text-2xl font-light mb-3 text-white/90 group-hover:text-white">
                {locale==='ua' ? cat.title.ua : cat.title.en}
              </h2>
              <p className="text-sm text-white/60 font-light line-clamp-3">{locale==='ua' ? cat.intro.ua : cat.intro.en}</p>
              <div className="mt-6 text-xs text-white/70 group-hover:text-white/90 tracking-wider">{locale==='ua' ? 'Перейти →' : 'Open →'}</div>
              <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/0 to-transparent group-hover:via-orange-500/50 transition-all duration-500" />
            </Link>
          ))}
        </section>
      </main>
    </div>
  );
}
