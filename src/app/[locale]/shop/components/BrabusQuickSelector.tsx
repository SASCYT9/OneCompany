"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { SupportedLocale } from "@/lib/seo";
import BrabusVideoBackground from "./BrabusVideoBackground";

const BRANDS = [
  { key: "Mercedes", labelUa: "Mercedes-Benz", labelEn: "Mercedes-Benz", models: ["all", "G-Klasse", "S-Klasse", "GLE-Klasse", "GLS-Klasse", "V-Klasse", "AMG GT"] },
  { key: "Porsche", labelUa: "Porsche", labelEn: "Porsche", models: ["all", "Porsche 911 Turbo", "Porsche Taycan"] },
  { key: "Rolls-Royce", labelUa: "Rolls-Royce", labelEn: "Rolls-Royce", models: ["all", "Rolls-Royce Ghost", "Rolls-Royce Cullinan"] },
  { key: "Bentley", labelUa: "Bentley", labelEn: "Bentley", models: ["all", "Bentley Continental", "Bentley Flying Spur"] },
  { key: "Lamborghini", labelUa: "Lamborghini", labelEn: "Lamborghini", models: ["all", "Lamborghini Urus"] },
  { key: "Range Rover", labelUa: "Range Rover", labelEn: "Range Rover", models: ["all", "Range Rover"] },
  { key: "smart", labelUa: "smart", labelEn: "smart", models: ["all", "smart #1", "smart #3"] },
];

export default function BrabusQuickSelector({ locale }: { locale: SupportedLocale }) {
  const isUa = locale === "ua";
  const router = useRouter();
  const [selectedBrand, setSelectedBrand] = useState<string>("Mercedes");
  const [selectedModel, setSelectedModel] = useState<string>("all");

  const currentModels = useMemo(() => {
    return BRANDS.find(b => b.key === selectedBrand)?.models || ["all"];
  }, [selectedBrand]);

  const handleBrandChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedBrand(e.target.value);
    setSelectedModel("all");
  };

  const handleExplore = () => {
    let url = `/${locale}/shop/brabus/products?brand=${encodeURIComponent(selectedBrand)}`;
    if (selectedModel !== "all") {
      url += `&model=${encodeURIComponent(selectedModel)}`;
    }
    url += "#catalog";
    router.push(url);
  };

  return (
    <section className="relative min-h-[500px] flex items-center justify-center py-24 border-y border-white/[0.04] overflow-hidden z-20">
      {/* Background Video */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <BrabusVideoBackground 
          videoSrc="/videos/shop/brabus/brabus-hero-new.mp4"
          fallbackImage="/images/shop/brabus/hq/brabus-supercars-26.jpg" 
        />
        {/* Strong Blur Overlay for depth */}
        <div className="absolute inset-0 bg-black/75 backdrop-blur-[12px]" />
      </div>

      <div className="w-full max-w-[1200px] mx-auto px-6 text-center relative z-10">
        <h2 className="text-2xl md:text-3xl lg:text-4xl font-light text-white uppercase tracking-[0.15em] mb-4 drop-shadow-lg">
          {isUa ? "Знайдіть комплектуючі для свого автомобіля" : "Find upgrades for your vehicle"}
        </h2>
        <p className="text-sm md:text-base text-white/60 mb-12 max-w-2xl mx-auto font-light tracking-wide leading-relaxed drop-shadow-md">
          {isUa 
            ? "Оберіть марку та модель автомобіля, щоб миттєво перейти до всіх доступних преміальних компонентів тюнінгу Brabus у нашому каталозі." 
            : "Select your vehicle brand and model to instantly jump to all available premium Brabus tuning components in our catalog."}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-4xl mx-auto">
          {/* Brand Select */}
          <div className="relative w-full sm:flex-1 group">
            <select
              value={selectedBrand}
              onChange={handleBrandChange}
              className="w-full appearance-none bg-[#050505]/60 backdrop-blur-md border border-white/10 text-white px-6 py-4 lg:py-5 rounded-none outline-none focus:border-[#cc0000]/60 hover:bg-[#111]/80 transition-all cursor-pointer text-xs md:text-sm tracking-[0.1em] uppercase shadow-2xl"
            >
              {BRANDS.map(b => (
                <option key={b.key} value={b.key} className="bg-black">
                  {isUa ? b.labelUa : b.labelEn}
                </option>
              ))}
            </select>
            <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-white/30 group-hover:text-white/60 transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
            </div>
            <div className="absolute top-0 left-0 w-full h-[2px] bg-[#cc0000] scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
          </div>

          {/* Model Select */}
          <div className="relative w-full sm:flex-1 group">
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full appearance-none bg-[#050505]/60 backdrop-blur-md border border-white/10 text-white px-6 py-4 lg:py-5 rounded-none outline-none focus:border-[#cc0000]/60 hover:bg-[#111]/80 transition-all cursor-pointer text-xs md:text-sm tracking-[0.1em] uppercase shadow-2xl"
            >
              {currentModels.map(m => (
                <option key={m} value={m} className="bg-black">
                  {m === "all" ? (isUa ? "Всі моделі" : "All Models") : m}
                </option>
              ))}
            </select>
            <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-white/30 group-hover:text-white/60 transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
            </div>
            <div className="absolute top-0 left-0 w-full h-[2px] bg-[#cc0000] scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
          </div>

          {/* Button */}
          <button 
            onClick={handleExplore}
            className="w-full sm:w-auto px-10 py-4 lg:py-5 bg-[#cc0000] hover:bg-[#ff1a1a] text-white text-[11px] md:text-[13px] uppercase font-bold tracking-[0.2em] rounded-none transition-all shadow-[0_0_20px_rgba(204,0,0,0.3)] hover:shadow-[0_0_40px_rgba(204,0,0,0.5)] whitespace-nowrap"
          >
            {isUa ? "Показати каталог" : "Explore Catalog"}
          </button>
        </div>
      </div>
    </section>
  );
}
