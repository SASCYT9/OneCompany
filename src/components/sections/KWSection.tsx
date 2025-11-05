'use client';

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

interface KWSectionProps {
  isActive: boolean;
}

export function KWSection({ isActive }: KWSectionProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!videoRef.current) return;

    if (isActive) {
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
    }
  }, [isActive]);

  useEffect(() => {
    if (!isActive || !contentRef.current) return;

    gsap.fromTo(contentRef.current,
      { opacity: 0, x: -100 },
      { opacity: 1, x: 0, duration: 1.2, ease: 'power3.out', delay: 0.3 }
    );
  }, [isActive]);

  return (
    <section className="relative h-screen w-full overflow-hidden">
      {/* Повноекранне відео на фоні */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        src="/videos/kw-suspension.mp4"
        loop
        muted
        playsInline
      />

      {/* Темний overlay для читабельності */}
      <div className="absolute inset-0 bg-gradient-to-r from-slate-900/90 via-slate-900/50 to-transparent" />

      {/* Контент */}
      <div 
        ref={contentRef}
        className="relative z-10 h-full flex flex-col justify-center px-12 md:px-24 max-w-3xl"
      >
        {/* Badge */}
        <div className="mb-6">
          <span className="inline-block px-6 py-2 bg-amber-500/20 border border-amber-400/30 rounded-full text-amber-300 text-sm font-medium tracking-wide backdrop-blur-sm">
            НІМЕЦЬКА ЯКІСТЬ
          </span>
        </div>

        {/* Заголовок */}
        <h2 className="text-5xl md:text-6xl lg:text-7xl font-light text-white mb-6">
          Тотальний<br />
          <span className="bg-gradient-to-r from-amber-200 to-amber-400 bg-clip-text text-transparent font-normal">
            контроль
          </span>
        </h2>

        {/* Опис */}
        <p className="text-lg md:text-xl text-slate-300 mb-8 leading-relaxed max-w-2xl">
          Технології перемоги для вашого авто. Розроблено та виготовлено в Німеччині для безкомпромісної керованості.
        </p>

        {/* Статистика */}
        <div className="flex gap-8 mb-12">
          <div>
            <div className="text-3xl font-light text-amber-400 mb-1">30+</div>
            <div className="text-sm text-slate-400 uppercase tracking-wide">Років на ринку</div>
          </div>
          <div>
            <div className="text-3xl font-light text-amber-400 mb-1">1000+</div>
            <div className="text-sm text-slate-400 uppercase tracking-wide">Переможців</div>
          </div>
        </div>

        {/* Кнопка */}
        <button className="group w-fit px-8 py-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white font-medium tracking-wide rounded-lg transition-all duration-300 shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40">
          <span className="flex items-center gap-2">
            ПІДІБРАТИ ПІДВІСКУ
            <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </span>
        </button>
      </div>
    </section>
  );
}
