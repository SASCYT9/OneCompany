"use client";

import { useEffect, useState } from "react";

import { LayoutList, Rows3, StretchHorizontal } from "lucide-react";

import { cn } from "@/lib/utils";

export type AdminDensity = "compact" | "comfortable" | "spacious";

const STORAGE_KEY = "adminShopDensity";

export function useAdminDensity(initial: AdminDensity = "comfortable") {
  const [density, setDensity] = useState<AdminDensity>(initial);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "compact" || stored === "comfortable" || stored === "spacious") {
        setDensity(stored);
      }
    } catch {
      // localStorage may not be available (SSR or privacy mode); fall back.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, density);
    } catch {
      // ignore
    }
  }, [density, hydrated]);

  return { density, setDensity };
}

const OPTIONS: Array<{ value: AdminDensity; label: string; Icon: typeof Rows3 }> = [
  { value: "compact", label: "Компактний", Icon: Rows3 },
  { value: "comfortable", label: "Стандартний", Icon: LayoutList },
  { value: "spacious", label: "Просторий", Icon: StretchHorizontal },
];

export function AdminDensityToggle({
  value,
  onChange,
  className,
}: {
  value: AdminDensity;
  onChange: (next: AdminDensity) => void;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Щільність рядків"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-none border border-white/8 bg-black/30 p-0.5",
        className
      )}
    >
      {OPTIONS.map(({ value: optValue, label, Icon }) => {
        const isActive = value === optValue;
        return (
          <button
            key={optValue}
            type="button"
            role="radio"
            aria-checked={isActive}
            data-density={optValue}
            onClick={() => onChange(optValue)}
            title={label}
            className={cn(
              "inline-flex h-7 w-8 items-center justify-center rounded-none text-zinc-400 transition",
              isActive
                ? "bg-white/8 text-zinc-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                : "hover:bg-white/4 hover:text-zinc-200"
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="sr-only">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

export const DENSITY_ROW_PADDING: Record<AdminDensity, string> = {
  compact: "py-2",
  comfortable: "py-3.5",
  spacious: "py-5",
};

export const DENSITY_THUMB_SIZE: Record<AdminDensity, "sm" | "md" | "lg"> = {
  compact: "sm",
  comfortable: "md",
  spacious: "lg",
};
