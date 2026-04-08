'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { SupportedLocale } from '@/lib/seo';
import { useEffect, useState } from 'react';

type Props = { locale: SupportedLocale };

function L(isUa: boolean, en: string, ua: string) {
  return isUa ? ua : en;
}

export default function RacechipHomeSignature({ locale }: Props) {
  const isUa = locale === 'ua';
  useEffect(() => {
    // Simple intersection observer for reveal animations
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('rc-vis');
          }
        });
      },
      { threshold: 0.15 }
    );

    document.querySelectorAll('[data-rc-reveal]').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="rc-home bg-[#080808] text-white min-h-screen font-sans selection:bg-[#c29d59] selection:text-white relative">
      {/* Global Asphalt Noise — covers entire page */}
      <div className="fixed inset-0 bg-[url('/noise.png')] bg-repeat opacity-[0.15] mix-blend-overlay pointer-events-none z-[1]"></div>
      
      {/* ─── Back to Stores ─── */}
      <div className="fixed top-[60px] left-0 z-50 p-6">
        <Link href={`/${locale}/shop`} className="text-[10px] text-zinc-500 hover:text-white uppercase tracking-[0.2em] font-light transition-colors">
          ← {L(isUa, 'All our stores', 'Усі наші магазини')}
        </Link>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          SECTION 1 — CINEMATIC HERO
      ════════════════════════════════════════════════════════════════════ */}
      <section className="relative w-full h-[70vh] min-h-[500px] flex items-center justify-center overflow-hidden">
        
        {/* MEDIA CONTEXT */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/images/shop/racechip/hero-stealth-fixed.png"
            alt="Racechip Concept Pure"
            fill
            className="object-cover object-center"
            unoptimized
            priority
          />
          {/* Subtle vignette so the text remains legible without hiding the car */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#080808] via-black/40 to-black/70 pointer-events-none"></div>
          <div className="absolute inset-0 bg-[url('/noise.png')] opacity-10 mix-blend-overlay pointer-events-none"></div>
        </div>

        {/* CONTENT */}
        <div className="relative z-10 px-6 md:px-16 lg:px-24 mx-auto w-full max-w-5xl flex flex-col items-center text-center -mt-20" data-rc-reveal>
          <div className="text-[#c29d59] text-[10px] md:text-xs font-light tracking-[0.3em] uppercase mb-6 flex items-center gap-4 drop-shadow-md">
            {L(isUa, "ELEVATE. PERFORM. EXPERIENCE.", "ПІДНІМАЙ. ДОСЯГАЙ. ВІДЧУВАЙ.")}
          </div>
          
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-thin uppercase tracking-[0.05em] leading-tight mb-8 drop-shadow-2xl text-white">
            {L(isUa, "THE APEX", "ВЕРШИНА")} <span className="font-light">{L(isUa, "OF POWER.", "ДИНАМІКИ.")}</span>
          </h1>

          <p className="text-zinc-300 text-sm md:text-lg max-w-2xl leading-relaxed mb-12 font-light drop-shadow-md">
            {L(isUa,
              "Unlock hidden performance with RaceChip. Precision engineered for driving dynamics.",
              "Розкрийте прихований потенціал з RaceChip. Точна інженерія для максимальної динаміки керування."
            )}
          </p>

          <Link
            href={`/${locale}/shop/racechip/catalog`}
            className="relative inline-flex items-center justify-center px-10 py-4 bg-[#c29d59]/80 backdrop-blur-md border border-[#c29d59]/50 text-white font-light text-[11px] tracking-[0.2em] uppercase overflow-hidden group rounded-sm shadow-[0_0_30px_rgba(194,157,89,0.3)] hover:bg-white hover:text-black hover:border-white transition-all duration-500"
          >
            <span className="relative z-10 flex items-center gap-4">
              {L(isUa, "CONFIGURE YOUR VEHICLE", "ВІДКРИТИ КАТАЛОГ")}
            </span>
          </Link>
        </div>

      </section>

      {/* ════════════════════════════════════════════════════════════════════
          SECTION 2 — APP CONTROL FEATURE
      ════════════════════════════════════════════════════════════════════ */}
      <section className="relative py-16 md:py-24 px-6 md:px-16 lg:px-24 overflow-hidden flex flex-col lg:flex-row items-center gap-12 lg:gap-24">
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#c29d59]/5 blur-[120px] rounded-full pointer-events-none z-0"></div>
        
        <div className="w-full lg:w-1/2 relative z-10 mx-auto" data-rc-reveal>
          <div className="aspect-video bg-[#111] rounded-2xl overflow-hidden border border-white/10 shadow-[0_0_50px_rgba(194,157,89,0.15)] relative">
            <div className="absolute inset-0 w-full h-full p-2">
              <Image 
                src="/images/shop/racechip/app-stealth-realui.png" 
                alt="RaceChip App Control Interface" 
                fill
                className="object-cover rounded-xl transition-transform duration-[2s] hover:scale-110"
                unoptimized
              />
            </div>
          </div>
        </div>

        <div className="w-full lg:w-[45%] relative z-10" data-rc-reveal>
          <div className="flex items-center gap-4 mb-8">
            <span className="w-8 h-[1px] bg-[#c29d59]/50"></span>
            <span className="text-[#c29d59] text-[9px] font-light uppercase tracking-[0.3em] rounded-[2px]">
              {L(isUa, "Smart Control", "Розумне Керування")}
            </span>
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-thin uppercase tracking-[0.05em] mb-8 text-white">
            {L(isUa, "Control At Your Fingertips.", "Керування під рукою.")}
          </h2>
          <p className="text-zinc-400 text-sm md:text-base mb-12 leading-relaxed max-w-md font-light">
            {L(isUa,
              "Choose between Efficiency, Sport, and Race modes dynamically from your smartphone. The RaceChip app allows you to adapt your car's performance to any driving situation instantly.",
              "Миттєво перемикайте режими Efficiency, Sport та Race зі свого смартфону. Додаток RaceChip дозволяє динамічно адаптувати характер вашого авто до будь-якої ситуації на дорозі."
            )}
          </p>

          <ul className="flex flex-col gap-6 mb-12 border-t border-white/10 pt-8">
            {[
              L(isUa, "Dynamic mode switching on the fly", "Динамічне перемикання режимів на льоту"),
              L(isUa, "Warm-up timer integration", "Інтегрований таймер прогріву двигуна"),
              L(isUa, "Automatic software updates", "Автоматичні оновлення програмного забезпечення")
            ].map((item, idx) => (
              <li key={idx} className="flex items-center gap-5 text-[11px] md:text-xs font-light text-zinc-300 uppercase tracking-[0.2em]">
                <div className="w-1.5 h-1.5 rounded-full bg-[#c29d59]/80 shadow-[0_0_10px_rgba(194,157,89,0.8)] flex-shrink-0"></div>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          SECTION 3 — PRECISION ENGINEERING
      ════════════════════════════════════════════════════════════════════ */}
      <section className="relative py-16 md:py-32 px-6 md:px-16 lg:px-24 overflow-hidden flex flex-col-reverse lg:flex-row items-center gap-12 lg:gap-24">
        {/* Glow on the left for Section 3 */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#c29d59]/5 blur-[120px] rounded-full pointer-events-none z-0"></div>
        
        {/* TEXT CONTENT (NOW ON THE LEFT) */}
        <div className="w-full lg:w-[45%] relative z-10" data-rc-reveal>
          <div className="flex items-center gap-4 mb-8">
            <span className="w-8 h-[1px] bg-[#c29d59]/50"></span>
            <span className="text-[#c29d59] text-[9px] font-light uppercase tracking-[0.3em] rounded-[2px]">
              {L(isUa, "German Engineering", "Німецька Інженерія")}
            </span>
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-thin uppercase tracking-[0.05em] mb-8 text-white">
            {L(isUa, "Power Meets Precision.", "Абсолютна Точність та Динаміка.")}
          </h2>
          <p className="text-zinc-400 text-sm md:text-base mb-12 leading-relaxed max-w-md font-light">
            {L(isUa,
              "Precision engineered in Germany. The RaceChip GTS Black interfaces seamlessly with your engine's sensors via a high-grade, plug-and-play wiring harness, safely unlocking hidden power reserves without permanently altering the factory ECU.",
              "Справжня німецька інженерія. RaceChip GTS Black підключається безпосередньо до датчиків двигуна через професійну систему Plug & Drive. Він безпечно розкриває прихований потенціал автомобіля, не залишаючи жодних слідів у заводському блоці управління (ECU)."
            )}
          </p>

          <ul className="flex flex-col gap-6 mb-12 border-t border-white/10 pt-8">
            {[
              L(isUa, "Plug & Drive installation in 15 minutes", "Встановлення Plug & Drive за 15 хвилин"),
              L(isUa, "Preserves factory engine warranty limits", "Зберігає ліміти заводської гарантії"),
              L(isUa, "Invisible to official dealership diagnostics", "Залишається невидимим для офіційної діагностики")
            ].map((item, idx) => (
              <li key={idx} className="flex items-center gap-5 text-[11px] md:text-xs font-light text-zinc-300 uppercase tracking-[0.2em]">
                <div className="w-1.5 h-1.5 rounded-full bg-[#c29d59]/80 shadow-[0_0_10px_rgba(194,157,89,0.8)] flex-shrink-0"></div>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* IMAGE (NOW ON THE RIGHT) */}
        <div className="w-full lg:w-1/2 relative z-10 mx-auto" data-rc-reveal>
          <div className="aspect-square lg:aspect-[4/3] bg-[#0a0a0a]/50 rounded-2xl overflow-hidden border border-white/5 shadow-[0_0_80px_rgba(0,0,0,0.5)] relative group backdrop-blur-sm">
            <div className="absolute inset-0 w-full h-full p-1 opacity-90 transition-opacity duration-700 group-hover:opacity-100">
              <Image 
                src="/images/shop/racechip/gts-black-macro.png" 
                alt="RaceChip GTS Black Carbon Module" 
                fill
                className="object-cover rounded-xl transition-transform duration-[3s] group-hover:scale-[1.03]"
                unoptimized
              />
            </div>
            {/* Edge highlights */}
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-transparent to-white/5 pointer-events-none rounded-2xl mix-blend-overlay"></div>
            <div className="absolute inset-0 shadow-[inset_0_0_30px_rgba(194,157,89,0.02)] pointer-events-none rounded-2xl"></div>
          </div>
        </div>

      </section>
      {/* CSS for reveal logic block */}
      <style jsx global>{`
        [data-rc-reveal] {
          opacity: 0;
          transform: translateY(30px);
          transition: opacity 1s cubic-bezier(0.19, 1, 0.22, 1), transform 1s cubic-bezier(0.19, 1, 0.22, 1);
        }
        [data-rc-reveal].rc-vis {
          opacity: 1;
          transform: translateY(0);
        }
        @keyframes slowZoom {
          from { transform: scale(1.02); }
          to { transform: scale(1.1); }
        }
      `}</style>
    </div>
  );
}
