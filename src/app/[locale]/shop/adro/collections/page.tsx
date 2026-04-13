import { redirect } from 'next/navigation';

export default async function AdroCollectionsIndexPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect(`/${locale}/shop/adro`);
}
