import { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import Footer from '@/components/shared/Footer';
import AuthProvider from '@/components/AuthProvider';
import { cn } from '@/lib/utils';

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
  
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <AuthProvider>
        <div className={cn('flex flex-col min-h-screen', locale === 'ua' && 'locale-ua')}>
          <Header />
          <main className="flex-grow">
            {children}
          </main>
          <Footer />
        </div>
      </AuthProvider>
    </NextIntlClientProvider>
  );
}
