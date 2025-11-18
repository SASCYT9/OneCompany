'use client';

import Link from 'next/link';
import { useLocale } from 'next-intl';
import { CATEGORY_META } from '@/lib/categoryMeta';

export default function LocalizedCategoriesIndexPage() {
  const locale = useLocale();

  return (
    <div className="relative bg-black min-h-screen text-white overflow-hidden">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-[radial-gradient(circle,_rgba(255,255,255,0.05)_0%,_transparent_70%)] rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-[radial-gradient(circle,_rgba(255,255,255,0.03)_0%,_transparent_70%)] rounded-full blur-3xl" />
      </div>

      <main className="relative container mx-auto px-6 py-24">
        <header className="text-center mb-16">
          <p className="text-[10px] tracking-[0.35em] uppercase text-white/30 font-light mb-4">{locale === 'ua' ? 'Категорії' : 'Categories'}</p>
          <h1 className="text-5xl md:text-6xl font-light tracking-tight mb-4 bg-clip-text text-transparent bg-gradient-to-b from-white to-white/70 text-balance">
            {locale === 'ua' ? 'Оберіть напрям' : 'Choose a segment'}
          </h1>
          <p className="text-white/60 font-light max-w-3xl mx-auto text-pretty">
            {locale === 'ua' ? 'В кожній категорії — пояснення та бренди за алфавітом для швидкого вибору.' : 'Each category includes an intro and A–Z brand index for quick selection.'}
          </p>
        </header>

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {CATEGORY_META.map((cat) => (
            <Link
              key={cat.slug}
              href={cat.slug}
              className="group relative p-8 bg-white/[0.02] hover:bg-white/[0.05] transition-all duration-500 backdrop-blur-3xl rounded-3xl border border-white/10 shadow-[0_30px_60px_rgba(0,0,0,0.5)] hover:scale-[1.02]"
            >
              <div className="mb-4 text-[10px] tracking-[0.3em] uppercase text-white/40">{locale === 'ua' ? 'Категорія' : 'Category'}</div>
              <h2 className="text-2xl font-light mb-3 text-white/90 group-hover:text-white">
                {locale === 'ua' ? cat.title.ua : cat.title.en}
              </h2>
              <p className="text-sm text-white/60 font-light line-clamp-3">
                {locale === 'ua' ? cat.intro.ua : cat.intro.en}
              </p>
              <div className="mt-6 text-xs text-white/70 group-hover:text-white/90 tracking-wider">
                {locale === 'ua' ? 'Перейти →' : 'Open →'}
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/0 to-transparent group-hover:via-white/20 transition-all duration-500" />
            </Link>
          ))}
        </section>
      </main>
    </div>
  );
}
