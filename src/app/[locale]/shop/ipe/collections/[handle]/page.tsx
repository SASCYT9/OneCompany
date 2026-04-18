import { redirect } from 'next/navigation';

type Props = {
  params: Promise<{ locale: string; handle: string }>;
};

const IPE_BRAND_BY_HANDLE: Record<string, string> = {
  porsche: 'Porsche',
  ferrari: 'Ferrari',
  lamborghini: 'Lamborghini',
  mclaren: 'McLaren',
  audi: 'Audi',
  bmw: 'BMW',
};

export default async function IpeCollectionHandleRedirect({ params }: Props) {
  const { locale, handle } = await params;
  const brand = IPE_BRAND_BY_HANDLE[handle];
  const basePath = `/${locale}/shop/ipe/collections`;

  if (!brand) {
    redirect(basePath);
  }

  const query = new URLSearchParams({ brand }).toString();
  redirect(`${basePath}?${query}`);
}
