"use client";

import { PALETTES, type PaletteId } from "./palettes";

type Props = {
  value: PaletteId;
  onChange: (next: PaletteId) => void;
  compact?: boolean;
};

export default function PaletteSwitcher({ value, onChange, compact = false }: Props) {
  return (
    <div className="palette-switcher" role="tablist" aria-label="Palette switcher">
      {PALETTES.map((p) => (
        <button
          key={p.id}
          role="tab"
          type="button"
          aria-selected={p.id === value}
          onClick={() => onChange(p.id)}
          className="palette-switcher__btn"
          data-active={p.id === value}
          title={p.short}
        >
          {compact ? p.name.split(" ")[0] : p.name}
        </button>
      ))}
    </div>
  );
}
