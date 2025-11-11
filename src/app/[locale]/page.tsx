import SplitHero from '@/components/sections/SplitHero';
import BrandsMarquee from '@/components/sections/BrandsMarquee';
import { useTranslations } from 'next-intl';

export default function LocalizedHomePage() {
  const tChoice = useTranslations('choice');
  // Split hero already shows Automotive / Motorcycles panels

  return (
    <main className="min-h-screen w-full flex flex-col bg-black">
      <SplitHero />
      <BrandsMarquee />
    </main>
  );
}
