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
  return getCategoryMetadata('moto-suspension', locale);
}

export default async function MotoSuspensionPage({ params }: Props) {
  const { locale } = await params;
  return <CategoryPageTemplate categorySlug="moto-suspension" locale={locale} />;
}
