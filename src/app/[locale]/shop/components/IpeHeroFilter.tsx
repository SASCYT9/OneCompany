"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { SupportedLocale } from "@/lib/seo";
import type { IpeHeroVehicleBrand } from "@/lib/ipeHeroCatalog";

type Props = {
  locale: SupportedLocale;
  vehicles?: IpeHeroVehicleBrand[];
};

export default function IpeHeroFilter({ locale, vehicles }: Props) {
  const data = vehicles ?? [];
  const isUa = locale === "ua";
  const router = useRouter();

  const [brandKey, setBrandKey] = useState("");
  const [modelLabel, setModelLabel] = useState("");
  const [lineKey, setLineKey] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const brand = useMemo(
    () => data.find((entry) => entry.key === brandKey),
    [data, brandKey]
  );

  const models = brand?.models ?? [];

  const lines = useMemo(() => {
    if (!brand) return [];
    if (modelLabel) {
      return brand.models.find((entry) => entry.label === modelLabel)?.lines ?? [];
    }
    return brand.lines;
  }, [brand, modelLabel]);

  function buildHref() {
    const params = new URLSearchParams();
    if (brandKey) params.set("brand", brandKey);
    if (modelLabel) params.set("model", modelLabel);
    if (lineKey) params.set("line", lineKey);
    const qs = params.toString();
    return qs
      ? `/${locale}/shop/ipe/collections?${qs}`
      : `/${locale}/shop/ipe/collections`;
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    router.push(buildHref());
  }

  function onBrandChange(value: string) {
    setBrandKey(value);
    setModelLabel("");
    setLineKey("");
  }

  function onModelChange(value: string) {
    setModelLabel(value);
    setLineKey("");
  }

  return (
    <form
      className="ipe-hf"
      onSubmit={onSubmit}
      aria-label={isUa ? "Швидкий підбір" : "Quick finder"}
    >
      <div className="ipe-hf__eyebrow">
        <span className="ipe-hf__pulse" aria-hidden="true" />
        {isUa ? "швидкий підбір · титановий вихлоп" : "quick finder · titanium exhaust"}
      </div>

      <div className="ipe-hf__row">
        <div className="ipe-hf__field">
          <label className="ipe-hf__label" htmlFor="ipe-hero-brand">
            {isUa ? "Марка" : "Make"}
          </label>
          <select
            id="ipe-hero-brand"
            value={brandKey}
            onChange={(event) => onBrandChange(event.target.value)}
            className="ipe-hf__select"
          >
            <option value="">{isUa ? "Будь-яка" : "Any"}</option>
            {data.map((entry) => (
              <option key={entry.key} value={entry.key}>
                {entry.label}
              </option>
            ))}
          </select>
          <svg
            className="ipe-hf__chev"
            viewBox="0 0 24 24"
            width="12"
            height="12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>

        <div className={`ipe-hf__field ${!brandKey ? "is-disabled" : ""}`}>
          <label className="ipe-hf__label" htmlFor="ipe-hero-model">
            {isUa ? "Модель" : "Model"}
          </label>
          <select
            id="ipe-hero-model"
            value={modelLabel}
            onChange={(event) => onModelChange(event.target.value)}
            className="ipe-hf__select"
            disabled={!brandKey || models.length === 0}
            aria-disabled={!brandKey || models.length === 0}
          >
            <option value="">
              {!brandKey
                ? isUa
                  ? "Спочатку марка"
                  : "Pick make first"
                : isUa
                  ? "Будь-яка"
                  : "Any"}
            </option>
            {models.map((entry) => (
              <option key={entry.label} value={entry.label}>
                {entry.label}
              </option>
            ))}
          </select>
          <svg
            className="ipe-hf__chev"
            viewBox="0 0 24 24"
            width="12"
            height="12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>

        <div className={`ipe-hf__field ${!brandKey ? "is-disabled" : ""}`}>
          <label className="ipe-hf__label" htmlFor="ipe-hero-line">
            {isUa ? "Продукція" : "Line"}
          </label>
          <select
            id="ipe-hero-line"
            value={lineKey}
            onChange={(event) => setLineKey(event.target.value)}
            className="ipe-hf__select"
            disabled={!brandKey || lines.length === 0}
            aria-disabled={!brandKey || lines.length === 0}
          >
            <option value="">
              {!brandKey
                ? isUa
                  ? "Спочатку марка"
                  : "Pick make first"
                : isUa
                  ? "Будь-яка"
                  : "Any"}
            </option>
            {lines.map((line) => (
              <option key={line} value={line}>
                {line}
              </option>
            ))}
          </select>
          <svg
            className="ipe-hf__chev"
            viewBox="0 0 24 24"
            width="12"
            height="12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>

        <button
          type="submit"
          className="ipe-hf__submit"
          disabled={submitting}
          aria-label={isUa ? "Підібрати вихлоп" : "Find exhaust"}
        >
          <span>
            {submitting
              ? isUa
                ? "Шукаю…"
                : "Finding…"
              : isUa
                ? "Підібрати"
                : "Find"}
          </span>
          <svg
            viewBox="0 0 24 24"
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </form>
  );
}
