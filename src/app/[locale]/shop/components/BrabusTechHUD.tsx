"use client";

import Image from "next/image";
import Link from "next/link";
import { type SupportedLocale } from "@/lib/seo";
import { BRABUS_HERO } from "../data/brabusHomeData";

type Props = {
  locale: SupportedLocale;
};

export default function BrabusTechHUD({ locale }: Props) {
  const isUa = locale === "ua";

  return (
    <section className="dark relative w-full h-[95vh] min-h-[700px] bg-black text-white overflow-hidden">
      {/* Full-Width Background Photo */}
      <div className="absolute inset-0">
        <Image
          src={BRABUS_HERO.heroImageUrl}
          alt="Brabus G-Wagon"
          fill
          priority
          className="object-cover object-center lg:object-[center_20%]"
          sizes="100vw"
        />
      </div>

      {/* Dark cinematic overlay — left-heavy gradient for text readability */}
      <div className="absolute inset-0 bg-linear-to-r from-black/90 via-black/50 to-transparent" />
      <div className="absolute inset-0 bg-linear-to-t from-black via-transparent to-transparent opacity-80" />

      {/* Top Left Fake Header Logo (just for perfect visual match to the concept image if needed, or simply empty if global nav handles it) */}
      <div className="absolute top-12 left-8 md:left-16 lg:left-24 font-bold text-2xl tracking-widest uppercase">
        BRABUS<span className="text-[10px] align-super">&reg;</span>
      </div>

      {/* Left-Aligned Content */}
      <div className="absolute inset-0 flex flex-col justify-center px-8 md:px-16 lg:px-24 max-w-4xl pt-24">
        <h1 className="text-6xl md:text-8xl lg:text-[100px] font-bold uppercase leading-none tracking-tight mb-6">
          {isUa ? "За межами" : "Beyond"}
          <br />
          {isUa ? "досконалості" : "Perfection"}
        </h1>

        <p className="text-lg md:text-xl font-normal text-white/80 max-w-xl mb-12 uppercase tracking-wide leading-relaxed">
          {isUa ? (
            <>
              Безкомпромісна продуктивність
              <br />
              для Brabus G-Wagon
            </>
          ) : (
            <>
              Uncompromising performance
              <br />
              for the Brabus G-Wagon
            </>
          )}
        </p>

        <Link
          href={`/${locale}/shop/brabus/collections`}
          className="inline-flex flex-col items-center justify-center border border-[#c29d59]/40 bg-white/5 backdrop-blur-xl text-white px-6 py-3 text-xs md:text-sm font-medium uppercase tracking-[0.25em] hover:bg-[#c29d59]/15 hover:border-[#c29d59]/70 hover:shadow-[0_0_30px_rgba(194,157,89,0.15)] transition-all duration-500 w-fit group"
        >
          {isUa ? "Дослідити G-Wagon" : "Explore the G-Wagon"}
        </Link>
      </div>
    </section>
  );
}
