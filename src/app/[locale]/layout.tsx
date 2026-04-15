import { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import Footer from '@/components/shared/Footer';
import AuthProvider from '@/components/AuthProvider';
import { cn } from '@/lib/utils';
import HeroVideoWrapper from '@/components/layout/HeroVideoWrapper';
import LocaleLangSetter from '@/components/LocaleLangSetter';
import { readVideoConfig } from '@/lib/videoConfig';
import LoadingScreen from '@/components/ui/LoadingScreen';
import CookieBanner from '@/components/ui/CookieBanner';
import AutoBreadcrumbs from '@/components/seo/AutoBreadcrumbs';

import { ScrollToTop } from '@/components/ScrollToTop';
import { ShopCurrencyProvider } from '@/components/shop/CurrencyContext';
import { prisma } from '@/lib/prisma';
import { getOrCreateShopSettings, getShopSettingsRuntime } from '@/lib/shopAdminSettings';

export function generateStaticParams() {
  return [{ locale: 'en' }, { locale: 'ua' }];
}

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  const currentYear = new Date().getFullYear();

  // Validate locale
  const locales = ['en', 'ua'];
  if (!locales.includes(locale)) {
    notFound();
  }

  // Get messages for this locale
  const messages = await getMessages();
  const videoConfig = await readVideoConfig();
  
  // Fetch Shop Settings for company requisites
  // Use a hardcoded fallback during build to avoid DB pool exhaustion on static generation
  let companyRequisites: string | null = null;
  try {
    const shopSettingsRecord = await Promise.race([
      getOrCreateShopSettings(prisma),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('DB timeout')), 5000))
    ]);
    const shopSettings = getShopSettingsRuntime(shopSettingsRecord);
    
    if (shopSettings.fopCompanyName) {
      companyRequisites = `${shopSettings.fopCompanyName}${shopSettings.fopEdrpou ? `, ЄДРПОУ: ${shopSettings.fopEdrpou}` : ''}`;
    }
  } catch (error) {
    // Fallback: use hardcoded requisites so the page still renders during build
    companyRequisites = 'ФОП Побережець Іван Юрійович, ЄДРПОУ: 3803206192';
    console.warn("Failed to fetch shop settings from DB for footer, using fallback:", error instanceof Error ? error.message : error);
  }

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <AuthProvider>
        <LocaleLangSetter locale={locale} />
        {videoConfig.heroPoster && (
          <link rel="preload" href={`/images/${videoConfig.heroPoster}`} as="image" />
        )}
        <LoadingScreen />
        <ShopCurrencyProvider>
          <div
            data-server-hero-enabled={videoConfig.heroEnabled ? 'true' : 'false'}
            className={cn('flex flex-col min-h-screen', locale === 'ua' && 'locale-ua')}
            lang={locale === 'ua' ? 'uk' : 'en'}
          >
            <HeroVideoWrapper src={`/videos/${videoConfig.heroVideo}`} mobileSrc={videoConfig.heroVideoMobile ? `/videos/${videoConfig.heroVideoMobile}` : undefined} poster={videoConfig.heroPoster ? `/images/${videoConfig.heroPoster}` : undefined} serverEnabled={videoConfig.heroEnabled ?? true} />
            {/* Font debug overlay removed */}
            <Header />
            <main id="main-content" className="flex-grow relative z-10">
              {children}
            </main>
            <AutoBreadcrumbs />
            <ScrollToTop />
            <Footer currentYear={currentYear} companyRequisites={companyRequisites} />
            <CookieBanner locale={locale} />
          </div>
        </ShopCurrencyProvider>
      </AuthProvider>
    </NextIntlClientProvider>
  );
}
