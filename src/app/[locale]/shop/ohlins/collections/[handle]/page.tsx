import { redirect } from 'next/navigation';

type Props = {
  params: Promise<{ locale: string; handle: string }>;
};

const OHLINS_COLLECTION_QUERY_BY_HANDLE: Record<string, string | null> = {
  'road-track': 'category=Road%20%26%20Track',
  'advanced-track': 'category=Advanced%20Trackday',
  'dedicated-track': 'category=Motorsport',
  accessories: null,
};

export default async function OhlinsCollectionHandleRedirect({ params }: Props) {
  const { locale, handle } = await params;
  const query = OHLINS_COLLECTION_QUERY_BY_HANDLE[handle] ?? null;
  const basePath = `/${locale}/shop/ohlins/catalog`;

  redirect(query ? `${basePath}?${query}` : basePath);
}
