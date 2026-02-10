import { ReactNode } from 'react';
import { BreadcrumbSchema } from '@/components/seo/StructuredData';

export { generateMetadata } from './metadata';

export default async function Layout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://onecompany.global';
  const breadcrumbs = [
    { name: locale === 'ua' ? 'Головна' : 'Home', url: `${baseUrl}/${locale}` },
    { name: locale === 'ua' ? 'Контакти' : 'Contact', url: `${baseUrl}/${locale}/contact` },
  ];

  return (
    <>
      <BreadcrumbSchema items={breadcrumbs} />
      {children}
    </>
  );
}
