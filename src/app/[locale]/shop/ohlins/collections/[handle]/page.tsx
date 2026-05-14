import { redirect } from "next/navigation";

// Cache-bust 2026-05-14T22: Vercel ISR cache held empty/errored renders for many brand routes — likely DB pool exhaustion during a build/revalidate window. Touching to rebuild.
type Props = {
  params: Promise<{ locale: string; handle: string }>;
};

const OHLINS_COLLECTION_QUERY_BY_HANDLE: Record<string, string | null> = {
  "road-track": "category=Road%20%26%20Track",
  "advanced-track": "category=Advanced%20Trackday",
  "dedicated-track": "category=Motorsport",
  accessories: null,
};

export default async function OhlinsCollectionHandleRedirect({ params }: Props) {
  const { locale, handle } = await params;
  const query = OHLINS_COLLECTION_QUERY_BY_HANDLE[handle] ?? null;
  const basePath = `/${locale}/shop/ohlins/catalog`;

  redirect(query ? `${basePath}?${query}` : basePath);
}
