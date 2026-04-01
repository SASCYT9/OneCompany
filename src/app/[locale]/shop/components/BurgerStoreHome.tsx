"use client";

import { useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";
import {
  BURGER_HERO,
  BURGER_STATS,
  BURGER_SHOWCASES,
  BURGER_BRANDS,
} from "../data/burgerHomeData";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
}

type Props = { locale: string };

const L = (isUa: boolean, en: string, ua: string) => (isUa ? ua : en);

export default function BurgerStoreHome({ locale }: Props) {
  const isUa = locale === "ua";
  const container = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      // Hero Animations
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      
      tl.from(".hero-eyebrow", { opacity: 0, scale: 0.95, duration: 0.7 })
        .from(".hero-title", { opacity: 0, y: 30, duration: 0.8 }, "-=0.5")
        .from(".hero-subtitle", { opacity: 0, y: 30, duration: 0.8 }, "-=0.6")
        .from(".hero-buttons", { opacity: 0, y: 20, duration: 0.6 }, "-=0.6");

      // Stats Stagger
      gsap.from(".stat-item", {
        scrollTrigger: {
          trigger: ".stats-section",
          start: "top 80%",
        },
        y: 30,
        opacity: 0,
        duration: 0.6,
        stagger: 0.1,
        ease: "power2.out",
      });

      // JB4 Apple-style Tech Feature Reveal
      gsap.from(".tech-image", {
        scrollTrigger: {
          trigger: ".tech-section",
          start: "top 75%",
        },
        x: -40,
        opacity: 0,
        duration: 1,
        ease: "expo.out",
      });

      gsap.from(".tech-text > *", {
        scrollTrigger: {
          trigger: ".tech-section",
          start: "top 75%",
        },
        x: 40,
        opacity: 0,
        duration: 0.8,
        stagger: 0.15,
        ease: "power3.out",
      });

      // Categories Stagger
      gsap.from(".category-card", {
        scrollTrigger: {
          trigger: ".categories-section",
          start: "top 80%",
        },
        y: 40,
        opacity: 0,
        duration: 0.7,
        stagger: 0.15,
        ease: "back.out(1.2)",
      });

      // Infinite Marquee setup
      gsap.to(".marquee-track", {
        xPercent: -50,
        ease: "none",
        duration: 40, // Adjust speed here
        repeat: -1,
      });
    },
    { scope: container }
  );

  return (
    <div ref={container} className="burger-store-home bg-black font-sans selection:bg-[var(--burger-yellow)] selection:text-black">
      {/* ═════ HERO SECTION (PREMIUM VIDEO / IMG) ═════ */}
      <section className="relative flex min-h-[90vh] w-full items-center pt-20 overflow-hidden">
        {/* High-Fidelity Static Background */}
        <Image
          src="/images/shop/burger/hero_burger_real.jpg"
          alt="Burger Motorsports Stealth Styling"
          fill
          priority
          className="object-cover object-center scale-105"
        />
        {/* Dark Slate Overlay for Text Readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/70 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black via-black/50 to-transparent" />

        <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col items-start px-6 lg:px-8 py-20">
          <div className="hero-eyebrow mb-8 flex items-center gap-3">
            <span className="h-[2px] w-12 bg-[var(--burger-yellow)]" />
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--burger-yellow)]">
              {L(isUa, BURGER_HERO.eyebrow, BURGER_HERO.eyebrowUk)}
            </span>
          </div>

          <h1 className="hero-title mb-6 font-display text-5xl font-extrabold leading-[1.1] tracking-tight text-white sm:text-7xl lg:text-8xl max-w-5xl">
            {L(isUa, BURGER_HERO.title, BURGER_HERO.titleUk)} <br/>
            <span className="text-zinc-500">{L(isUa, BURGER_HERO.titleLine2, BURGER_HERO.titleLine2Uk)}</span>
          </h1>

          <p className="hero-subtitle mb-10 max-w-2xl text-lg text-zinc-400 leading-relaxed sm:text-xl font-light">
            {L(isUa, BURGER_HERO.subtitle, BURGER_HERO.subtitleUk)}
          </p>

          <div className="hero-buttons flex flex-col gap-4 sm:flex-row">
            <Link
              href={`/${locale}${BURGER_HERO.primaryButtonLink}`}
              className="group inline-flex items-center justify-center bg-white px-8 py-4 text-sm font-bold uppercase tracking-widest text-black transition-all hover:bg-[var(--burger-yellow)] hover:scale-[1.02]"
            >
              {L(isUa, BURGER_HERO.primaryButtonLabel, BURGER_HERO.primaryButtonLabelUk)}
            </Link>
            <Link
              href={`/${locale}${BURGER_HERO.secondaryButtonLink}`}
              className="inline-flex items-center justify-center border border-zinc-700 bg-transparent px-8 py-4 text-sm font-bold uppercase tracking-widest text-white transition-all hover:bg-zinc-800 hover:border-zinc-500"
            >
              {L(isUa, BURGER_HERO.secondaryButtonLabel, BURGER_HERO.secondaryButtonLabelUk)}
            </Link>
          </div>
        </div>
      </section>

      {/* ═════ STATS METRICS (MINIMALIST) ═════ */}
      <section className="stats-section bg-black border-b border-white/10 relative z-10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center">
          {BURGER_STATS.map((s, i) => (
            <div
              key={i}
              className="stat-item flex flex-1 flex-col items-start border-b border-white/10 p-8 sm:border-b-0 sm:border-r last:border-r-0 lg:p-12 hover:bg-zinc-900/50 transition-colors"
            >
              <div className="text-4xl font-light text-white mb-2">{s.num}</div>
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                {L(isUa, s.label, s.labelUk)}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ═════ JB4 TECH HIGHLIGHT (APPLE-STYLE) ═════ */}
      <section className="tech-section bg-black py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid grid-cols-1 items-center gap-16 lg:grid-cols-2">
            
            {/* Minimalist Image Showcase */}
            <div className="tech-image relative aspect-[4/3] w-full bg-zinc-950 rounded-sm overflow-hidden group">
              <Image 
                src="/images/shop/burger/showcase-jb4.jpg" 
                alt="JB4 Tech" 
                fill 
                className="object-cover transition-transform duration-1000 group-hover:scale-105 opacity-80 group-hover:opacity-100" 
              />
              <div className="absolute inset-0 ring-1 ring-inset ring-white/10" />
            </div>

            {/* Clean Typography Block */}
            <div className="tech-text flex flex-col items-start gap-8">
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-[var(--burger-yellow)] mb-4 block">
                  JB4 Mobile App
                </span>
                <h2 className="font-display text-4xl font-extrabold text-white sm:text-5xl leading-tight">
                  {isUa ? "Точний Контроль" : "Precision Control"}
                </h2>
              </div>
              <p className="text-lg text-zinc-400 leading-relaxed max-w-md font-light">
                {isUa
                  ? "Новий додаток JB4 PRO Mobile App забезпечує зміну мап продуктивності, оновлення прошивок та розширене логування даних. Неперевершений доступ до параметрів вашого двигуна прямо зі смартфона."
                  : "The new JB4 PRO Mobile App provides performance map switching, firmware updates, and advanced data logging. Unrivaled access to your engine's parameters directly from your smartphone."}
              </p>
              <ul className="flex flex-col gap-6 border-l-2 border-white/10 pl-6 mt-4">
                <li className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">
                  <strong className="text-white block mb-1 text-base">{isUa ? "Мапи на льоту" : "On-the-fly Mapping"}</strong>
                  {isUa ? "Миттєва зміна налаштувань без відключення" : "Instant switching without downtime"}
                </li>
                <li className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">
                  <strong className="text-white block mb-1 text-base">{isUa ? "Розширене логування" : "Advanced Logging"}</strong>
                  {isUa ? "Аналіз до 40 параметрів двигуна одночасно" : "Record up to 40 data points simultaneously"}
                </li>
              </ul>
            </div>

          </div>
        </div>
      </section>

      {/* ═════ CATEGORY SHOWCASES (BRUTALIST CARDS) ═════ */}
      <section className="categories-section bg-zinc-950 py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mb-16 flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
            <div>
              <h2 className="font-display text-4xl font-extrabold text-white">
                {isUa ? "Каталог" : "Product Lines"}
              </h2>
              <p className="mt-4 text-zinc-400 font-light text-lg">
                {isUa ? "Легендарні компоненти для покращення динаміки" : "Legendary components for performance enhancement"}
              </p>
            </div>
            <Link
              href={`/${locale}/shop/burger/products`}
              className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:text-[var(--burger-yellow)]"
            >
              {isUa ? "Перейти до магазину" : "Shop All"} <span>→</span>
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3 lg:gap-8">
            {BURGER_SHOWCASES.map((s, i) => (
              <div
                key={i}
                className="category-card group relative flex h-[480px] flex-col overflow-hidden bg-black ring-1 ring-white/5"
              >
                <Link href={`/${locale}${s.link}`} className="absolute inset-0 z-20">
                  <span className="sr-only">View {s.name}</span>
                </Link>
                
                <div className="absolute inset-0 z-0 h-3/5">
                  <Image
                    src={s.imageUrl}
                    alt={s.name}
                    fill
                    className="object-cover transition-transform duration-1000 ease-out group-hover:scale-110 opacity-70 group-hover:opacity-100"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent" />
                </div>
                
                <div className="relative z-10 flex h-full flex-col justify-end p-8 transform transition-transform duration-500 group-hover:-translate-y-2">
                  <div className="mb-4 flex self-start bg-zinc-900 border border-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-zinc-300">
                    {L(isUa, s.badge, s.badgeUk)}
                  </div>
                  <h3 className="mb-3 text-2xl font-bold text-white leading-tight">
                    {L(isUa, s.name, s.nameUk)}
                  </h3>
                  <p className="mb-6 text-sm text-zinc-400 line-clamp-2 font-light">
                    {L(isUa, s.desc, s.descUk)}
                  </p>
                  <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-[var(--burger-yellow)]">
                    <span className="h-[1px] w-6 bg-[var(--burger-yellow)] transition-all duration-300 group-hover:w-12"></span>
                    {isUa ? "Переглянути" : "Explore"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═════ BRAND TICKER (INFINITE MARQUEE) ═════ */}
      <section className="bg-black py-16 border-t border-b border-white/5 overflow-hidden relative">
         <div className="pointer-events-none absolute bottom-0 left-0 top-0 z-10 w-40 bg-gradient-to-r from-black to-transparent" />
         <div className="pointer-events-none absolute bottom-0 right-0 top-0 z-10 w-40 bg-gradient-to-l from-black to-transparent" />
          
         <div className="flex w-max shrink-0 items-center overflow-hidden">
           <div className="marquee-track flex w-max shrink-0 items-center gap-16 pr-16 text-zinc-600">
             {/* Double array for infinite seamless scrolling */}
             {[...BURGER_BRANDS, ...BURGER_BRANDS].map((b, i) => (
                <Link
                  key={i}
                  href={`/${locale}${b.link}`}
                  className="text-sm font-bold uppercase tracking-[0.2em] transition-colors hover:text-[var(--burger-yellow)]"
                >
                  {b.name}
                </Link>
             ))}
           </div>
         </div>
      </section>
    </div>
  );
}
