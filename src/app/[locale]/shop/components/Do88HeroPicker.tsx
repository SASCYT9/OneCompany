"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Do88Listbox, { type FilterGroup } from "../do88/Do88Listbox";
import { CAR_DATA } from "../do88/do88FitmentData";

type Make = keyof typeof CAR_DATA;

const FEATURED_BRAND: Make = "Porsche";
const FEATURED_MODEL = "911 Carrera";
const FEATURED_CHASSIS = "992";

type Props = { locale: string };

export default function Do88HeroPicker({ locale }: Props) {
  const isUa = locale === "ua";
  const router = useRouter();
  const searchParams = useSearchParams();

  // Pre-fill from URL when present, otherwise default to featured Porsche 911 Carrera 992
  const [brand, setBrand] = useState<Make | "">(() => {
    const fromUrl = searchParams?.get("brand") as Make | null;
    if (fromUrl) return fromUrl;
    return FEATURED_BRAND;
  });
  const [model, setModel] = useState<string>(() => {
    const fromUrl = searchParams?.get("model");
    if (fromUrl !== null && fromUrl !== undefined) return fromUrl;
    return searchParams?.get("brand") ? "" : FEATURED_MODEL;
  });
  const [chassis, setChassis] = useState<string>(() => {
    const fromUrl = searchParams?.get("chassis");
    if (fromUrl !== null && fromUrl !== undefined) return fromUrl;
    return searchParams?.get("brand") ? "" : FEATURED_CHASSIS;
  });

  // Sync from URL on back/forward / external nav
  useEffect(() => {
    const urlBrand = (searchParams?.get("brand") as Make | null) ?? "";
    const urlModel = searchParams?.get("model") ?? "";
    const urlChassis = searchParams?.get("chassis") ?? "";
    if (urlBrand || urlModel || urlChassis) {
      setBrand(urlBrand);
      setModel(urlModel);
      setChassis(urlChassis);
    }
  }, [searchParams]);

  const brandGroups = useMemo<FilterGroup[]>(
    () => [
      {
        options: Object.keys(CAR_DATA).map((b) => ({ value: b, label: b })),
      },
    ],
    []
  );

  const modelGroups = useMemo<FilterGroup[]>(
    () =>
      brand
        ? [
            {
              label: brand,
              options: Array.from(new Set(CAR_DATA[brand].map((entry) => entry.model))).map(
                (m) => ({ value: m, label: m })
              ),
            },
          ]
        : [],
    [brand]
  );

  const chassisGroups = useMemo<FilterGroup[]>(
    () =>
      brand && model
        ? [
            {
              label: model,
              options: CAR_DATA[brand]
                .filter((entry) => entry.model === model)
                .map((entry) => ({ value: entry.chassis, label: entry.chassis })),
            },
          ]
        : [],
    [brand, model]
  );

  const hasAnySelection = Boolean(brand || model || chassis);

  function onBrandChange(value: string) {
    setBrand(value as Make | "");
    setModel("");
    setChassis("");
  }

  function onModelChange(value: string) {
    setModel(value);
    setChassis("");
  }

  function onChassisChange(value: string) {
    setChassis(value);
  }

  function onSubmit() {
    const params = new URLSearchParams();
    if (brand) params.set("brand", brand);
    if (model) params.set("model", model);
    if (chassis) params.set("chassis", chassis);
    const q = params.toString();
    router.push(`/${locale}/shop/do88/collections/all${q ? `?${q}` : ""}`);
  }

  function onReset() {
    setBrand("");
    setModel("");
    setChassis("");
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="do88-glass-panel do88-filter-container relative z-20 w-full max-w-5xl mx-auto overflow-visible do88-animate-up text-left p-6 md:p-8"
      style={{ animationDelay: "0.1s" }}
    >
      {/* Header */}
      <div className="mb-7 flex flex-col items-center text-center">
        <p className="text-[10px] uppercase tracking-[0.3em] text-white/65 mb-2">
          {isUa ? "Підбір по авто" : "Vehicle finder"}
        </p>
        <h2 className="text-xl md:text-2xl font-light tracking-[0.12em] text-white uppercase">
          {isUa ? "Знайдіть свій автомобіль" : "Find your vehicle"}
        </h2>
      </div>

      {/* 3 cascading dropdowns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Do88Listbox
          label={isUa ? "Марка" : "Brand"}
          placeholder={isUa ? "Оберіть марку" : "Select brand"}
          value={brand}
          onChange={onBrandChange}
          groups={brandGroups}
          clearLabel={isUa ? "Усі марки" : "All brands"}
          clearValue=""
        />
        <Do88Listbox
          label={isUa ? "Модель" : "Model"}
          placeholder={isUa ? "Оберіть модель" : "Select model"}
          disabledPlaceholder={isUa ? "Спершу оберіть марку" : "Select brand first"}
          value={model}
          onChange={onModelChange}
          groups={modelGroups}
          clearLabel={isUa ? "Усі моделі" : "All models"}
          clearValue=""
          disabled={!brand}
        />
        <Do88Listbox
          label={isUa ? "Кузов" : "Chassis"}
          placeholder={isUa ? "Оберіть кузов" : "Select chassis"}
          disabledPlaceholder={isUa ? "Спершу оберіть модель" : "Select model first"}
          value={chassis}
          onChange={onChassisChange}
          groups={chassisGroups}
          clearLabel={isUa ? "Усі кузови" : "All chassis"}
          clearValue=""
          disabled={!brand || !model}
        />
      </div>

      {/* Selection summary + actions */}
      <div className="flex flex-col gap-4 border-t border-white/12 pt-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2 text-[11px] tracking-[0.04em] text-white/65">
          <span className="uppercase tracking-[0.2em] text-white/45">
            {isUa ? "Вибір" : "Selection"}
          </span>
          <span aria-hidden="true" className="text-white/30">
            ·
          </span>
          <span className="text-white">
            {brand || (isUa ? "не обрано" : "not selected")}
            {model ? <span className="text-white/75"> · {model}</span> : null}
            {chassis ? <span className="text-white/55"> · {chassis}</span> : null}
          </span>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <button
            type="button"
            onClick={onReset}
            disabled={!hasAnySelection}
            className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/4 px-5 py-2.5 text-[11px] uppercase tracking-[0.18em] text-white/75 transition-all duration-200 hover:border-white/35 hover:bg-white/8 hover:text-white disabled:opacity-30 disabled:hover:border-white/15 disabled:hover:bg-white/4 disabled:hover:text-white/75"
          >
            {isUa ? "Скинути" : "Reset"}
          </button>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-7 py-3 text-[12px] font-semibold uppercase tracking-[0.18em] text-black shadow-[0_8px_24px_-8px_rgba(255,255,255,0.35)] transition-all duration-200 hover:bg-white/90 hover:shadow-[0_12px_32px_-6px_rgba(255,255,255,0.45)] active:scale-[0.98]"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.2}
              className="w-4 h-4"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" strokeLinecap="round" />
            </svg>
            {isUa ? "Перейти до підбору" : "Browse parts"}
          </button>
        </div>
      </div>
    </form>
  );
}
