"use client";

import { X } from "lucide-react";

import { cn } from "@/lib/utils";

export type FilterChip = {
  id: string;
  label: string;
  value: string;
  /** Called when the user clicks the chip's "X". */
  onRemove: () => void;
  /** If set, chip uses this hex for tint (border + dot). */
  tintHex?: string;
};

export function AdminFilterChips({
  chips,
  onClearAll,
  className,
}: {
  chips: FilterChip[];
  onClearAll?: () => void;
  className?: string;
}) {
  if (chips.length === 0) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-none border border-white/5 bg-[#141414] px-3 py-2",
        className
      )}
      role="region"
      aria-label="Активні фільтри"
    >
      <span className="pl-1 pr-1 text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
        Фільтри
      </span>
      {chips.map((chip) => (
        <button
          key={chip.id}
          type="button"
          onClick={chip.onRemove}
          data-chip={chip.id}
          className={cn(
            "group inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[12px] font-medium transition",
            "hover:bg-white/6"
          )}
          style={
            chip.tintHex
              ? {
                  borderColor: `${chip.tintHex}66`,
                  background: `${chip.tintHex}15`,
                  color: chip.tintHex,
                }
              : {
                  borderColor: "rgba(255,255,255,0.08)",
                  background: "rgba(255,255,255,0.04)",
                  color: "rgb(228, 228, 231)",
                }
          }
          aria-label={`Видалити фільтр ${chip.label}: ${chip.value}`}
        >
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-70">
            {chip.label}
          </span>
          <span className="font-medium">{chip.value}</span>
          <X className="h-3 w-3 opacity-60 transition group-hover:opacity-100" aria-hidden="true" />
        </button>
      ))}
      {onClearAll ? (
        <button
          type="button"
          onClick={onClearAll}
          className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-white/8 bg-transparent px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-zinc-400 transition hover:border-white/20 hover:bg-white/4 hover:text-zinc-200"
          aria-label="Очистити всі активні фільтри"
        >
          Очистити всі
        </button>
      ) : null}
    </div>
  );
}
