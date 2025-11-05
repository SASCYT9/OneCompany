'use client';

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

interface EventuriSectionProps {
  isActive: boolean;
}

export function EventuriSection({ isActive }: EventuriSectionProps) {
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
      { opacity: 0, y: 100 },
      { opacity: 1, y: 0, duration: 1.2, ease: 'power3.out', delay: 0.3 }
    );
  }, [isActive]);

  return (
    <section className="relative h-screen w-full overflow-hidden">
      {/* Повноекранне відео на фоні */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        src="/videos/eventuri-intake.mp4"
        loop
        muted
        playsInline
      />

      {/* Темний overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/50 to-transparent" />

      {/* Контент внизу по центру */}
      <div 
        ref={contentRef}
        className="relative z-10 h-full flex flex-col justify-end items-center px-12 pb-24 max-w-4xl mx-auto"
      >
        {/* Badge */}
        <div className="mb-6">
          <span className="inline-block px-6 py-2 bg-blue-500/20 border border-blue-400/30 rounded-full text-blue-300 text-sm font-medium tracking-wide backdrop-blur-sm">
            ENGINEERED PERFECTION
          </span>
        </div>

        {/* Заголовок */}
        <h2 className="text-5xl md:text-6xl lg:text-7xl font-light text-white mb-6 text-center">
          Інженерна<br />
          <span className="bg-gradient-to-r from-blue-200 to-amber-400 bg-clip-text text-transparent font-normal">
            досконалість
          </span>
        </h2>

        {/* Опис */}
        <p className="text-lg md:text-xl text-slate-300 mb-8 leading-relaxed max-w-2xl text-center">
          Eventuri - революційні впускні системи з патентованою технологією Venturi. 
          Максимальний потік повітря для неперевершеної продуктивності.
        </p>

        {/* Статистика */}
        <div className="flex gap-12 mb-12">
          <div className="text-center">
            <div className="text-3xl font-light text-amber-400 mb-1">+25л.с.</div>
            <div className="text-sm text-slate-400 uppercase tracking-wide">Приріст</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-light text-amber-400 mb-1">100%</div>
            <div className="text-sm text-slate-400 uppercase tracking-wide">Карбон</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-light text-amber-400 mb-1">Patent</div>
            <div className="text-sm text-slate-400 uppercase tracking-wide">Venturi</div>
          </div>
        </div>

        {/* Кнопка */}
        <button className="group w-fit px-8 py-4 bg-gradient-to-r from-blue-500 to-amber-600 hover:from-blue-400 hover:to-amber-500 text-white font-medium tracking-wide rounded-lg transition-all duration-300 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40">
          <span className="flex items-center gap-2">
            ПІДІБРАТИ ВПУСК
            <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </span>
        </button>
      </div>
    </section>
  );
}
