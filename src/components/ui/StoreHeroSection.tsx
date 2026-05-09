"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { trackEvent } from "../../lib/analytics";

interface StoreHeroSectionProps {
  storeId: "kw" | "fi" | "eventuri";
  isVisible: boolean;
}

export function StoreHeroSection({ storeId, isVisible }: StoreHeroSectionProps) {
  const [isAnimated, setIsAnimated] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setIsAnimated(true);
    }
  }, [isVisible]);

  // Respect user motion preferences: pause background videos when prefers-reduced-motion is enabled
  useEffect(() => {
    if (typeof window === "undefined") return;
    const shouldReduce =
      window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!shouldReduce) return;
    const videos = document.querySelectorAll<HTMLVideoElement>(".hero-video");
    videos.forEach((v) => {
      try {
        v.pause();
        v.removeAttribute("autoplay");
        v.removeAttribute("loop");
      } catch {}
    });
  }, []);

  // KW Suspension
  if (storeId === "kw") {
    return (
      <div
        className={`fixed inset-0 relative flex items-center justify-center pointer-events-none transition-all duration-1000 ${isVisible ? "opacity-100" : "opacity-0"}`}
      >
        {/* Background videos moved into 3D Canvas for premium composition */}
        <div className="absolute inset-0 -z-10 bg-linear-to-b from-black/75 via-black/80 to-black/90" />
        <div className="max-w-6xl mx-auto px-4 md:px-8 pointer-events-auto w-full">
          {/* Заголовок */}
          <div
            className={`text-center mb-4 md:mb-8 transition-all duration-1000 delay-200 ${isAnimated ? "translate-y-0 opacity-100" : "translate-y-20 opacity-0"}`}
          >
            <div className="flex justify-center mb-3 md:mb-4">
              <Image
                src="/logos/kw-official.png"
                alt="KW Suspension Україна - спортивна підвіска тюнінг Київ, купити KW OneCompany"
                width={0}
                height={0}
                sizes="100vw"
                className="h-6 md:h-8 lg:h-10 w-auto opacity-90"
              />
            </div>
            <div className="mb-3 md:mb-4">
              <span className="px-3 md:px-4 lg:px-6 py-1.5 md:py-2 rounded-full bg-linear-to-r from-orange-500 to-red-600 bg-opacity-20 backdrop-blur-md border border-orange-500/30 text-xs md:text-sm font-medium text-orange-400 uppercase tracking-[0.15em] md:tracking-[0.2em] lg:tracking-[0.4em] shadow-2xl shadow-orange-500/30 inline-block">
                🇩🇪 Німецька Якість
              </span>
            </div>
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-extralight text-white mb-2 md:mb-3 tracking-tight leading-tight px-4">
              Тотальний
              <span className="block font-light text-white/80 tracking-wide">контроль</span>
            </h1>
            <p className="text-sm md:text-lg lg:text-xl font-light text-white/70 max-w-2xl mx-auto leading-relaxed mb-2 md:mb-3 px-4">
              Технології перемоги для вашого авто. Розроблено та виготовлено в Німеччині для
              безкомпромісної керованості.
            </p>
            <div className="flex flex-col md:flex-row items-center justify-center gap-3 md:gap-8 text-orange-400 text-xs md:text-sm font-light px-4">
              <div className="flex items-center gap-2">
                <div className="w-2 md:w-3 h-2 md:h-3 rounded-full bg-orange-500 animate-pulse shadow-lg shadow-orange-500/50" />
                <span className="tracking-wide whitespace-nowrap">30+ РОКІВ НА ПОДІУМІ</span>
              </div>
              <div className="hidden md:block w-1 h-1 rounded-full bg-orange-500/50" />
              <div className="flex items-center gap-2">
                <div className="w-2 md:w-3 h-2 md:h-3 rounded-full bg-red-500 animate-pulse shadow-lg shadow-red-500/50" />
                <span className="tracking-wide whitespace-nowrap">1000+ ПЕРЕМОГ У ГОНКАХ</span>
              </div>
            </div>
          </div>

          {/* Features Grid */}
          <div
            className={`grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mb-4 md:mb-8 px-4 transition-all duration-1000 delay-500 ${isAnimated ? "translate-y-0 opacity-100" : "translate-y-20 opacity-0"}`}
          >
            {[
              { icon: "🏆", title: "Німецька якість", desc: "Найвищі стандарти виробництва" },
              { icon: "⚡", title: "Автоспорт", desc: "Перевірено у найжорсткіших умовах" },
              { icon: "🔬", title: "Інновації", desc: "Постійні інвестиції в R&D" },
            ].map((feature, i) => (
              <div
                key={i}
                className="group relative bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-4 md:p-8 hover:border-white/20 transition-all duration-300"
              >
                <div className="text-3xl md:text-5xl mb-3 md:mb-4 transition-transform duration-300 group-hover:scale-110">
                  {feature.icon}
                </div>
                <h3 className="text-lg md:text-xl font-light text-white mb-1 md:mb-2 tracking-wide">
                  {feature.title}
                </h3>
                <p className="text-xs md:text-sm font-light text-white/60 leading-relaxed">
                  {feature.desc}
                </p>
                <div className="absolute bottom-0 left-0 right-0 h-1 rounded-b-2xl overflow-hidden">
                  <div className="h-full bg-linear-to-r from-orange-500 to-red-600 transition-all duration-700 w-0 group-hover:w-full" />
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div
            className={`text-center transition-all duration-700 delay-500 ${isAnimated ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"}`}
          >
            <Link
              href="https://kwsuspension.shop"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() =>
                trackEvent("cta_click", {
                  store: "kw",
                  location: "hero",
                  label: "Підібрати підвіску",
                })
              }
              className="group inline-flex items-center gap-4 px-10 py-4 bg-white/10 border border-white/20 rounded-full text-white text-base font-light uppercase tracking-[0.25em] hover:bg-white/15 transition-all duration-300"
            >
              <span>Підібрати підвіску</span>
              <span className="text-xl transition-transform duration-300 group-hover:translate-x-1">
                →
              </span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Fi Exhaust
  if (storeId === "fi") {
    return (
      <div
        className={`fixed inset-0 relative flex items-center justify-center pointer-events-none transition-all duration-1000 ${isVisible ? "opacity-100" : "opacity-0"}`}
      >
        {/* Background videos moved into 3D Canvas for premium composition */}
        <div className="absolute inset-0 -z-10 bg-linear-to-b from-black/80 via-black/85 to-black/95" />
        <div className="max-w-6xl mx-auto px-4 md:px-8 pointer-events-auto w-full">
          {/* Заголовок */}
          <div
            className={`text-center mb-4 md:mb-8 transition-all duration-1000 delay-200 ${isAnimated ? "translate-y-0 opacity-100" : "translate-y-20 opacity-0"}`}
          >
            <div className="flex justify-center mb-3 md:mb-4">
              <img
                src="/logos/fi.svg"
                alt="Fi Exhaust Україна - вихлопні системи Valvetronic тюнінг Київ, купити Fi Exhaust OneCompany"
                className="h-6 md:h-8 lg:h-10 w-auto opacity-90"
                loading="lazy"
              />
            </div>
            <div className="mb-3 md:mb-4">
              <span className="px-3 md:px-4 lg:px-6 py-1.5 md:py-2 rounded-full bg-linear-to-r from-cyan-400 to-blue-600 bg-opacity-20 backdrop-blur-md border border-cyan-400/30 text-xs md:text-sm font-medium text-cyan-400 uppercase tracking-[0.15em] md:tracking-[0.2em] lg:tracking-[0.4em] shadow-2xl shadow-cyan-500/30 inline-block">
                🔊 Valvetronic
              </span>
            </div>
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-extralight text-white mb-2 md:mb-3 tracking-tight leading-tight px-4">
              Fi Exhaust
              <span className="block text-xl md:text-2xl lg:text-3xl font-light text-white/80 mt-1">
                звук та потужність
              </span>
            </h1>
            <p className="text-sm md:text-lg lg:text-xl font-light text-white/70 max-w-2xl mx-auto leading-relaxed mb-2 md:mb-3 px-4">
              Вихлоп, який неможливо ігнорувати. Максимум емоцій. Максимум звуку. Для авто, які
              створені виділятись.
            </p>
            <div className="flex flex-col md:flex-row items-center justify-center gap-3 md:gap-8 text-cyan-400 text-xs md:text-sm font-light px-4">
              <div className="flex items-center gap-2">
                <div className="w-2 md:w-3 h-2 md:h-3 rounded-full bg-cyan-500 animate-pulse shadow-lg shadow-cyan-500/50" />
                <span className="tracking-wide whitespace-nowrap">УНІКАЛЬНИЙ ТЕМБР</span>
              </div>
              <div className="hidden md:block w-1 h-1 rounded-full bg-cyan-500/50" />
              <div className="flex items-center gap-2">
                <div className="w-2 md:w-3 h-2 md:h-3 rounded-full bg-blue-500 animate-pulse shadow-lg shadow-blue-500/50" />
                <span className="tracking-wide whitespace-nowrap">+30 HP ГАРАНТОВАНО</span>
              </div>
            </div>
          </div>

          {/* Features Grid - більш агресивний */}
          <div
            className={`grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-8 md:mb-12 px-4 transition-all duration-1000 delay-500 ${isAnimated ? "translate-y-0 opacity-100" : "translate-y-20 opacity-0"}`}
          >
            {[
              { icon: "🎛️", title: "Valvetronic", desc: "Динамічний контроль звучання" },
              { icon: "⚡", title: "Збільшена потужність", desc: "Кращий потік вихлопних газів" },
              { icon: "🔊", title: "Унікальний звук", desc: "Фірмовий тембр Fi" },
            ].map((feature, i) => (
              <div
                key={i}
                className="group relative bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-4 md:p-8 hover:border-white/20 transition-all duration-300"
              >
                <div className="text-3xl md:text-5xl mb-3 md:mb-4 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-12">
                  {feature.icon}
                </div>
                <h3 className="text-lg md:text-xl font-light text-white mb-1 md:mb-2 tracking-wide">
                  {feature.title}
                </h3>
                <p className="text-xs md:text-sm font-light text-white/60 leading-relaxed">
                  {feature.desc}
                </p>
                <div className="absolute bottom-0 left-0 right-0 h-1 rounded-b-2xl overflow-hidden">
                  <div className="h-full bg-linear-to-r from-cyan-400 to-blue-600 transition-all duration-700 w-0 group-hover:w-full" />
                </div>
                {/* Pulse effect */}
                <div className="absolute inset-0 rounded-2xl bg-linear-to-br from-cyan-400/0 to-blue-600/0 group-hover:from-cyan-400/5 group-hover:to-blue-600/5 transition-all duration-500 animate-pulse" />
              </div>
            ))}
          </div>

          {/* CTA */}
          <div
            className={`text-center transition-all duration-700 delay-500 ${isAnimated ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"}`}
          >
            <Link
              href="https://fiexhaust.shop"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() =>
                trackEvent("cta_click", { store: "fi", location: "hero", label: "Обрати вихлоп" })
              }
              className="group inline-flex items-center gap-4 px-10 py-4 bg-white/10 border border-white/20 rounded-full text-white text-base font-light uppercase tracking-[0.25em] hover:bg-white/15 transition-all duration-300 relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              <span className="relative">Обрати вихлоп</span>
              <span className="relative text-xl transition-transform duration-300 group-hover:translate-x-1">
                →
              </span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Eventuri
  if (storeId === "eventuri") {
    return (
      <div
        className={`fixed inset-0 relative flex items-center justify-center pointer-events-none transition-all duration-1000 ${isVisible ? "opacity-100" : "opacity-0"}`}
      >
        {/* Background videos moved into 3D Canvas for premium composition */}
        <div className="absolute inset-0 -z-10 bg-linear-to-b from-black/85 via-black/80 to-black/95" />
        <div className="w-full max-w-6xl mx-auto px-4 md:px-8 pointer-events-auto">
          {/* Заголовок */}
          <div
            className={`text-center mb-4 md:mb-8 transition-all duration-1000 delay-200 ${isAnimated ? "translate-y-0 opacity-100" : "translate-y-20 opacity-0"}`}
          >
            <div className="flex justify-center mb-3 md:mb-4">
              <img
                src="/logos/eventuri.svg"
                alt="Eventuri Україна - карбонові впускні системи тюнінг Київ, купити Eventuri OneCompany"
                className="h-6 md:h-8 lg:h-10 w-auto opacity-90"
                loading="lazy"
              />
            </div>
            <div className="mb-3 md:mb-4">
              <span className="px-3 md:px-4 lg:px-6 py-1.5 md:py-2 rounded-full bg-linear-to-r from-purple-500 to-pink-600 bg-opacity-20 backdrop-blur-md border border-purple-500/30 text-xs md:text-sm font-medium text-purple-400 uppercase tracking-[0.15em] md:tracking-[0.2em] lg:tracking-[0.4em] shadow-2xl shadow-purple-500/30 inline-block">
                🏎️ 100% Carbon Fiber
              </span>
            </div>
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-extralight text-white mb-2 md:mb-3 tracking-tight leading-tight">
              Eventuri
              <span className="block text-xl md:text-2xl lg:text-3xl font-light text-white/80 mt-1">
                аеродинаміка і карбон
              </span>
            </h1>
            <p className="text-sm md:text-lg lg:text-xl font-light text-white/70 max-w-2xl mx-auto leading-relaxed mb-2 md:mb-3 px-4">
              Коли продуктивність зустрічає бездоганну якість. Ідеальна аеродинаміка. Реальна
              продуктивність. Карбонова естетика.
            </p>
            <div className="flex flex-col md:flex-row items-center justify-center gap-3 md:gap-8 text-purple-400 text-xs md:text-sm font-light">
              <div className="flex items-center gap-2">
                <div className="w-2 md:w-3 h-2 md:h-3 rounded-full bg-purple-500 animate-pulse shadow-lg shadow-purple-500/50" />
                <span className="tracking-wide">ІНЖЕНЕРНА АЕРОДИНАМІКА</span>
              </div>
              <div className="hidden md:block w-1 h-1 rounded-full bg-purple-500/50" />
              <div className="flex items-center gap-2">
                <div className="w-2 md:w-3 h-2 md:h-3 rounded-full bg-pink-500 animate-pulse shadow-lg shadow-pink-500/50" />
                <span className="tracking-wide">ТЕСТОВАНО НА ТРЕКУ</span>
              </div>
            </div>
          </div>

          {/* Features Grid - елегантний */}
          <div
            className={`grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-8 transition-all duration-1000 delay-500 ${isAnimated ? "translate-y-0 opacity-100" : "translate-y-20 opacity-0"}`}
          >
            {[
              { icon: "🌪️", title: "Аеродинаміка", desc: "Ідеальний потік повітря" },
              { icon: "💎", title: "Карбон", desc: "100% Carbon Fiber" },
              { icon: "📈", title: "Потужність", desc: "Гарантований приріст" },
              { icon: "🏁", title: "Track Proven", desc: "Випробовано на треках" },
            ].map((feature, i) => (
              <div
                key={i}
                className="group relative bg-black/60 backdrop-blur-xl border border-white/10 rounded-xl md:rounded-2xl p-4 md:p-6 hover:border-white/20 transition-all duration-300"
              >
                <div className="text-3xl md:text-4xl mb-2 md:mb-3 transition-transform duration-300 group-hover:scale-110">
                  {feature.icon}
                </div>
                <h3 className="text-sm md:text-lg font-light text-white mb-0.5 md:mb-1 tracking-wide">
                  {feature.title}
                </h3>
                <p className="text-xs font-light text-white/60 leading-relaxed">{feature.desc}</p>
                <div className="absolute bottom-0 left-0 right-0 h-1 rounded-b-xl md:rounded-b-2xl overflow-hidden">
                  <div className="h-full bg-linear-to-r from-purple-500 to-pink-600 transition-all duration-700 w-0 group-hover:w-full" />
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div
            className={`text-center transition-all duration-700 delay-500 ${isAnimated ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"}`}
          >
            <Link
              href="https://eventuri.shop"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() =>
                trackEvent("cta_click", {
                  store: "eventuri",
                  location: "hero",
                  label: "Обрати Eventuri",
                })
              }
              className="group inline-flex items-center gap-3 md:gap-4 px-6 md:px-10 py-3 md:py-4 bg-white/10 border border-white/20 rounded-full text-white text-sm md:text-base font-light uppercase tracking-[0.15em] md:tracking-[0.25em] hover:bg-white/15 transition-all duration-300"
            >
              <span>Обрати Eventuri</span>
              <span className="text-lg md:text-xl transition-transform duration-300 group-hover:translate-x-1">
                →
              </span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
