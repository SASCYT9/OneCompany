'use client';

import Link from 'next/link';
import Image from 'next/image';
import type { SupportedLocale } from '@/lib/seo';
import { DO88_FEATURED_MODELS } from '../data/do88HomeData';

type Props = {
  locale: SupportedLocale;
};

export default function Do88FeaturedModels({ locale }: Props) {
  const isUa = locale === 'ua';

  return (
    <section className="bg-black text-white py-24 px-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black pointer-events-none" />
      <div className="max-w-7xl mx-auto relative z-10">
        <div className="text-center mb-16 do88-animate-up">
          <p className="text-[11px] uppercase tracking-[0.3em] text-white/50 mb-3">
            {isUa ? 'Преміальний вибір' : 'Premium Selection'}
          </p>
          <h2 className="text-3xl md:text-5xl font-light uppercase tracking-tight">
            {isUa ? 'Популярні платформи' : 'Featured Platforms'}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {DO88_FEATURED_MODELS.map((model) => (
            <Link
              key={model.title}
              href={`/${locale}${model.link}`}
              className="group block relative aspect-[16/9] md:aspect-[4/3] rounded-3xl overflow-hidden border border-white/10 hover:border-white/30 transition duration-500"
            >
              <Image
                src={model.imageUrl}
                alt={isUa ? model.titleUk : model.title}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className={`object-cover transition duration-700 group-hover:scale-105 ${model.flipImage ? '[transform:scaleX(-1)] group-hover:[transform:scaleX(-1)_scale(1.05)]' : ''}`}
              />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-black/80 transition duration-500 group-hover:bg-black/40" />
              
              <div className="absolute inset-0 p-8 flex flex-col justify-end">
                <span className="inline-block px-3 py-1 mb-4 rounded-full border border-white/20 bg-white/10 backdrop-blur-md text-[10px] uppercase tracking-[0.2em] w-max">
                  {isUa ? model.badgeUk : model.badge}
                </span>
                
                <h3 className="text-2xl md:text-3xl font-light mb-2">
                  {isUa ? model.titleUk : model.title}
                </h3>
                
                <p className="text-sm text-white/60 mb-6">
                  {isUa ? model.subtitleUk : model.subtitle}
                </p>
                
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    <span className="text-[10px] uppercase tracking-wider text-white/40 border border-white/10 px-2 py-1 rounded">
                      {model.tagOne}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider text-white/40 border border-white/10 px-2 py-1 rounded">
                      {model.tagTwo}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-white/50 group-hover:text-white transition">
                    <span>{isUa ? model.buttonLabelUk : model.buttonLabel}</span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4 transform group-hover:translate-x-1 transition"><path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
