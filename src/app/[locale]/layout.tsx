import { NextIntlClientProvider, useMessages } from 'next-intl';
import { ReactNode, use } from 'react';
import { LocalizedNavigation } from '@/components/ui/LocalizedNavigation';

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export default function LocaleLayout({ children, params }: Props) {
  const { locale } = use(params);
  const messages = useMessages();

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <LocalizedNavigation />
      {children}
    </NextIntlClientProvider>
  );
}
