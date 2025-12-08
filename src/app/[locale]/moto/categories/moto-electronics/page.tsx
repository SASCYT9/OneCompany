import CategoryPageTemplate from '@/components/brands/CategoryPageTemplate';

interface Props {
  params: Promise<{
    locale: string;
  }>;
}

export default async function MotoElectronicsPage({ params }: Props) {
  const { locale } = await params;
  return <CategoryPageTemplate categorySlug="moto-electronics" locale={locale} />;
}
