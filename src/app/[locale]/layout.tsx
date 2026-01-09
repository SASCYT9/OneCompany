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

import { ScrollToTop } from '@/components/ScrollToTop';

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  
  // Validate locale
  const locales = ['en', 'ua'];
  if (!locales.includes(locale)) {
    notFound();
  }
  
  // Get messages for this locale
  const messages = await getMessages();
  const videoConfig = await readVideoConfig();

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <AuthProvider>
      <LocaleLangSetter locale={locale} />
        {videoConfig.heroPoster && (
          <link rel="preload" href={`/images/${videoConfig.heroPoster}`} as="image" />
        )}
        <LoadingScreen />
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
          <ScrollToTop />
          <Footer />
        </div>
      </AuthProvider>
    </NextIntlClientProvider>
  );
}
