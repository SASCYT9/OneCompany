import { SupportedLocale } from '@/lib/seo';
import CSFHomeSignature from '../components/CSFHomeSignature';

export async function generateMetadata({ params: { locale } }: { params: { locale: SupportedLocale } }) {
  const isUa = locale === 'ua';
  return {
    title: isUa ? 'CSF Racing | Офіційний дилер в Україні | One Company' : 'CSF Racing | Official Dealer in Ukraine | One Company',
    description: isUa
      ? 'Високопродуктивні радіатори, інтеркулери та системи охолодження CSF Racing. Офіційна продукція.'
      : 'High-performance radiators, intercoolers, and cooling systems by CSF Racing. Official products.',
  };
}

export default function CSFRacingPage({ params: { locale } }: { params: { locale: SupportedLocale } }) {
  return <CSFHomeSignature locale={locale} />;
}
