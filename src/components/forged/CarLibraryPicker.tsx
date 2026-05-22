"use client";

import { useState } from "react";
import { CAR_LIBRARY } from "@/lib/forged/carLibrary";
import type { SupportedLocale } from "@/lib/seo";
import { useForgedConfig } from "./store";

type Props = { locale: SupportedLocale };

export default function CarLibraryPicker({ locale: _locale }: Props) {
  const slug = useForgedConfig((s) => s.config.carLibrarySlug);
  const setConfig = useForgedConfig((s) => s.setConfig);
  // Hide cards whose photo failed to load (asset not delivered yet).
  const [hiddenSlugs, setHiddenSlugs] = useState<Set<string>>(new Set());

  const visible = CAR_LIBRARY.filter((c) => !hiddenSlugs.has(c.slug));

  return (
    <div className="grid grid-cols-2 gap-2 border border-white/10 bg-white/[0.02] p-2 sm:grid-cols-3 lg:grid-cols-4">
      {visible.map((car) => {
        const isActive = car.slug === slug;
        return (
          <button
            key={car.slug}
            type="button"
            onClick={() => setConfig({ carLibrarySlug: car.slug })}
            className={`group relative aspect-[16/9] overflow-hidden border text-left transition ${
              isActive ? "border-[#c48e4c]" : "border-white/10 hover:border-white/30"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={car.photoUrl}
              alt=""
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover"
              onError={() =>
                setHiddenSlugs((prev) => {
                  const next = new Set(prev);
                  next.add(car.slug);
                  return next;
                })
              }
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#08090b] via-[#08090b]/80 to-transparent px-2 py-1.5">
              <p className="text-[10px] uppercase tracking-wider text-white/50">{car.make}</p>
              <p className="truncate text-xs text-white/90">{car.model}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
