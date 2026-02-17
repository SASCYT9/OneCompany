import { ReactNode } from 'react';
import { BreadcrumbSchema } from '@/components/seo/StructuredData';
import { absoluteUrl, buildLocalizedPath } from '@/lib/seo';

export { generateMetadata } from './metadata';

export default async function Layout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const resolvedLocale = locale === 'ua' ? 'ua' : 'en';
  const breadcrumbs = [
    { name: locale === 'ua' ? 'Головна' : 'Home', url: absoluteUrl(buildLocalizedPath(resolvedLocale)) },
    { name: locale === 'ua' ? 'Про нас' : 'About Us', url: absoluteUrl(buildLocalizedPath(resolvedLocale, '/about')) },
  ];

  return (
    <>
      <BreadcrumbSchema items={breadcrumbs} />
      {children}
    </>
  );
}
