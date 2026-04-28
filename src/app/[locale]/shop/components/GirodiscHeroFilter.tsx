"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { SupportedLocale } from "@/lib/seo";
import type { GirodiscHeroVehicleMake } from "@/lib/girodiscHeroCatalog";

type Props = {
  locale: SupportedLocale;
  vehicles?: GirodiscHeroVehicleMake[];
};

export default function GirodiscHeroFilter({ locale, vehicles }: Props) {
  const data = vehicles ?? [];
  const isUa = locale === "ua";
  const router = useRouter();

  const [makeKey, setMakeKey] = useState("");
  const [modelKey, setModelKey] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const models = useMemo(() => {
    if (!makeKey) return [];
    return data.find((entry) => entry.key === makeKey)?.models ?? [];
  }, [data, makeKey]);

  function buildHref() {
    const params = new URLSearchParams();
    if (makeKey) params.set("make", makeKey);
    if (modelKey) params.set("model", modelKey);
    const qs = params.toString();
    return qs
      ? `/${locale}/shop/girodisc/catalog?${qs}`
      : `/${locale}/shop/girodisc/catalog`;
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    router.push(buildHref());
  }

  function onMakeChange(value: string) {
    setMakeKey(value);
    setModelKey("");
  }

  return (
    <form
      className="gd__hf"
      onSubmit={onSubmit}
      aria-label={isUa ? "Швидкий підбір" : "Quick finder"}
    >
      <div className="gd__hf-eyebrow">
        <span className="gd__hf-pulse" aria-hidden="true" />
        {isUa ? "швидкий підбір · точний фітмент" : "quick finder · exact fitment"}
      </div>

      <div className="gd__hf-row">
        <div className="gd__hf-field">
          <label className="gd__hf-label" htmlFor="gd-hero-make">
            {isUa ? "Марка" : "Make"}
          </label>
          <select
            id="gd-hero-make"
            value={makeKey}
            onChange={(event) => onMakeChange(event.target.value)}
            className="gd__hf-select"
          >
            <option value="">{isUa ? "Будь-яка" : "Any"}</option>
            {data.map((entry) => (
              <option key={entry.key} value={entry.key}>
                {entry.label}
              </option>
            ))}
          </select>
          <svg
            className="gd__hf-chev"
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

        <div className={`gd__hf-field ${!makeKey ? "is-disabled" : ""}`}>
          <label className="gd__hf-label" htmlFor="gd-hero-model">
            {isUa ? "Модель" : "Model"}
          </label>
          <select
            id="gd-hero-model"
            value={modelKey}
            onChange={(event) => setModelKey(event.target.value)}
            className="gd__hf-select"
            disabled={!makeKey || models.length === 0}
            aria-disabled={!makeKey || models.length === 0}
          >
            <option value="">
              {!makeKey
                ? isUa
                  ? "Спочатку марка"
                  : "Pick make first"
                : isUa
                  ? "Будь-яка"
                  : "Any"}
            </option>
            {models.map((entry) => (
              <option key={entry.key} value={entry.key}>
                {entry.label}
              </option>
            ))}
          </select>
          <svg
            className="gd__hf-chev"
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
          className="gd__hf-submit"
          disabled={submitting}
          aria-label={isUa ? "Підібрати гальма" : "Find brakes"}
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
