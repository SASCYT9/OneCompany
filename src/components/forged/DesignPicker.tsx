"use client";

import type { SupportedLocale } from "@/lib/seo";
import { getForgedDesigns } from "@/lib/forged/catalog";
import { getForgedDesignVisual } from "@/data/forgedDesigns";
import { useForgedConfig } from "./store";

type Props = { locale: SupportedLocale };

export default function DesignPicker({ locale }: Props) {
  const isUa = locale === "ua";
  const designs = getForgedDesigns();
  const designSlug = useForgedConfig((s) => s.config.designSlug);
  const material = useForgedConfig((s) => s.config.material);
  const setDesign = useForgedConfig((s) => s.setDesign);

  return (
    <div>
      <p className="mb-3 text-xs uppercase tracking-[0.18em] text-white/40">
        {isUa ? "Дизайн" : "Design"}
      </p>
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {designs.map((d) => {
          const active = d.slug === designSlug;
          const visual = getForgedDesignVisual(d, material);
          return (
            <li key={d.slug}>
              <button
                type="button"
                onClick={() => setDesign(d.slug)}
                className={`group relative aspect-square w-full overflow-hidden rounded-xl border text-left transition ${
                  active
                    ? "border-[#c48e4c] ring-2 ring-[#c48e4c]/40"
                    : "border-white/10 hover:border-white/30"
                }`}
              >
                <div
                  className="absolute inset-0 bg-cover bg-center"
                  style={{
                    backgroundImage: `url(${visual.heroImage})`,
                    backgroundColor: "#1a1c20",
                  }}
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#08090b] via-[#08090b]/70 to-transparent p-3">
                  <p className="truncate text-xs text-white/90">{isUa ? d.nameUa : d.nameEn}</p>
                  <p className="text-[10px] text-white/50">
                    {isUa ? "Від" : "From"} €{d.basePriceEur}
                  </p>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
