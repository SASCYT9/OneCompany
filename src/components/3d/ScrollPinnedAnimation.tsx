"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export default function ScrollPinnedAnimation() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const item1Ref = useRef<HTMLDivElement>(null);
  const item2Ref = useRef<HTMLDivElement>(null);
  const item3Ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const item1 = item1Ref.current;
    const item2 = item2Ref.current;
    const item3 = item3Ref.current;

    if (!section || !item1 || !item2 || !item3) return;

    // Створюємо timeline для послідовної анімації
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: "top top",
        end: "+=3000", // Довжина скролу (3000px віртуального скролу)
        scrub: true, // Прив'язка до скролу
        pin: true, // Прикріплюємо секцію
        anticipatePin: 1,
        markers: false, // Увімкніть true для дебагу
      },
    });

    // Анімація Item 1: fade in → fade out
    tl.fromTo(
      item1,
      { opacity: 0, scale: 0.8, y: 50 },
      { opacity: 1, scale: 1, y: 0, duration: 1, ease: "power2.out" }
    ).to(item1, { opacity: 0, scale: 1.1, y: -50, duration: 1, ease: "power2.in" });

    // Анімація Item 2: fade in → fade out
    tl.fromTo(
      item2,
      { opacity: 0, scale: 0.8, y: 50 },
      { opacity: 1, scale: 1, y: 0, duration: 1, ease: "power2.out" },
      "-=0.5" // Перекриття з попередньою анімацією
    ).to(item2, { opacity: 0, scale: 1.1, y: -50, duration: 1, ease: "power2.in" });

    // Анімація Item 3: fade in → fade out
    tl.fromTo(
      item3,
      { opacity: 0, scale: 0.8, y: 50 },
      { opacity: 1, scale: 1, y: 0, duration: 1, ease: "power2.out" },
      "-=0.5"
    ).to(item3, { opacity: 1, scale: 1, y: 0, duration: 1 }); // Залишається видимим в кінці

    return () => {
      tl.kill();
      ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
    };
  }, []);

  return (
    <div className="w-full">
      {/* Секція ДО (для демонстрації скролу) */}
      <section className="min-h-screen h-screen bg-linear-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-6xl font-bold text-white mb-4">Скрольте вниз</h2>
          <p className="text-2xl text-slate-400">↓ Дивіться магію анімації ↓</p>
        </div>
      </section>

      {/* PINNED СЕКЦІЯ З АНІМАЦІЄЮ */}
      <section
        ref={sectionRef}
        className="relative min-h-screen h-screen bg-black flex items-center justify-center overflow-hidden"
      >
        {/* Background Gradient */}
        <div className="absolute inset-0 bg-linear-to-br from-amber-900/20 via-black to-blue-900/20" />

        {/* Animated Items Container */}
        <div className="relative z-10 w-full h-full flex items-center justify-center">
          {/* Item 1 - KW Suspension */}
          <div
            ref={item1Ref}
            className="absolute inset-0 flex flex-col items-center justify-center opacity-0"
          >
            <div className="text-9xl mb-8">🔧</div>
            <h3 className="text-7xl font-bold bg-linear-to-r from-amber-400 to-amber-600 bg-clip-text text-transparent mb-4">
              KW Suspension
            </h3>
            <p className="text-3xl text-white/80">Німецька точність підвіски</p>
            <div className="mt-12 grid grid-cols-3 gap-8 text-center">
              <div>
                <div className="text-4xl font-bold text-amber-400">30+</div>
                <div className="text-xl text-white/60">Років досвіду</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-amber-400">1M+</div>
                <div className="text-xl text-white/60">Клієнтів</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-amber-400">15K+</div>
                <div className="text-xl text-white/60">Моделей авто</div>
              </div>
            </div>
          </div>

          {/* Item 2 - Fi Exhaust */}
          <div
            ref={item2Ref}
            className="absolute inset-0 flex flex-col items-center justify-center opacity-0"
          >
            <div className="text-9xl mb-8">🔥</div>
            <h3 className="text-7xl font-bold bg-linear-to-r from-red-400 to-rose-600 bg-clip-text text-transparent mb-4">
              Fi Exhaust
            </h3>
            <p className="text-3xl text-white/80">Титановий звук перемоги</p>
            <div className="mt-12 grid grid-cols-3 gap-8 text-center">
              <div>
                <div className="text-4xl font-bold text-red-400">-15kg</div>
                <div className="text-xl text-white/60">Вага системи</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-red-400">+20hp</div>
                <div className="text-xl text-white/60">Потужність</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-red-400">100%</div>
                <div className="text-xl text-white/60">Титан Grade 2</div>
              </div>
            </div>
          </div>

          {/* Item 3 - Eventuri */}
          <div
            ref={item3Ref}
            className="absolute inset-0 flex flex-col items-center justify-center opacity-0"
          >
            <div className="text-9xl mb-8">💨</div>
            <h3 className="text-7xl font-bold bg-linear-to-r from-blue-400 to-cyan-600 bg-clip-text text-transparent mb-4">
              Eventuri
            </h3>
            <p className="text-3xl text-white/80">Карбонова інженерія</p>
            <div className="mt-12 grid grid-cols-3 gap-8 text-center">
              <div>
                <div className="text-4xl font-bold text-blue-400">+25hp</div>
                <div className="text-xl text-white/60">Приріст потужності</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-blue-400">100%</div>
                <div className="text-xl text-white/60">Карбон</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-blue-400">CFD</div>
                <div className="text-xl text-white/60">Тестування</div>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll Progress Indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/40 text-sm">
          Скрольте для анімації
        </div>
      </section>

      {/* Секція ПІСЛЯ (для демонстрації скролу) */}
      <section className="min-h-screen h-screen bg-linear-to-br from-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-6xl font-bold text-white mb-4">Кінець анімації</h2>
          <p className="text-2xl text-slate-400">↑ Прокрутіть назад щоб побачити знову ↑</p>
        </div>
      </section>
    </div>
  );
}
