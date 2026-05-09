"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";

export function EventuriHero() {
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!heroRef.current) return;
    gsap.fromTo(
      heroRef.current.querySelector(".hero-title"),
      { opacity: 0, y: 100 },
      { opacity: 1, y: 0, duration: 1.2, ease: "power3.out", delay: 0.5 }
    );
  }, []);

  return (
    <section
      ref={heroRef}
      className="relative h-screen flex items-center justify-center overflow-hidden"
    >
      <video
        className="absolute inset-0 w-full h-full object-cover"
        src="https://player.vimeo.com/external/434045526.sd.mp4?s=c27eecc69a27dbc4ff2b87d38afc35f1a9bc69bb&profile_id=165"
        autoPlay
        loop
        muted
        playsInline
      />
      <div className="absolute inset-0 bg-linear-to-b from-black/70 via-black/50 to-black/90" />
      <div className="relative z-10 max-w-6xl mx-auto px-8 text-center">
        <span className="inline-block px-6 py-2 bg-blue-500/20 border border-blue-400/40 rounded-full text-blue-300 text-sm font-medium tracking-widest backdrop-blur-xs mb-8">
          🇬🇧 ENGINEERED IN UK
        </span>
        <h1 className="hero-title text-6xl md:text-7xl lg:text-8xl font-bold mb-6">
          <span className="block bg-linear-to-r from-blue-200 via-cyan-400 to-blue-200 bg-clip-text text-transparent">
            EVENTURI
          </span>
        </h1>
        <p className="text-2xl md:text-3xl text-white/80 font-light mb-12 max-w-3xl mx-auto">
          Патентована технологія Venturi.
          <br />
          Інженерна досконалість у кожній деталі.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto mb-12">
          <div className="text-center">
            <div className="text-4xl md:text-5xl font-light text-blue-400 mb-2">+25л.с.</div>
            <div className="text-sm md:text-base text-white/60 uppercase">Приріст</div>
          </div>
          <div className="text-center">
            <div className="text-4xl md:text-5xl font-light text-blue-400 mb-2">100%</div>
            <div className="text-sm md:text-base text-white/60 uppercase">Карбон</div>
          </div>
          <div className="text-center">
            <div className="text-4xl md:text-5xl font-light text-blue-400 mb-2">Patent</div>
            <div className="text-sm md:text-base text-white/60 uppercase">Venturi</div>
          </div>
          <div className="text-center">
            <div className="text-4xl md:text-5xl font-light text-blue-400 mb-2">CFD</div>
            <div className="text-sm md:text-base text-white/60 uppercase">Тестування</div>
          </div>
        </div>
      </div>
    </section>
  );
}
