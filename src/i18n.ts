import { getRequestConfig } from 'next-intl/server';
import { notFound } from 'next/navigation';

const locales = ['en', 'ua'] as const;

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  
  if (!locale || !locales.includes(locale as any)) notFound();

  // Static imports for Turbopack compatibility
  const messages = locale === 'en' 
    ? (await import('./lib/messages/en.json')).default
    : (await import('./lib/messages/ua.json')).default;

  return {
    locale,
    messages
  };
});
