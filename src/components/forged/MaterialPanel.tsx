"use client";

import { MATERIALS, type Material } from "@/lib/forged/configSchema";
import type { SupportedLocale } from "@/lib/seo";
import { useForgedConfig } from "./store";

type Props = { locale: SupportedLocale };

const COPY: Record<
  Material,
  { ua: { name: string; note: string }; en: { name: string; note: string } }
> = {
  aluminium: {
    ua: {
      name: "Кований алюміній 6061-T6",
      note: "Стандарт галузі. Найкраще співвідношення вартість/вага.",
    },
    en: {
      name: "Forged aluminium 6061-T6",
      note: "Industry standard. Best price-to-weight ratio.",
    },
  },
  magnesium: {
    ua: {
      name: "Магнієвий сплав",
      note: "На 30–40% легше за алюміній. Дорожчий, потребує спеціального покриття проти корозії.",
    },
    en: {
      name: "Magnesium alloy",
      note: "30–40% lighter than aluminium. More expensive, needs a corrosion coating.",
    },
  },
  carbon: {
    ua: {
      name: "Карбоно-композит",
      note: "Найлегший варіант, ультра-преміум сегмент. Лід-тайм збільшується на 4 тижні.",
    },
    en: {
      name: "Carbon composite",
      note: "Lightest option, ultra-premium tier. Lead time grows by 4 weeks.",
    },
  },
};

export default function MaterialPanel({ locale }: Props) {
  const isUa = locale === "ua";
  const material = useForgedConfig((s) => s.config.material);
  const setConfig = useForgedConfig((s) => s.setConfig);

  return (
    <div className="space-y-3">
      <p className="text-xs uppercase tracking-[0.18em] text-white/40">
        {isUa ? "Матеріал" : "Material"}
      </p>
      {MATERIALS.map((m) => {
        const isActive = m === material;
        const copy = COPY[m][isUa ? "ua" : "en"];
        return (
          <button
            key={m}
            type="button"
            onClick={() => setConfig({ material: m })}
            className={`block w-full rounded-xl border p-4 text-left transition ${
              isActive ? "border-[#c48e4c] bg-[#c48e4c]/8" : "border-white/10 hover:border-white/30"
            }`}
          >
            <p className={`text-sm ${isActive ? "text-[#c48e4c]" : "text-white/90"}`}>
              {copy.name}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-white/50">{copy.note}</p>
          </button>
        );
      })}
    </div>
  );
}
