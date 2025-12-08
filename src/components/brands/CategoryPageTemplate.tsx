'use client';

import { categoryData } from '@/lib/categoryData';
import { getBrandsByNames } from '@/lib/brands';
import { notFound } from 'next/navigation';
import CategoryPageClient from './CategoryPageClient';

interface Props {
  categorySlug: string;
  locale: string;
}

export default function CategoryPageTemplate({ categorySlug, locale }: Props) {
  const category = categoryData.find(c => c.slug === categorySlug);
  
  if (!category) {
    notFound();
  }

  // Map segment to BrandCategory
  const brandCategory = category.segment === 'moto' ? 'moto' : 'auto';
  const brands = getBrandsByNames(category.brands, brandCategory);

  return (
    <CategoryPageClient 
      category={category} 
      brands={brands} 
      locale={locale} 
    />
  );
}
