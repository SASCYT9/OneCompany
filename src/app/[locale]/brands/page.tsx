import { useTranslations } from 'next-intl';
import { allAutomotiveBrands, allMotoBrands } from '@/lib/brands';
import { getBrandLogo } from '@/lib/brandLogos';
import BrandLogosGrid from '@/components/sections/BrandLogosGrid';

export default function BrandsPage() {
  const tAuto = useTranslations('auto');
  const tMoto = useTranslations('moto');

  const automotiveItems = allAutomotiveBrands.map(b => ({
    name: b.name,
    logoSrc: getBrandLogo(b.name),
  }));

  const motoItems = allMotoBrands.map(b => ({
    name: b.name,
    logoSrc: getBrandLogo(b.name),
  }));

  return (
    <div className="px-6 md:px-10 py-20 md:py-28">
      <h1 className="text-4xl md:text-5xl font-bold mb-10 tracking-tight">Brands</h1>
      <BrandLogosGrid title={tAuto('allBrands')} items={automotiveItems} />
      <BrandLogosGrid title={tMoto('allBrands')} items={motoItems} />
      <p className="mt-6 text-xs text-white/40">Logos shown where available – others use a placeholder until assets are added.</p>
    </div>
  );
}