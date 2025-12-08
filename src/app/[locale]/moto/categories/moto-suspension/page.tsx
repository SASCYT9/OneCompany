import CategoryPageTemplate from '@/components/brands/CategoryPageTemplate';

interface Props {
  params: Promise<{
    locale: string;
  }>;
}

export default async function MotoSuspensionPage({ params }: Props) {
  const { locale } = await params;
  return <CategoryPageTemplate categorySlug="moto-suspension" locale={locale} />;
}
