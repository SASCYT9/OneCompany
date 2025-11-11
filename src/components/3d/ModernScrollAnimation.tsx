'use client';

import { useEffect, useRef } from 'react';
import Lenis from 'lenis';
import { motion, useScroll, useTransform } from 'framer-motion';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export default function ModernScrollAnimation() {
  const containerRef = useRef<HTMLDivElement>(null);
  const lenisRef = useRef<Lenis | null>(null);

  // Framer Motion scroll tracking
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  // Transform values based on scroll
  const opacity1 = useTransform(scrollYProgress, [0, 0.2, 0.3], [0, 1, 0]);
  const opacity2 = useTransform(scrollYProgress, [0.3, 0.5, 0.6], [0, 1, 0]);
  const opacity3 = useTransform(scrollYProgress, [0.6, 0.8, 1], [0, 1, 1]);
  
  const scale1 = useTransform(scrollYProgress, [0, 0.2, 0.3], [0.8, 1, 1.2]);
  const scale2 = useTransform(scrollYProgress, [0.3, 0.5, 0.6], [0.8, 1, 1.2]);
  const scale3 = useTransform(scrollYProgress, [0.6, 0.8, 1], [0.8, 1, 1]);

  useEffect(() => {
    // Initialize Lenis Smooth Scroll (найновіша версія 2025)
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 2,
      infinite: false,
    });

    lenisRef.current = lenis;

    // Sync Lenis with GSAP ScrollTrigger
    lenis.on('scroll', ScrollTrigger.update);

    gsap.ticker.add((time: number) => {
      lenis.raf(time * 1000);
    });

    gsap.ticker.lagSmoothing(0);

    // Animation loop
    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);

    return () => {
      lenis.destroy();
      gsap.ticker.remove((time: number) => {
        lenis.raf(time * 1000);
      });
    };
  }, []);

  return (
    <div ref={containerRef} className="relative">
      {/* Hero Section */}
      <section className="h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
        </div>
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: 'easeOut' }}
          className="text-center z-10"
        >
          <h1 className="text-8xl font-light tracking-tight mb-6">
            <span className="bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 bg-clip-text text-transparent">
              Modern
            </span>
            <br />
            <span className="text-white">Scroll Experience</span>
          </h1>
          <p className="text-2xl text-slate-400 mb-12">
            Lenis + Framer Motion + GSAP ScrollTrigger
          </p>
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="text-amber-400"
          >
            <svg className="w-8 h-8 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </motion.div>
        </motion.div>
      </section>

      {/* Pinned Animation Section - 400vh for smooth animation */}
      <div className="relative" style={{ height: '400vh' }}>
        <div className="sticky top-0 h-screen flex items-center justify-center bg-black overflow-hidden">
          {/* Background gradient that changes */}
          <motion.div
            className="absolute inset-0"
            style={{
              background: useTransform(
                scrollYProgress,
                [0, 0.33, 0.66, 1],
                [
                  'linear-gradient(135deg, #78350f 0%, #000000 100%)',
                  'linear-gradient(135deg, #7f1d1d 0%, #000000 100%)',
                  'linear-gradient(135deg, #1e3a8a 0%, #000000 100%)',
                  'linear-gradient(135deg, #1e3a8a 0%, #000000 100%)',
                ]
              ),
            }}
          />

          {/* Item 1 - KW */}
          <motion.div
            className="absolute inset-0 flex flex-col items-center justify-center"
            style={{ opacity: opacity1, scale: scale1 }}
          >
            <motion.div className="text-9xl mb-8">🔧</motion.div>
            <motion.h2 className="text-8xl font-bold bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent mb-4">
              KW Suspension
            </motion.h2>
            <motion.p className="text-3xl text-white/80">Німецька точність</motion.p>
            <motion.div className="mt-16 grid grid-cols-3 gap-12 text-center">
              <div>
                <div className="text-5xl font-bold text-amber-400">30+</div>
                <div className="text-xl text-white/60 mt-2">Років</div>
              </div>
              <div>
                <div className="text-5xl font-bold text-amber-400">1M+</div>
                <div className="text-xl text-white/60 mt-2">Клієнтів</div>
              </div>
              <div>
                <div className="text-5xl font-bold text-amber-400">15K+</div>
                <div className="text-xl text-white/60 mt-2">Моделей</div>
              </div>
            </motion.div>
          </motion.div>

          {/* Item 2 - Fi */}
          <motion.div
            className="absolute inset-0 flex flex-col items-center justify-center"
            style={{ opacity: opacity2, scale: scale2 }}
          >
            <motion.div className="text-9xl mb-8">🔥</motion.div>
            <motion.h2 className="text-8xl font-bold bg-gradient-to-r from-red-400 to-rose-500 bg-clip-text text-transparent mb-4">
              Fi Exhaust
            </motion.h2>
            <motion.p className="text-3xl text-white/80">Титановий звук</motion.p>
            <motion.div className="mt-16 grid grid-cols-3 gap-12 text-center">
              <div>
                <div className="text-5xl font-bold text-red-400">-15kg</div>
                <div className="text-xl text-white/60 mt-2">Вага</div>
              </div>
              <div>
                <div className="text-5xl font-bold text-red-400">+20hp</div>
                <div className="text-xl text-white/60 mt-2">Потужність</div>
              </div>
              <div>
                <div className="text-5xl font-bold text-red-400">100%</div>
                <div className="text-xl text-white/60 mt-2">Титан</div>
              </div>
            </motion.div>
          </motion.div>

          {/* Item 3 - Eventuri */}
          <motion.div
            className="absolute inset-0 flex flex-col items-center justify-center"
            style={{ opacity: opacity3, scale: scale3 }}
          >
            <motion.div className="text-9xl mb-8">💨</motion.div>
            <motion.h2 className="text-8xl font-bold bg-gradient-to-r from-blue-400 to-cyan-500 bg-clip-text text-transparent mb-4">
              Eventuri
            </motion.h2>
            <motion.p className="text-3xl text-white/80">Карбонова інженерія</motion.p>
            <motion.div className="mt-16 grid grid-cols-3 gap-12 text-center">
              <div>
                <div className="text-5xl font-bold text-blue-400">+25hp</div>
                <div className="text-xl text-white/60 mt-2">Приріст</div>
              </div>
              <div>
                <div className="text-5xl font-bold text-blue-400">100%</div>
                <div className="text-xl text-white/60 mt-2">Карбон</div>
              </div>
              <div>
                <div className="text-5xl font-bold text-blue-400">CFD</div>
                <div className="text-xl text-white/60 mt-2">Аналіз</div>
              </div>
            </motion.div>
          </motion.div>

          {/* Scroll Progress Bar */}
          <motion.div
            className="absolute bottom-8 left-1/2 -translate-x-1/2 w-64 h-1 bg-white/20 rounded-full overflow-hidden"
          >
            <motion.div
              className="h-full bg-gradient-to-r from-amber-400 via-red-400 to-blue-400"
              style={{ scaleX: scrollYProgress, transformOrigin: '0%' }}
            />
          </motion.div>
        </div>
      </div>

      {/* Final Section */}
      <section className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-900 to-black flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <h2 className="text-7xl font-bold text-white mb-6">Сучасний досвід</h2>
          <p className="text-2xl text-slate-400 mb-12">
            Smooth scroll • Responsive • Performance optimized
          </p>
          <div className="grid grid-cols-3 gap-8 max-w-4xl">
            <div className="p-8 bg-white/5 rounded-2xl backdrop-blur-sm border border-white/10">
              <div className="text-4xl mb-4">🎯</div>
              <h3 className="text-xl font-bold text-white mb-2">Lenis</h3>
              <p className="text-sm text-white/60">Найплавніший скрол 2025</p>
            </div>
            <div className="p-8 bg-white/5 rounded-2xl backdrop-blur-sm border border-white/10">
              <div className="text-4xl mb-4">⚡</div>
              <h3 className="text-xl font-bold text-white mb-2">Framer Motion</h3>
              <p className="text-sm text-white/60">Декларативні анімації</p>
            </div>
            <div className="p-8 bg-white/5 rounded-2xl backdrop-blur-sm border border-white/10">
              <div className="text-4xl mb-4">🎬</div>
              <h3 className="text-xl font-bold text-white mb-2">GSAP</h3>
              <p className="text-sm text-white/60">ScrollTrigger sync</p>
            </div>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
