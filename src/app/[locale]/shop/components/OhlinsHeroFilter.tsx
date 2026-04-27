"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { SupportedLocale } from "@/lib/seo";
import type { OhlinsHeroVehicleMake } from "@/lib/ohlinsCatalog";

type Props = {
  locale: SupportedLocale;
  vehicles?: OhlinsHeroVehicleMake[];
};

export default function OhlinsHeroFilter({ locale, vehicles }: Props) {
  const data = vehicles ?? [];
  const isUa = locale === "ua";
  const router = useRouter();

  const [make, setMake] = useState<string>("");
  const [model, setModel] = useState<string>("");
  const [chassis, setChassis] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const models = useMemo(() => {
    if (!make) return [];
    return data.find((v) => v.make === make)?.models ?? [];
  }, [make, data]);

  const chassisCodes = useMemo(() => {
    if (!make || !model) return [];
    return models.find((m) => m.name === model)?.chassis ?? [];
  }, [models, make, model]);

  function buildHref() {
    const params = new URLSearchParams();
    if (make) params.set("make", make);
    // Catalog has no model/chassis facet, so route specifics through `q` (text search).
    // Chassis codes (G80, 992, F82) are unique → use them alone when present.
    // Model names with " / " (e.g. "M3 / M4") become two AND-required tokens in
    // the catalog tokenizer, so split and use the first variant only.
    let q = "";
    if (chassis) {
      q = chassis;
    } else if (model) {
      q = model.split(/\s*\/\s*/)[0];
    }
    if (q) params.set("q", q);
    const qs = params.toString();
    return qs
      ? `/${locale}/shop/ohlins/catalog?${qs}`
      : `/${locale}/shop/ohlins/catalog`;
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    router.push(buildHref());
  }

  function onMakeChange(v: string) {
    setMake(v);
    setModel("");
    setChassis("");
  }
  function onModelChange(v: string) {
    setModel(v);
    setChassis("");
  }

  return (
    <form className="oh-hero-filter" onSubmit={onSubmit} aria-label={isUa ? "Швидкий підбір" : "Quick finder"}>
      <div className="oh-hero-filter-eyebrow">
        <span className="oh-hero-filter-pulse" aria-hidden="true"></span>
        {isUa ? "швидкий підбір · понад 1000 sku" : "quick finder · 1000+ sku"}
      </div>

      <div className="oh-hero-filter-row">
        <div className="oh-hf-field">
          <label className="oh-hf-label" htmlFor="ohlins-hero-make">{isUa ? "Марка" : "Make"}</label>
          <select
            id="ohlins-hero-make"
            value={make}
            onChange={(e) => onMakeChange(e.target.value)}
            className="oh-hf-select"
          >
            <option value="">{isUa ? "Будь-яка" : "Any"}</option>
            {data.map((v) => (
              <option key={v.make} value={v.make}>{v.make}</option>
            ))}
          </select>
          <svg className="oh-hf-chev" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
        </div>

        <div className={`oh-hf-field ${!make ? 'is-disabled' : ''}`}>
          <label className="oh-hf-label" htmlFor="ohlins-hero-model">{isUa ? "Модель" : "Model"}</label>
          <select
            id="ohlins-hero-model"
            value={model}
            onChange={(e) => onModelChange(e.target.value)}
            className="oh-hf-select"
            disabled={!make}
            aria-disabled={!make}
          >
            <option value="">{!make ? (isUa ? "Спочатку марка" : "Pick make first") : (isUa ? "Будь-яка" : "Any")}</option>
            {models.map((m) => (
              <option key={m.name} value={m.name}>{m.name}</option>
            ))}
          </select>
          <svg className="oh-hf-chev" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
        </div>

        <div className={`oh-hf-field ${!model ? 'is-disabled' : ''}`}>
          <label className="oh-hf-label" htmlFor="ohlins-hero-chassis">{isUa ? "Кузов" : "Chassis"}</label>
          <select
            id="ohlins-hero-chassis"
            value={chassis}
            onChange={(e) => setChassis(e.target.value)}
            className="oh-hf-select"
            disabled={!model}
            aria-disabled={!model}
          >
            <option value="">{!model ? (isUa ? "Спочатку модель" : "Pick model first") : (isUa ? "Будь-який" : "Any")}</option>
            {chassisCodes.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <svg className="oh-hf-chev" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
        </div>

        <button
          type="submit"
          className="oh-hf-submit"
          disabled={submitting}
          aria-label={isUa ? "Підібрати підвіску" : "Find suspension"}
        >
          <span className="oh-hf-submit-text">
            {submitting
              ? (isUa ? "Шукаю…" : "Finding…")
              : (isUa ? "Підібрати" : "Find")}
          </span>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </button>
      </div>
    </form>
  );
}
