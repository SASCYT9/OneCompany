'use client';

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

export function KWHero() {
  const heroRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!heroRef.current) return;

    gsap.fromTo(heroRef.current.querySelector('.hero-title'),
      { opacity: 0, y: 100 },
      { opacity: 1, y: 0, duration: 1.2, ease: 'power3.out', delay: 0.5 }
    );

    gsap.fromTo(heroRef.current.querySelector('.hero-subtitle'),
      { opacity: 0, y: 50 },
      { opacity: 1, y: 0, duration: 1, ease: 'power2.out', delay: 0.8 }
    );

    gsap.fromTo(heroRef.current.querySelector('.hero-stats'),
      { opacity: 0, y: 30 },
      { opacity: 1, y: 0, duration: 1, ease: 'power2.out', delay: 1.1 }
    );
  }, []);

  return (
    <section ref={heroRef} className="relative h-screen flex items-center justify-center overflow-hidden">
      {/* Background Video */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        src="https://player.vimeo.com/external/434045526.sd.mp4?s=c27eecc69a27dbc4ff2b87d38afc35f1a9bc69bb&profile_id=165"
        autoPlay
        loop
        muted
        playsInline
      />

      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/90" />

      {/* Content */}
      <div className="relative z-10 max-w-6xl mx-auto px-8 text-center">
        {/* Badge */}
        <div className="mb-8">
          <span className="inline-block px-6 py-2 bg-amber-500/20 border border-amber-400/40 rounded-full text-amber-300 text-sm font-medium tracking-widest backdrop-blur-sm">
            🇩🇪 MADE IN GERMANY
          </span>
        </div>

        {/* Title */}
        <h1 className="hero-title text-6xl md:text-7xl lg:text-8xl font-bold mb-6">
          <span className="block text-white/90 font-light mb-2">KW</span>
          <span className="block bg-gradient-to-r from-amber-200 via-orange-400 to-amber-200 bg-clip-text text-transparent">
            SUSPENSION
          </span>
        </h1>

        {/* Subtitle */}
        <p className="hero-subtitle text-2xl md:text-3xl text-white/80 font-light mb-12 max-w-3xl mx-auto leading-relaxed">
          Німецька інженерія для тотального контролю.<br />
          Від вулиці до гоночного треку.
        </p>

        {/* Stats */}
        <div className="hero-stats grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto mb-12">
          <div className="text-center">
            <div className="text-4xl md:text-5xl font-light text-amber-400 mb-2">30+</div>
            <div className="text-sm md:text-base text-white/60 uppercase tracking-wide">Років досвіду</div>
          </div>
          <div className="text-center">
            <div className="text-4xl md:text-5xl font-light text-amber-400 mb-2">1M+</div>
            <div className="text-sm md:text-base text-white/60 uppercase tracking-wide">Клієнтів</div>
          </div>
          <div className="text-center">
            <div className="text-4xl md:text-5xl font-light text-amber-400 mb-2">15K+</div>
            <div className="text-sm md:text-base text-white/60 uppercase tracking-wide">Моделей авто</div>
          </div>
          <div className="text-center">
            <div className="text-4xl md:text-5xl font-light text-amber-400 mb-2">1000+</div>
            <div className="text-sm md:text-base text-white/60 uppercase tracking-wide">Переможців</div>
          </div>
        </div>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href="#products"
            className="group px-8 py-4 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-semibold rounded-lg transition-all duration-300 shadow-lg shadow-amber-500/30 hover:shadow-amber-500/50 hover:scale-105"
          >
            <span className="flex items-center justify-center gap-2">
              Каталог продукції
              <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </span>
          </a>
          <a
            href="#technology"
            className="px-8 py-4 border-2 border-amber-400/50 hover:border-amber-400 text-white font-semibold rounded-lg transition-all duration-300 backdrop-blur-sm hover:bg-amber-500/10"
          >
            Технології KW
          </a>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 border-2 border-amber-400/50 rounded-full flex items-start justify-center p-2">
            <div className="w-1.5 h-3 bg-amber-400 rounded-full" />
          </div>
        </div>
      </div>
    </section>
  );
}
