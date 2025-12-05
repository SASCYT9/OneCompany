'use client';

import { useLocale } from 'next-intl';
import Link from 'next/link';
import { CategoryData } from '@/lib/categoryData';

interface CategoryPageClientProps {
  category: CategoryData;
}

export default function CategoryPageClient({ category }: CategoryPageClientProps) {
  const locale = useLocale();
  const title = locale === 'ua' ? category.title.ua : category.title.en;
  const description = locale === 'ua' ? category.description.ua : category.description.en;

  return (
    <div className="bg-black text-white min-h-screen">
      <header className="container mx-auto px-6 py-24 text-center">
        <p className="text-sm uppercase tracking-widest text-white/50 mb-4">
          {locale === 'ua' ? 'Категорія' : 'Category'}
        </p>
        <h1 className="text-5xl md:text-7xl font-light tracking-tight mb-6 text-balance">{title}</h1>
        <p className="text-lg text-white/70 font-light max-w-3xl mx-auto text-pretty">{description}</p>
      </header>

      <main className="container mx-auto px-6 pb-24">
        <h2 className="text-3xl font-light text-center mb-12 text-balance">
          {locale === 'ua' ? 'Топ брендів у цій категорії' : 'Top Brands in This Category'}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {category.brands.map((brand) => (
            <div key={brand} className="p-6 bg-white/[0.02] border border-white/10 backdrop-blur-3xl rounded-2xl text-center shadow-[0_20px_40px_rgba(0,0,0,0.4)] hover:scale-[1.02] transition-transform duration-500">
              <p className="font-light text-white/90">{brand}</p>
            </div>
          ))}
        </div>
        <div className="text-center mt-16">
          <Link href={`/${locale}/categories`} className="inline-flex items-center justify-center rounded-full border border-white/30 px-8 py-3 text-sm uppercase tracking-wide text-white transition hover:border-white hover:bg-white hover:text-black">
            ← {locale === 'ua' ? 'Всі категорії' : 'All Categories'}
          </Link>
        </div>
      </main>
    </div>
  );
}
