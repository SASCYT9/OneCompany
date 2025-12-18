import Link from 'next/link';
import Image from 'next/image';
import { useTranslations } from 'next-intl';

type Panel = {
  href: string;
  imageSrc: string;
  title: string;
  subtitle: string;
  stats: { value: string; label: string };
};

export default function SplitHero() {
  const tChoice = useTranslations('choice');

  const panels: Panel[] = [
    {
      href: 'auto',
      imageSrc: '/images/hero-auto.png',
      title: tChoice('automotive'),
      subtitle: tChoice('automotiveSubtitle'),
      stats: { value: '160+', label: 'брендів' }
    },
    {
      href: 'moto',
      imageSrc: '/images/hero-moto.png',
      title: tChoice('motorcycles'),
      subtitle: tChoice('motorcyclesSubtitle'),
      stats: { value: '60+', label: 'брендів' }
    }
  ];

  return (
    <section className="relative w-full min-h-[70vh] lg:min-h-[82vh] grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-white/10 bg-black">
      {panels.map((panel) => (
        <Link
          key={panel.href}
          href={panel.href}
          className="relative group h-[50vh] lg:h-auto flex items-center justify-center overflow-hidden"
        >
          {/* background image */}
          <Image
            src={panel.imageSrc}
            alt={panel.title}
            fill
            className="object-cover opacity-60 group-hover:opacity-75 group-hover:scale-105 transition-all duration-700"
            priority
            quality={90}
          />
          {/* dark overlay and subtle vignette */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/30" />
          <div className="absolute inset-0 pointer-events-none" style={{
            background: 'radial-gradient(1200px 400px at 50% 0%, rgba(255,255,255,0.08), transparent 60%)'
          }} />

          {/* content */}
          <div className="relative z-10 text-center px-6">
            <div className="text-[10px] tracking-[0.35em] text-white/60 mb-5 uppercase">
              {tChoice('tagline')}
            </div>
            <h2 className="text-5xl md:text-6xl font-light text-white">
              {panel.title}
            </h2>
            <div className="mt-3 text-white/70 font-light">
              {panel.subtitle}
            </div>

            <div className="mt-8 inline-flex items-center gap-2 text-white/70 group-hover:text-white transition-colors">
              <span className="text-sm">{tChoice('featuredBrands')}</span>
              <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        </Link>
      ))}
    </section>
  );
}
