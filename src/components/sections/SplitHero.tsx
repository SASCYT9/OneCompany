import Link from 'next/link';
import { useTranslations } from 'next-intl';

type Panel = {
  href: string;
  videoSrc: string;
  title: string;
  subtitle: string;
};

export default function SplitHero() {
  const tChoice = useTranslations('choice');

  const panels: Panel[] = [
    {
      href: 'auto',
      videoSrc: '/videos/eventuri-intake.mp4',
      title: tChoice('automotive'),
      subtitle: tChoice('automotiveSubtitle')
    },
    {
      href: 'moto',
      videoSrc: '/videos/kw-suspension.mp4',
      title: tChoice('motorcycles'),
      subtitle: tChoice('motorcyclesSubtitle')
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
          {/* background video */}
          <video
            className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-70 transition-opacity duration-500"
            src={panel.videoSrc}
            autoPlay
            muted
            loop
            playsInline
          />
          {/* dark overlay and subtle vignette */}
          <div className="absolute inset-0 bg-black/50" />
          <div className="absolute inset-0 pointer-events-none" style={{
            background: 'radial-gradient(1200px 400px at 50% 0%, rgba(255,255,255,0.06), transparent 60%)'
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
