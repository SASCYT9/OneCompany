import { buildPageMetadata, resolveLocale } from '@/lib/seo';
import Link from 'next/link';
import Image from 'next/image';
import { ADRO_PRODUCT_LINES } from '../../data/adroHomeData';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  return buildPageMetadata(resolvedLocale, 'shop/adro/collections', {
    title:
      resolvedLocale === 'ua'
        ? 'Каталог ADRO | Карбонові Аерокіти | One Company'
        : 'ADRO Catalog | Carbon Fiber Aerokits | One Company',
    description:
      resolvedLocale === 'ua'
        ? 'Повний каталог преміальних карбонових аерокітів ADRO для BMW, Porsche, Toyota, Tesla. Препрег карбон з CFD-валідацією.'
        : 'Full catalog of premium ADRO carbon fiber aerokits for BMW, Porsche, Toyota, Tesla. Prepreg carbon with CFD validation.',
  });
}

export default async function AdroCollectionsPage({ params }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  const isUa = resolvedLocale === 'ua';

  return (
    <div className="relative min-h-screen bg-black">
      {/* Premium Dark Carbon Backdrop */}
      <div className="fixed inset-0 z-0">
        <Image
          src="/images/shop/adro/adro-m3-front.jpg"
          alt="ADRO Carbon"
          fill
          priority
          className="object-cover opacity-15 grayscale"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#050505]/80 via-black/90 to-[#030303] backdrop-blur-[10px]" />
        
        {/* Subtle teal-ish accent glow matching ADRO branding */}
        <div className="absolute top-1/4 left-1/3 w-[800px] h-[400px] bg-white/[0.02] blur-[200px] rounded-full pointer-events-none mix-blend-screen opacity-50" />
      </div>

      <div className="relative z-10 pt-[100px]">
        <div className="w-full max-w-[1700px] mx-auto px-6 md:px-12 lg:px-16 pb-6 pt-4">
          <Link href={`/${locale}/shop/adro`} className="text-[10px] uppercase tracking-[0.2em] text-white/40 hover:text-white transition-colors font-semibold">
            ← {isUa ? 'Повернутися до ADRO' : 'Return to ADRO'}
          </Link>
        </div>

        {/* Collection Header */}
        <div className="w-full max-w-[1700px] mx-auto px-6 md:px-12 lg:px-16 pb-10">
          <h1 className="text-3xl md:text-4xl font-extralight tracking-[0.15em] uppercase text-white mb-2">
            {isUa ? 'Платформи' : 'Vehicle Platforms'}
          </h1>
          <p className="text-white/40 text-sm tracking-wide max-w-2xl">
            {isUa
              ? 'Оберіть вашу платформу для перегляду доступних карбонових компонентів ADRO.'
              : 'Select your vehicle platform to browse available ADRO carbon fiber components.'}
          </p>
        </div>

        {/* Platform Grid */}
        <div className="w-full max-w-[1700px] mx-auto px-6 md:px-12 lg:px-16 pb-20">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {ADRO_PRODUCT_LINES.map((line, idx) => (
              <Link
                key={line.id}
                href={`/${locale}/shop/adro/collections/${line.id}`}
                className="group relative bg-[#050505]/60 backdrop-blur-xl overflow-hidden flex flex-col hover:bg-[rgba(10,10,10,0.85)] transition-all duration-500 border border-white/[0.04] shadow-2xl"
              >
                {/* Image */}
                <div className="relative aspect-[16/10] bg-transparent overflow-hidden">
                  <Image
                    src={line.image}
                    alt={isUa ? line.nameUk : line.name}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-contain transition-transform duration-700 group-hover:scale-110 p-4"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                </div>

                {/* Content */}
                <div className="px-6 pb-6 pt-4 flex flex-col flex-grow relative">
                  <span className="text-[9px] uppercase tracking-[0.25em] font-bold text-white/40 mb-2">
                    {isUa ? line.badgeUk : line.badge}
                  </span>
                  <h3 className="text-lg font-light tracking-wider text-white mb-2">
                    {isUa ? line.nameUk : line.name}
                  </h3>
                  <p className="text-white/40 text-xs leading-relaxed line-clamp-2">
                    {isUa ? line.descriptionUk : line.description}
                  </p>
                  
                  <div className="mt-4 flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-white/30 group-hover:text-white/60 transition-colors">
                    <span>{isUa ? 'Переглянути' : 'View Collection'}</span>
                    <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
                  </div>
                </div>

                {/* Top accent line on hover */}
                <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/40 to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
