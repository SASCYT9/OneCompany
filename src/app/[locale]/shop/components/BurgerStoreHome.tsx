"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import {
  BURGER_HERO,
  BURGER_STATS,
  BURGER_SHOWCASES,
  BURGER_BRANDS,
} from "../data/burgerHomeData";

type Props = { locale: string };

const L = (isUa: boolean, en: string, ua: string) => (isUa ? ua : en);

export default function BurgerStoreHome({ locale }: Props) {
  const isUa = locale === "ua";

  return (
    <div className="burger-store-home bg-black font-sans selection:bg-[var(--burger-yellow)] selection:text-black">
      {/* ═════ HERO SECTION (PREMIUM VIDEO) ═════ */}
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
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black to-transparent" />

        <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col items-start px-6 lg:px-8 py-20">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7 }}
            className="mb-8 flex items-center gap-3"
          >
            <span className="h-[2px] w-12 bg-[var(--burger-yellow)]" />
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--burger-yellow)]">
              {L(isUa, BURGER_HERO.eyebrow, BURGER_HERO.eyebrowUk)}
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="mb-6 font-display text-5xl font-extrabold leading-[1.1] tracking-tight text-white sm:text-7xl lg:text-8xl max-w-4xl"
          >
            {L(isUa, BURGER_HERO.title, BURGER_HERO.titleUk)} <br/>
            <span className="text-zinc-500">{L(isUa, BURGER_HERO.titleLine2, BURGER_HERO.titleLine2Uk)}</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="mb-10 max-w-2xl text-lg text-zinc-400 leading-relaxed sm:text-xl"
          >
            {L(isUa, BURGER_HERO.subtitle, BURGER_HERO.subtitleUk)}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="flex flex-col gap-4 sm:flex-row"
          >
            <Link
              href={`/${locale}${BURGER_HERO.primaryButtonLink}`}
              className="group inline-flex items-center justify-center bg-white px-8 py-4 text-sm font-bold uppercase tracking-wider text-black transition-all hover:bg-[var(--burger-yellow)]"
            >
              {L(isUa, BURGER_HERO.primaryButtonLabel, BURGER_HERO.primaryButtonLabelUk)}
            </Link>
            <Link
              href={`/${locale}${BURGER_HERO.secondaryButtonLink}`}
              className="inline-flex items-center justify-center border border-zinc-700 bg-transparent px-8 py-4 text-sm font-bold uppercase tracking-wider text-white transition-colors hover:bg-zinc-800"
            >
              {L(isUa, BURGER_HERO.secondaryButtonLabel, BURGER_HERO.secondaryButtonLabelUk)}
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ═════ STATS METRICS (MINIMALIST) ═════ */}
      <section className="bg-black border-b border-white/10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center">
          {BURGER_STATS.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="flex flex-1 flex-col items-start border-b border-white/10 p-8 sm:border-b-0 sm:border-r last:border-r-0 lg:p-12"
            >
              <div className="text-4xl font-light text-white mb-1">{s.num}</div>
              <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">
                {L(isUa, s.label, s.labelUk)}
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ═════ JB4 TECH HIGHLIGHT (APPLE-STYLE) ═════ */}
      <section className="bg-black py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid grid-cols-1 items-center gap-16 lg:grid-cols-2">
            
            {/* Minimalist Image Showcase */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="relative aspect-[4/3] w-full bg-zinc-950"
            >
              <Image 
                src="/images/shop/burger/showcase-jb4.jpg" 
                alt="JB4 Tech" 
                fill 
                className="object-cover opacity-90 transition-all duration-700" 
              />
              <div className="absolute inset-0 ring-1 ring-inset ring-white/5" />
            </motion.div>

            {/* Clean Typography Block */}
            <motion.div 
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="flex flex-col items-start gap-8"
            >
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-[var(--burger-yellow)] mb-3 block">
                  JB4 Mobile App
                </span>
                <h2 className="font-display text-4xl font-extrabold text-white sm:text-5xl leading-tight">
                  {isUa ? "Точний Контроль" : "Precision Control"}
                </h2>
              </div>
              <p className="text-base text-zinc-400 leading-relaxed max-w-md">
                {isUa
                  ? "Новий додаток JB4 PRO Mobile App забезпечує зміну мап продуктивності, оновлення прошивок та розширене логування даних. Неперевершений доступ до параметрів вашого двигуна прямо зі смартфона."
                  : "The new JB4 PRO Mobile App provides performance map switching, firmware updates, and advanced data logging. Unrivaled access to your engine's parameters directly from your smartphone."}
              </p>
              <ul className="flex flex-col gap-4 border-l border-white/10 pl-6">
                <li className="text-sm font-medium text-zinc-400">
                  <strong className="text-white block mb-1">{isUa ? "Мапи на льоту" : "On-the-fly Mapping"}</strong>
                  {isUa ? "Миттєва зміна налаштувань без відключення" : "Instant switching without downtime"}
                </li>
                <li className="text-sm font-medium text-zinc-400">
                  <strong className="text-white block mb-1">{isUa ? "Advanced Logging" : "Advanced Logging"}</strong>
                  {isUa ? "Аналіз до 40 параметрів двигуна одночасно" : "Record up to 40 data points simultaneously"}
                </li>
              </ul>
            </motion.div>

          </div>
        </div>
      </section>

      {/* ═════ CATEGORY SHOWCASES (BRUTALIST CARDS) ═════ */}
      <section className="bg-zinc-950 py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mb-16 flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
            <div>
              <h2 className="font-display text-4xl font-extrabold text-white">
                {isUa ? "Каталог" : "Product Lines"}
              </h2>
              <p className="mt-4 text-zinc-400">
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
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="group relative flex h-[480px] flex-col overflow-hidden bg-black"
              >
                <Link href={`/${locale}${s.link}`} className="absolute inset-0 z-20">
                  <span className="sr-only">View {s.name}</span>
                </Link>
                
                <div className="absolute inset-0 z-0 h-3/5">
                  <Image
                    src={s.imageUrl}
                    alt={s.name}
                    fill
                    className="object-cover transition-transform duration-700 ease-out group-hover:scale-105 opacity-80"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent" />
                </div>
                
                <div className="relative z-10 flex h-full flex-col justify-end p-8">
                  <div className="mb-4 flex self-start bg-zinc-900 px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-zinc-400">
                    {L(isUa, s.badge, s.badgeUk)}
                  </div>
                  <h3 className="mb-3 text-2xl font-bold text-white leading-tight">
                    {L(isUa, s.name, s.nameUk)}
                  </h3>
                  <p className="mb-6 text-sm text-zinc-400 line-clamp-2">
                    {L(isUa, s.desc, s.descUk)}
                  </p>
                  <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-[var(--burger-yellow)]">
                    <span className="h-[1px] w-6 bg-[var(--burger-yellow)] transition-all group-hover:w-10"></span>
                    {isUa ? "Переглянути" : "Explore"}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═════ BRAND TICKER (INFINITE MARQUEE) ═════ */}
      <section className="bg-black py-16 border-t border-b border-white/5 overflow-hidden relative">
         <div className="pointer-events-none absolute bottom-0 left-0 top-0 z-10 w-32 bg-gradient-to-r from-black to-transparent" />
         <div className="pointer-events-none absolute bottom-0 right-0 top-0 z-10 w-32 bg-gradient-to-l from-black to-transparent" />
          
         <motion.div 
           className="flex w-max shrink-0 items-center gap-16 pr-16"
           animate={{ x: ["0%", "-50%"] }}
           transition={{ repeat: Infinity, duration: 60, ease: "linear" }}
         >
           {[...BURGER_BRANDS, ...BURGER_BRANDS].map((b, i) => (
              <Link
                key={i}
                href={`/${locale}${b.link}`}
                className="text-sm font-bold uppercase tracking-[0.2em] text-zinc-700 transition-colors hover:text-[var(--burger-yellow)]"
              >
                {b.name}
              </Link>
           ))}
         </motion.div>
      </section>
    </div>
  );
}
