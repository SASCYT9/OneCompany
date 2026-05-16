"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { CompatibleVehicle } from "../do88/do88FitmentData";

type Do88CompatibleVehiclesBlockProps = {
  vehicles: CompatibleVehicle[];
  locale: string;
  isUa: boolean;
};

type StoredPreference = {
  brand?: string;
  model?: string;
  chassis?: string;
};

/**
 * "Сумісні моделі" panel on the Do88 PDP. Client component so it can read
 * `do88VehiclePreference` from sessionStorage (set by Do88VehicleFilter when
 * the user picks a make/model/chassis in the catalog) and:
 *
 *   • Re-order the chips so the user's pick is first, not whichever brand
 *     happens to be alphabetically primary in the data. Coming in from a
 *     "VW Golf Mk7" filter and seeing "AUDI" leading the compatibility list
 *     reads as "wrong product" even though it's just multi-fit info.
 *   • Tag the matching chip ("✓ ваш вибір" / "✓ your pick") so the user
 *     instantly recognises it as the selected platform; the rest read as
 *     "also fits".
 *
 * Falls back to the unsorted list (no badge) when there's no preference —
 * e.g. user landed on the PDP via deep-link, search, or direct URL.
 */
export function Do88CompatibleVehiclesBlock({
  vehicles,
  locale,
  isUa,
}: Do88CompatibleVehiclesBlockProps) {
  const [preference, setPreference] = useState<StoredPreference | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.sessionStorage.getItem("do88VehiclePreference");
      if (!raw) return;
      const parsed = JSON.parse(raw) as StoredPreference;
      if (parsed && (parsed.brand || parsed.model || parsed.chassis)) {
        setPreference(parsed);
      }
    } catch {
      // bad JSON or storage blocked — ignore, render unsorted.
    }
  }, []);

  const { ordered, matchKey } = useMemo(() => {
    if (!preference) return { ordered: vehicles, matchKey: null as string | null };
    const matchIdx = vehicles.findIndex(
      (v) =>
        (!preference.brand || v.make === preference.brand) &&
        (!preference.model || v.model === preference.model) &&
        (!preference.chassis || v.chassis === preference.chassis)
    );
    if (matchIdx <= 0) {
      // not found, or already first → no reorder
      const key = matchIdx === 0 ? keyOf(vehicles[0]) : null;
      return { ordered: vehicles, matchKey: key };
    }
    const reordered = [vehicles[matchIdx], ...vehicles.filter((_, i) => i !== matchIdx)];
    return { ordered: reordered, matchKey: keyOf(vehicles[matchIdx]) };
  }, [vehicles, preference]);

  if (vehicles.length === 0) return null;

  return (
    <section
      aria-label={isUa ? "Сумісні моделі" : "Fits these vehicles"}
      className="rounded-2xl border border-foreground/12 bg-card p-5 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.08)] dark:bg-black/40 dark:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.5)]"
    >
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.22em] text-foreground/65 dark:text-foreground/55">
        {isUa ? "Сумісні моделі" : "Fits these vehicles"}
      </h3>
      <ul className="mt-3 flex flex-wrap gap-2">
        {ordered.map((v) => {
          const key = keyOf(v);
          const isMatch = matchKey === key;
          const qs = new URLSearchParams({
            brand: v.make,
            model: v.model,
            chassis: v.chassis,
          }).toString();
          return (
            <li key={key}>
              <Link
                href={`/${locale}/shop/do88/collections/all?${qs}`}
                className={
                  isMatch
                    ? "inline-flex items-center gap-1.5 rounded-full border border-[hsl(var(--primary))]/40 bg-[hsl(var(--primary))]/10 px-3.5 py-1.5 text-[11px] font-medium text-foreground transition hover:border-[hsl(var(--primary))]/65 hover:bg-[hsl(var(--primary))]/15"
                    : "inline-flex items-center gap-1.5 rounded-full border border-foreground/15 bg-foreground/[0.04] px-3.5 py-1.5 text-[11px] font-medium text-foreground/85 transition hover:border-foreground/35 hover:bg-foreground/[0.08] dark:border-white/12 dark:bg-white/[0.04] dark:text-foreground/80 dark:hover:border-white/30 dark:hover:bg-white/[0.07]"
                }
              >
                {isMatch ? (
                  <span aria-hidden className="text-[10px] leading-none text-[hsl(var(--primary))]">
                    ✓
                  </span>
                ) : null}
                <span className="font-semibold text-foreground">{v.make}</span>
                <span>{v.model}</span>
                <span className="text-foreground/55">({v.chassis})</span>
              </Link>
            </li>
          );
        })}
      </ul>
      {matchKey ? (
        <p className="mt-2.5 text-[10px] uppercase tracking-[0.18em] text-foreground/55">
          {isUa ? "✓ — ваш фільтр • решта — також сумісні" : "✓ — your filter • others also fit"}
        </p>
      ) : null}
    </section>
  );
}

function keyOf(v: CompatibleVehicle) {
  return `${v.make}|${v.model}|${v.chassis}`;
}
