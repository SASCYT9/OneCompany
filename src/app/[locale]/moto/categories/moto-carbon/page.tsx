import CategoryPageTemplate from '@/components/brands/CategoryPageTemplate';

interface Props {
  params: Promise<{
    locale: string;
  }>;
}

export default async function MotoCarbonPage({ params }: Props) {
  const { locale } = await params;
  return <CategoryPageTemplate categorySlug="moto-carbon" locale={locale} />;
}
