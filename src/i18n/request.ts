import {getRequestConfig} from 'next-intl/server';

const locales = ['en', 'ua'];
 
export default getRequestConfig(async ({requestLocale}) => {
  let locale = await requestLocale;
  
  if (!locale || !locales.includes(locale)) {
    locale = 'ua';
  }

  return {
    locale,
    messages: (await import(`../lib/messages/${locale}.json`)).default
  };
});