"use client";

import {
  DIAMETERS,
  PCDS,
  WIDTHS_J,
  ET_MIN,
  ET_MAX,
  CENTRE_BORES,
  type Diameter,
  type Pcd,
  type WidthJ,
  type CentreBore,
} from "@/lib/forged/configSchema";
import type { SupportedLocale } from "@/lib/seo";
import { useForgedConfig } from "./store";

type Props = { locale: SupportedLocale };

export default function SizePanel({ locale }: Props) {
  const isUa = locale === "ua";
  const config = useForgedConfig((s) => s.config);
  const setConfig = useForgedConfig((s) => s.setConfig);

  return (
    <div className="space-y-6">
      <Field label={isUa ? "Діаметр" : "Diameter"}>
        <ChipRow
          values={DIAMETERS}
          format={(v) => `${v}″`}
          active={config.diameter}
          onSelect={(v) => setConfig({ diameter: v as Diameter })}
        />
      </Field>

      <Field label={isUa ? "Ширина переду (J)" : "Front width (J)"}>
        <ChipRow
          values={WIDTHS_J}
          format={(v) => `${v}J`}
          active={config.widthFront}
          onSelect={(v) => setConfig({ widthFront: v as WidthJ })}
        />
      </Field>

      <Field label={isUa ? "Ширина заду (J)" : "Rear width (J)"}>
        <ChipRow
          values={WIDTHS_J}
          format={(v) => `${v}J`}
          active={config.widthRear}
          onSelect={(v) => setConfig({ widthRear: v as WidthJ })}
        />
      </Field>

      <Field label="PCD">
        <ChipRow
          values={PCDS}
          format={(v) => v}
          active={config.pcd}
          onSelect={(v) => setConfig({ pcd: v as Pcd })}
        />
      </Field>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label={isUa ? "ET переду" : "ET front"}>
          <NumberField
            value={config.etFront}
            min={ET_MIN}
            max={ET_MAX}
            onChange={(v) => setConfig({ etFront: v })}
          />
        </Field>
        <Field label={isUa ? "ET заду" : "ET rear"}>
          <NumberField
            value={config.etRear}
            min={ET_MIN}
            max={ET_MAX}
            onChange={(v) => setConfig({ etRear: v })}
          />
        </Field>
      </div>

      <Field label={isUa ? "Центральний отвір (мм)" : "Centre bore (mm)"}>
        <ChipRow
          values={[...CENTRE_BORES, "custom" as const]}
          format={(v) => (v === "custom" ? (isUa ? "інший" : "custom") : `${v}`)}
          active={config.centreBore}
          onSelect={(v) => setConfig({ centreBore: v as CentreBore })}
        />
        {config.centreBore === "custom" && (
          <div className="mt-3">
            <NumberField
              value={config.centreBoreCustom ?? 70}
              min={50}
              max={110}
              step={0.1}
              onChange={(v) => setConfig({ centreBoreCustom: v })}
            />
          </div>
        )}
      </Field>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs uppercase tracking-[0.18em] text-white/40">{label}</p>
      {children}
    </div>
  );
}

function ChipRow<T extends string | number>({
  values,
  format,
  active,
  onSelect,
}: {
  values: readonly T[];
  format: (v: T) => string;
  active: T | undefined;
  onSelect: (v: T) => void;
}) {
  return (
    <div className="-m-1 flex flex-wrap">
      {values.map((v) => {
        const isActive = v === active;
        return (
          <button
            key={String(v)}
            type="button"
            onClick={() => onSelect(v)}
            className={`m-1 rounded-full border px-3 py-1.5 text-xs transition ${
              isActive
                ? "border-[#c48e4c] bg-[#c48e4c]/15 text-[#c48e4c]"
                : "border-white/10 text-white/70 hover:border-white/30 hover:text-white"
            }`}
          >
            {format(v)}
          </button>
        );
      })}
    </div>
  );
}

function NumberField({
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => {
        const next = Number(e.target.value);
        if (Number.isFinite(next)) onChange(next);
      }}
      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-[#c48e4c]"
    />
  );
}
