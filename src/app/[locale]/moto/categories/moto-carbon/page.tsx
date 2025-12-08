import CategoryPageTemplate from '@/components/brands/CategoryPageTemplate';
import { getCategoryMetadata } from '@/lib/categoryData';
import { Metadata } from 'next';

interface Props {
  params: Promise<{
    locale: string;
  }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return getCategoryMetadata('moto-carbon', locale);
}

export default async function MotoCarbonPage({ params }: Props) {
  const { locale } = await params;
  return <CategoryPageTemplate categorySlug="moto-carbon" locale={locale} />;
}
