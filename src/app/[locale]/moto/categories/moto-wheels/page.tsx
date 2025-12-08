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
  return getCategoryMetadata('moto-wheels', locale);
}

export default async function MotoWheelsPage({ params }: Props) {
  const { locale } = await params;
  return <CategoryPageTemplate categorySlug="moto-wheels" locale={locale} />;
}
