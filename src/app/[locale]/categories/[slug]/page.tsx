// src/app/[locale]/categories/[slug]/page.tsx
'use client';

import { useLocale } from 'next-intl';
import { useParams, notFound } from 'next/navigation';
import { categoryData } from '@/lib/categoryData';
import Link from 'next/link';

export default function CategoryPage() {
  const locale = useLocale();
  const params = useParams();
  const slug = params.slug as string;

  const category = categoryData.find((cat) => cat.slug === slug);

  if (!category) {
    notFound();
  }

  const title = locale === 'ua' ? category.title.ua : category.title.en;
  const description = locale === 'ua' ? category.description.ua : category.description.en;

  return (
    <div className="bg-black text-white min-h-screen">
      <header className="container mx-auto px-6 py-24 text-center">
        <p className="text-sm uppercase tracking-widest text-white/50 mb-4">
          {locale === 'ua' ? 'Категорія' : 'Category'}
        </p>
        <h1 className="text-5xl md:text-7xl font-light tracking-tight mb-6">{title}</h1>
        <p className="text-lg text-white/70 font-light max-w-3xl mx-auto">{description}</p>
      </header>

      <main className="container mx-auto px-6 pb-24">
        <h2 className="text-3xl font-light text-center mb-12">
          {locale === 'ua' ? 'Топ брендів у цій категорії' : 'Top Brands in This Category'}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {category.brands.map((brand) => (
            <div key={brand.name} className="p-6 bg-white/5 rounded-lg text-center">
              <p className="font-medium text-white/90">{brand.name}</p>
            </div>
          ))}
        </div>
        <div className="text-center mt-16">
          <Link href={locale === 'ua' ? '/ua/auto' : '/auto'} className="text-orange-500 hover:text-orange-400 transition-colors">
            ← {locale === 'ua' ? 'Повернутися до всіх брендів' : 'Back to All Brands'}
          </Link>
        </div>
      </main>
    </div>
  );
}