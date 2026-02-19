"use client";

import Image from "next/image";
import Link from "next/link";
import { trackEvent } from "@/lib/analytics";

type Brand = {
  id: "kw" | "fi" | "eventuri";
  name: string;
  logo: string;
  url: string;
  blurb: string;
};

const brands: Brand[] = [
  {
    id: "kw",
    name: "KW Suspension",
    logo: "/logos/kw-official.png",
    url: "https://kwsuspension.shop/",
    blurb: "Німецька точність керованості від вулиці до треку.",
  },
  {
    id: "fi",
    name: "Fi Exhaust",
    logo: "/logos/fi.svg",
    url: "https://fiexhaust.shop/",
    blurb: "Титанові вихлопні системи з фірмовим тембром.",
  },
  {
    id: "eventuri",
    name: "Eventuri",
    logo: "/logos/eventuri.svg",
    url: "https://eventuri.shop/",
    blurb: "Карбонові впуски з патентованою аеродинамікою.",
  },
];

export function BrandsGrid() {
  return (
    <div className="pointer-events-auto">
      <div className="text-center mb-10">
        <h3 className="text-5xl md:text-6xl font-extralight text-white mb-3 tracking-tight">
          Магазини партнери
        </h3>
        <p className="text-white/60 font-light text-lg max-w-2xl mx-auto">
          Три експертні напрями. Оригінальні продукти. Професійна підтримка.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {brands.map((b) => (
          <Link
            key={b.id}
            href={b.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackEvent("cta_click", { store: b.id, location: "brands-grid", label: "open_store" })}
            className="group block rounded-2xl border border-white/10 bg-black/60 backdrop-blur-xl p-8 transition-colors duration-300 hover:border-white/20"
          >
            <div className="flex items-center gap-4 mb-6">
              <Image src={b.logo} alt={b.name} width={120} height={40} className="h-8 w-auto opacity-90" />
            </div>
            <h4 className="text-2xl font-light text-white mb-2 tracking-wide">{b.name}</h4>
            <p className="text-sm text-white/60 font-light mb-8">{b.blurb}</p>
            <div className="flex items-center gap-3 text-white/80">
              <span className="uppercase tracking-[0.25em] text-xs">Відкрити</span>
              <span className="text-xl transition-transform duration-300 group-hover:translate-x-1">→</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
