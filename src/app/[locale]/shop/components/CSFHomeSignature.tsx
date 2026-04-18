"use client";

import React, { useRef } from 'react';
import Link from 'next/link';
import { motion, useScroll, useTransform } from 'framer-motion';
import type { SupportedLocale } from '@/lib/seo';
import {
  CSF_HERO,
  CSF_MATERIALS,
  CSF_PRODUCT_LINES,
  CSF_HERITAGE,
} from '../data/csfHomeData';

type Props = { locale: SupportedLocale; smmSource?: string };

function L(isUa: boolean, en: string, ua: string) {
  return isUa ? ua : en;
}

const CSF_METRICS = [
  { val: '50+', en: 'Years Eng.', ua: 'Років досвіду' },
  { val: '−40%', en: 'Weight vs OEM', ua: 'Вага vs заводу' },
  { val: '+15%', en: 'B-Tube Trans.', ua: 'Теплообмін' },
  { val: '6061', en: 'Alloy Grade', ua: 'Марка сплаву' },
];

const ALUMINUM_SPECS = [
  { val: '6061-T6', en: 'Alloy Grade', ua: 'Марка сплаву' },
  { val: '−40%', en: 'Weight vs OEM', ua: 'Вага vs OEM' },
  { val: 'TIG', en: 'Weld Method', ua: 'Тип зварки' },
  { val: '100%', en: 'Aluminum Core', ua: 'Алюмінієва серцевина' },
];

const BTUBE_SPECS = [
  { val: '+15%', en: 'Surface Area', ua: 'Площа теплообміну' },
  { val: 'B-Shape', en: 'Cross Section', ua: 'Поперечний переріз' },
  { val: 'Patent', en: 'CSF Exclusive', ua: 'Тільки CSF' },
  { val: '−20%', en: 'Weight Saving', ua: 'Зниження ваги' },
];

// Staggered Text Reveal Helper
const TextReveal = ({ text }: { text: string }) => {
  return (
    <span className="flex overflow-hidden">
      {text.split('').map((char, index) => (
        <motion.span
          key={index}
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          transition={{ duration: 0.8, ease: [0.76, 0, 0.24, 1], delay: index * 0.03 }}
          className="inline-block"
        >
          {char === ' ' ? '\u00A0' : char}
        </motion.span>
      ))}
    </span>
  );
};

export default function CSFHomeSignature({ locale }: Props) {
  const isUa = locale === 'ua';
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  const heroY = useTransform(scrollYProgress, [0, 0.3], ["0%", "25%"]);
  const headerOpacity = useTransform(scrollYProgress, [0, 0.1], [1, 0]);

  return (
    <div ref={containerRef} className="relative min-h-screen bg-[#030303] text-zinc-300 font-sans selection:bg-[#c29d59] selection:text-black pt-[130px]">
      
      {/* Infinite Marquee via internal CSS injection for ultimate smoothness */}
      <style>{`
        @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .animate-inf-marquee { animation: marquee 20s linear infinite; }
        .scan-line { background: linear-gradient(to bottom, transparent 50%, rgba(255, 255, 255, 0.05) 51%, transparent 51%); background-size: 100% 4px; pointer-events: none; }
      `}</style>
      
      <div className="w-full flex overflow-hidden whitespace-nowrap bg-[#c29d59] text-black py-2 relative z-40">
        <div className="flex animate-inf-marquee">
           {/* Duplicate the array to make infinite scrolling seamless */}
           {[...Array(20)].map((_, i) => (
             <div key={i} className="flex items-center gap-6 pr-6">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em]">CSF RACING SYSTEM</span>
                <span className="w-1 h-1 bg-black rounded-full" />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em]">{L(isUa, 'MAXIMUM HEAT DISSIPATION', 'МАКСИМАЛЬНЕ ТЕПЛОВІДВЕДЕННЯ')}</span>
                <span className="w-1 h-1 bg-black rounded-full" />
             </div>
           ))}
        </div>
      </div>

      {/* Main Grid Wrapper */}
      <div className="mx-auto max-w-[1600px] border-l border-r border-white/5 relative bg-[#030303]">
        
        {/* Top Navbar Area */}
        <div className="grid grid-cols-2 md:grid-cols-4 border-b border-white/5 relative z-40 bg-[#030303]">
          <div className="p-6 md:p-8 border-r border-white/5 flex items-center justify-center relative group">
             <Link href={`/${locale}/shop`} className="text-[10px] uppercase tracking-widest text-[#c29d59] hover:text-white transition-colors flex items-center gap-2">
                <span className="group-hover:-translate-x-1 transition-transform">←</span> {L(isUa, 'Stores', 'Магазини')}
             </Link>
          </div>
          <div className="p-6 md:p-8 hidden md:flex items-center justify-center border-r border-white/5 overflow-hidden relative">
            <span className="text-[10px] text-zinc-600 uppercase tracking-widest relative z-10 block">ARC-CSF/01</span>
          </div>
          <div className="p-6 md:p-8 hidden md:flex items-center justify-center border-r border-white/5 relative">
            <span className="text-[10px] text-zinc-600 uppercase tracking-widest opacity-50">SYS.ONLINE</span>
          </div>
          <div className="p-6 md:p-8 flex items-center justify-center">
            <span className="text-[10px] text-[#c29d59] uppercase tracking-widest font-semibold flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-none bg-[#c29d59] animate-pulse" />
              {L(isUa, 'Active', 'Активний')}
            </span>
          </div>
        </div>

        {/* HERO SECTION */}
        <div className="grid grid-cols-1 lg:grid-cols-2 min-h-[85vh] border-b border-white/5 overflow-hidden bg-[#030303]">
          
          {/* Left: Typography */}
          <div className="relative p-8 md:p-16 flex flex-col justify-center border-r border-white/5 overflow-hidden">
            {/* Ambient Animated Number background */}
            <motion.div 
              className="absolute -right-20 top-20 text-[20rem] font-bold text-white/[0.02] pointer-events-none select-none tracking-tighter"
              initial={{ x: 100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 1.5, ease: "easeOut" }}
            >
              01
            </motion.div>

            {/* Corner Crosshairs */}
            <div className="absolute top-8 left-8 text-white/20 text-[10px] leading-none">+</div>
            <div className="absolute bottom-8 left-8 text-white/20 text-[10px] leading-none">+</div>
            <div className="absolute top-8 right-8 text-white/20 text-[10px] leading-none">+</div>
            <div className="absolute bottom-8 right-8 text-white/20 text-[10px] leading-none">+</div>

            <motion.div 
              style={{ opacity: headerOpacity }}
              className="relative z-10"
            >
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1, delay: 0.2 }}
                className="text-[10px] text-[#c29d59] mb-8 tracking-widest uppercase flex items-center gap-4"
              >
                <span className="w-8 h-[1px] bg-[#c29d59]"></span>
                {L(isUa, 'Thermal Dynamics', 'Термальна Динаміка')}
              </motion.div>
              
              <h1 className="text-4xl sm:text-6xl lg:text-7xl xl:text-8xl font-light tracking-tighter leading-[0.9] text-white mb-8 select-none">
                <TextReveal text={L(isUa, 'THERMAL', 'ТЕРМАЛЬНА')} />
                <br/>
                <span className="text-zinc-600 block -mt-2">
                  <TextReveal text={L(isUa, 'SUPREMACY', 'ПЕРЕВАГА')} />
                </span>
              </h1>
              
              <motion.p 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.8, ease: "easeOut" }}
                className="text-sm md:text-base text-zinc-500 font-light max-w-sm leading-relaxed mb-12"
              >
                {L(isUa, CSF_HERO.subtitle, CSF_HERO.subtitleUk)}
              </motion.p>
              
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1, delay: 1.2 }}
              >
                <Link href={`/${locale}/shop/csf/collections`} className="group flex items-center max-w-max border border-white/10 hover:border-[#c29d59] px-8 py-5 transition-all duration-500 bg-white/[0.02] hover:bg-[#c29d59]/10 relative overflow-hidden">
                  <span className="absolute inset-0 bg-gradient-to-r from-transparent via-[#c29d59]/10 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
                  <span className="text-[10px] uppercase font-bold text-white tracking-[0.2em] relative z-10">{L(isUa, 'Initialize Catalog', 'Відкрити Каталог')}</span>
                  <span className="ml-6 flex items-center justify-center w-6 h-6 rounded-full border border-white/10 group-hover:border-[#c29d59] transition-colors relative z-10 overflow-hidden">
                    <span className="text-[#c29d59] text-[10px] group-hover:translate-x-6 transition-transform duration-300 absolute">→</span>
                    <span className="text-[#c29d59] text-[10px] -translate-x-6 group-hover:translate-x-0 transition-transform duration-300 absolute">→</span>
                  </span>
                </Link>
              </motion.div>
            </motion.div>
          </div>
          
          {/* Right: Technical Image with Scanning Parallax */}
          <div className="relative overflow-hidden w-full h-[50vh] lg:h-auto border-t lg:border-t-0 border-white/5 lg:border-none group">
            <motion.div 
              style={{ y: heroY }}
              className="absolute inset-0 scale-[1.15]"
            >
              <img 
                src={CSF_HERO.heroImageFallback} 
                alt="CSF Racing" 
                className="w-full h-full object-cover opacity-80 transition-transform ease-out group-hover:scale-105"
                style={{ transitionDuration: '2s' }}
              />
              {/* Technical CRT Scan lines */}
              <div className="absolute inset-0 scan-line mix-blend-overlay opacity-30"></div>
            </motion.div>

            {/* Glowing orb behind data to give depth */}
            <div className="absolute bottom-10 left-1/2 w-96 h-96 bg-[#c29d59] blur-[150px] opacity-[0.05] rounded-full pointer-events-none" />

            {/* Metrics overlay strictly positioned */}
            <div className="absolute bottom-0 left-0 w-full grid grid-cols-2 border-t border-white/5 backdrop-blur-md bg-black/60 relative">
              {CSF_METRICS.slice(0,2).map((s, i) => (
                <div key={i} className={`p-6 md:p-8 flex items-baseline gap-4 ${i === 0 ? 'border-r border-white/5' : ''}`}>
                  <span className="text-2xl font-light text-white tabular-nums tracking-tighter">{s.val}</span>
                  <span className="text-[10px] uppercase tracking-widest text-[#c29d59] hidden sm:inline-block font-medium">{L(isUa, s.en, s.ua)}</span>
                </div>
              ))}
              {/* Progress bar effect simulating data stream */}
              <div className="absolute top-0 left-0 h-[1px] bg-[#c29d59]/50 w-full overflow-hidden">
                <motion.div 
                  initial={{ x: "-100%" }}
                  animate={{ x: "100%" }}
                  transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
                  className="h-full w-1/3 bg-[#c29d59] shadow-[0_0_10px_#c29d59]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* TECHNICAL SPECS: B-Tube & Aluminum */}
        <div className="grid grid-cols-1 lg:grid-cols-2 border-b border-white/5">
          {/* B-TUBE Section */}
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={{
              hidden: { opacity: 0 },
              visible: { opacity: 1, transition: { duration: 0.8, staggerChildren: 0.1 } }
            }}
            className="flex flex-col border-r border-white/5"
          >
            <div className="aspect-[16/9] w-full border-b border-white/5 overflow-hidden relative group">
              <img
                src={CSF_MATERIALS.btube.image}
                className="w-full h-full object-cover opacity-90 transition-all group-hover:opacity-100 group-hover:scale-105"
                style={{ transitionDuration: '1.5s' }}
                alt="B-Tube"
              />
              <div className="absolute top-4 left-4 border border-white/10 bg-black/80 px-2 py-1 text-[9px] uppercase tracking-widest text-[#c29d59]">FIG 01.</div>
              <div className="absolute inset-0 scan-line mix-blend-overlay opacity-20"></div>
            </div>
            <div className="p-8 md:p-16">
              <h2 className="text-2xl lg:text-3xl font-light text-white mb-6 uppercase tracking-tight flex items-center gap-4">
                <span className="w-2 h-2 bg-[#c29d59] rounded-none shadow-[0_0_8px_#c29d59] animate-pulse"></span>
                {L(isUa, CSF_MATERIALS.btube.title, CSF_MATERIALS.btube.titleUk)}
              </h2>
              <p className="text-zinc-500 font-light text-sm mb-12 max-w-md leading-relaxed">
                {L(isUa, CSF_MATERIALS.btube.description, CSF_MATERIALS.btube.descriptionUk)}
              </p>
              <div className="grid grid-cols-2 gap-y-8 gap-x-4">
                {BTUBE_SPECS.map((s, idx) => (
                  <motion.div variants={{ hidden: { opacity: 0, scale: 0.95 }, visible: { opacity: 1, scale: 1 }}} key={idx} className="flex flex-col border-l border-[#c29d59]/30 pl-4 hover:border-[#c29d59] transition-colors duration-300">
                    <span className="text-xl font-light text-white">{s.val}</span>
                    <span className="text-[10px] text-zinc-600 uppercase tracking-widest mt-1">{L(isUa, s.en, s.ua)}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Aluminum Section */}
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={{
              hidden: { opacity: 0 },
              visible: { opacity: 1, transition: { duration: 0.8, staggerChildren: 0.1 } }
            }}
            className="flex flex-col border-t lg:border-t-0 border-white/5"
          >
            <div className="aspect-[16/9] w-full border-b border-white/5 overflow-hidden relative group">
              <img
                src={CSF_MATERIALS.aluminum.image}
                className="w-full h-full object-cover opacity-90 transition-all group-hover:opacity-100 group-hover:scale-105"
                style={{ transitionDuration: '1.5s' }}
                alt="Aluminum"
              />
              <div className="absolute top-4 left-4 border border-white/10 bg-black/80 px-2 py-1 text-[9px] uppercase tracking-widest text-[#c29d59]">FIG 02.</div>
              <div className="absolute inset-0 scan-line mix-blend-overlay opacity-20"></div>
            </div>
            <div className="p-8 md:p-16">
               <h2 className="text-2xl lg:text-3xl font-light text-white mb-6 uppercase tracking-tight flex items-center gap-4">
                <span className="w-2 h-2 border border-[#c29d59] rounded-none flex items-center justify-center p-[2px]">
                   <span className="w-full h-full bg-[#c29d59]"></span>
                </span>
                {L(isUa, CSF_MATERIALS.aluminum.title, CSF_MATERIALS.aluminum.titleUk)}
              </h2>
              <p className="text-zinc-500 font-light text-sm mb-12 max-w-md leading-relaxed">
                {L(isUa, CSF_MATERIALS.aluminum.description, CSF_MATERIALS.aluminum.descriptionUk)}
              </p>
              <div className="grid grid-cols-2 gap-y-8 gap-x-4">
                {ALUMINUM_SPECS.map((s, idx) => (
                  <motion.div variants={{ hidden: { opacity: 0, scale: 0.95 }, visible: { opacity: 1, scale: 1 }}} key={idx} className="flex flex-col border-l border-[#c29d59]/30 pl-4 hover:border-[#c29d59] transition-colors duration-300">
                    <span className="text-xl font-light text-white">{s.val}</span>
                    <span className="text-[10px] text-zinc-600 uppercase tracking-widest mt-1">{L(isUa, s.en, s.ua)}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>

        {/* MODULAR PLATFORM (Products Table) */}
        <div className="border-b border-white/5 grid grid-cols-1">
          <div className="p-8 md:p-16 border-b border-white/5 text-center bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+PHBhdGggZD0iTTAgMGg0MHY0MEgwek0zOSAzaDFWMGgtMXYzIiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDMpIi8+PC9zdmc+')] mix-blend-screen relative z-10 overflow-hidden group">
            <div className="absolute inset-0 bg-[#c29d59]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
            <motion.h2 
              initial={{ y: 20, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true }}
              className="text-4xl lg:text-6xl font-light tracking-tighter text-white uppercase relative z-10"
            >
              {L(isUa, 'Network', 'Мережа')}
            </motion.h2>
            <div className="mt-4 text-[10px] tracking-widest text-[#c29d59] uppercase relative z-10">Product Specifications Matrix</div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-[1px] bg-white/5">
            {CSF_PRODUCT_LINES.map((line, idx) => (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                key={line.id} 
              >
                <Link href={`/${locale}${line.link}`} className="group block relative bg-[#030303] overflow-hidden h-full">
                  <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10" />
                  <div className="relative aspect-[4/3] w-full border-b border-white/5 overflow-hidden">
                    <img
                      src={line.image}
                      alt={line.name}
                      className="relative z-0 h-full w-full object-cover opacity-70 transition-all group-hover:opacity-100 group-hover:scale-105"
                      style={{ transitionDuration: '1s' }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none z-10"></div>
                  </div>
                  <div className="p-8 h-48 flex flex-col justify-between">
                    <div>
                      <span className="block text-[9px] uppercase tracking-[0.2em] text-[#c29d59] mb-2 font-bold opacity-70 group-hover:opacity-100 transition-opacity">SYS.{line.id.substring(0,3).toUpperCase()}</span>
                      <h3 className="text-lg text-white font-medium uppercase tracking-wide group-hover:text-[#c29d59] transition-colors duration-300">{L(isUa, line.name, line.nameUk)}</h3>
                    </div>
                    <div className="flex justify-between items-end border-t border-white/10 pt-4 mt-4 relative overflow-hidden">
                      <motion.div 
                        initial={false}
                        className="absolute bottom-0 left-0 w-full h-[1px] bg-[#c29d59] -translate-x-full group-hover:translate-x-0 transition-transform duration-500 ease-out"
                      />
                      <span className="text-[10px] uppercase font-bold text-zinc-500 group-hover:text-white transition-colors">{L(isUa, line.badge, line.badgeUk)}</span>
                      <span className="text-zinc-600 group-hover:text-[#c29d59] transition-colors flex items-center justify-center w-6 h-6 border border-white/10 rounded-none group-hover:border-[#c29d59]">↗</span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>

        {/* HERITAGE - Footer block */}
        <div className="grid grid-cols-1 lg:grid-cols-3 border-b border-white/5">
          <div className="p-8 md:p-16 lg:col-span-2 flex flex-col justify-center border-r border-white/5 relative overflow-hidden">
            <div className="absolute -left-32 top-0 text-[15rem] font-bold text-white/[0.01] pointer-events-none select-none tracking-tighter mix-blend-screen leading-none">
              1974
            </div>
            <motion.h2 
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="text-3xl md:text-4xl lg:text-5xl font-light tracking-tighter uppercase text-white mb-8 relative z-10"
            >
              {L(isUa, CSF_HERITAGE.title, CSF_HERITAGE.titleUk)}
            </motion.h2>
            <p className="text-sm md:text-base text-zinc-500 font-light max-w-2xl leading-relaxed relative z-10">
              {L(isUa, CSF_HERITAGE.description, CSF_HERITAGE.descriptionUk)}
            </p>
          </div>
          <div className="lg:col-span-1 h-64 lg:h-auto relative opacity-80 mix-blend-lighten group overflow-hidden border-t lg:border-t-0 border-white/5">
            <motion.img 
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 1 }}
              src={CSF_HERITAGE.fallbackImage} 
              className="w-full h-full object-cover" 
              alt="Heritage" 
            />
            <div className="absolute inset-0 bg-[#c29d59] mix-blend-overlay opacity-0 group-hover:opacity-20 transition-opacity duration-1000 pointer-events-none"></div>
          </div>
        </div>

      </div>
    </div>
  );
}
