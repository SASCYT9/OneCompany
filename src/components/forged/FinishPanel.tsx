"use client";

import { FINISHES, type Finish } from "@/lib/forged/configSchema";
import type { SupportedLocale } from "@/lib/seo";
import { useForgedConfig } from "./store";

type Props = { locale: SupportedLocale };

const FINISH_LABELS: Record<Finish, { ua: string; en: string }> = {
  gloss: { ua: "Глянець", en: "Gloss" },
  satin: { ua: "Сатин", en: "Satin" },
  matte: { ua: "Мат", en: "Matte" },
  brushed: { ua: "Шліфований", en: "Brushed" },
  "forged-clear": { ua: "Прозорий лак (forged)", en: "Forged-clear" },
  "two-tone": { ua: "Два тони", en: "Two-tone" },
};

const PRESET_COLORS = [
  "#0a0a0a",
  "#1c1c1c",
  "#2d2d2d",
  "#5a5a5a",
  "#bababa",
  "#dedede",
  "#c48e4c",
  "#7a4a1a",
  "#7a1f1f",
  "#1c3a5a",
  "#0d3a2a",
  "#3a3a8a",
];

export default function FinishPanel({ locale }: Props) {
  const isUa = locale === "ua";
  const config = useForgedConfig((s) => s.config);
  const setConfig = useForgedConfig((s) => s.setConfig);
  const showAccent = config.finish === "two-tone";

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-xs uppercase tracking-[0.18em] text-white/40">
          {isUa ? "Фініш" : "Finish"}
        </p>
        <div className="-m-1 flex flex-wrap">
          {FINISHES.map((f) => {
            const isActive = f === config.finish;
            return (
              <button
                key={f}
                type="button"
                onClick={() => setConfig({ finish: f })}
                className={`m-1 rounded-full border px-3 py-1.5 text-xs transition ${
                  isActive
                    ? "border-[#c48e4c] bg-[#c48e4c]/15 text-[#c48e4c]"
                    : "border-white/10 text-white/70 hover:border-white/30 hover:text-white"
                }`}
              >
                {FINISH_LABELS[f][isUa ? "ua" : "en"]}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs uppercase tracking-[0.18em] text-white/40">
          {isUa ? "Основний колір" : "Primary colour"}
        </p>
        <ColourSwatchRow
          value={config.primaryColor}
          onChange={(c) => setConfig({ primaryColor: c })}
        />
      </div>

      {showAccent && (
        <div>
          <p className="mb-2 text-xs uppercase tracking-[0.18em] text-white/40">
            {isUa ? "Акцентний колір" : "Accent colour"}
          </p>
          <ColourSwatchRow
            value={config.accentColor ?? "#c48e4c"}
            onChange={(c) => setConfig({ accentColor: c })}
          />
        </div>
      )}

      <div>
        <label className="flex items-center gap-3 text-sm text-white/80">
          <input
            type="checkbox"
            checked={config.ocMonogramEngraving}
            onChange={(e) => setConfig({ ocMonogramEngraving: e.target.checked })}
            className="h-4 w-4 accent-[#c48e4c]"
          />
          <span>
            {isUa
              ? "Гравіювати монограму OC на спиці"
              : "Engrave the OC monogram on the spoke face"}
          </span>
        </label>
      </div>
    </div>
  );
}

function ColourSwatchRow({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="-m-1 flex flex-wrap items-center">
      {PRESET_COLORS.map((c) => {
        const isActive = c.toLowerCase() === value.toLowerCase();
        return (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            aria-label={c}
            className={`m-1 h-8 w-8 rounded-full border transition ${
              isActive
                ? "border-[#c48e4c] ring-2 ring-[#c48e4c]/40"
                : "border-white/15 hover:border-white/40"
            }`}
            style={{ backgroundColor: c }}
          />
        );
      })}
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="ml-2 h-8 w-10 cursor-pointer rounded border border-white/15 bg-transparent"
      />
    </div>
  );
}
