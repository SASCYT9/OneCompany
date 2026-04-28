"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { SupportedLocale } from "@/lib/seo";
import type { AdroHeroVehicleMake } from "@/lib/adroCatalog";

type Props = {
  locale: SupportedLocale;
  vehicles?: AdroHeroVehicleMake[];
};

export default function AdroHeroFilter({ locale, vehicles }: Props) {
  const data = vehicles ?? [];
  const isUa = locale === "ua";
  const router = useRouter();

  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [categoryKey, setCategoryKey] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const models = useMemo(() => {
    if (!make) return [];
    return data.find((v) => v.make === make)?.models ?? [];
  }, [data, make]);

  const categories = useMemo(() => {
    if (!make || !model) return [];
    return models.find((m) => m.name === model)?.categories ?? [];
  }, [model, models, make]);

  function buildHref() {
    const params = new URLSearchParams();
    if (make) params.set("make", make);
    if (model) params.set("model", model);
    if (categoryKey) params.set("category", categoryKey);
    const qs = params.toString();
    return qs
      ? `/${locale}/shop/adro/collections?${qs}`
      : `/${locale}/shop/adro/collections`;
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    router.push(buildHref());
  }

  function onMakeChange(value: string) {
    setMake(value);
    setModel("");
    setCategoryKey("");
  }

  function onModelChange(value: string) {
    setModel(value);
    setCategoryKey("");
  }

  return (
    <form
      className="adro__hf"
      onSubmit={onSubmit}
      aria-label={isUa ? "Швидкий підбір" : "Quick finder"}
    >
      <div className="adro__hf-eyebrow">
        <span className="adro__hf-pulse" aria-hidden="true" />
        {isUa ? "швидкий підбір · карбоновий аерокіт" : "quick finder · carbon aero"}
      </div>

      <div className="adro__hf-row">
        <div className="adro__hf-field">
          <label className="adro__hf-label" htmlFor="adro-hero-make">
            {isUa ? "Марка" : "Make"}
          </label>
          <select
            id="adro-hero-make"
            value={make}
            onChange={(event) => onMakeChange(event.target.value)}
            className="adro__hf-select"
          >
            <option value="">{isUa ? "Будь-яка" : "Any"}</option>
            {data.map((entry) => (
              <option key={entry.make} value={entry.make}>
                {entry.make}
              </option>
            ))}
          </select>
          <svg
            className="adro__hf-chev"
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

        <div className={`adro__hf-field ${!make ? "is-disabled" : ""}`}>
          <label className="adro__hf-label" htmlFor="adro-hero-model">
            {isUa ? "Модель" : "Model"}
          </label>
          <select
            id="adro-hero-model"
            value={model}
            onChange={(event) => onModelChange(event.target.value)}
            className="adro__hf-select"
            disabled={!make}
            aria-disabled={!make}
          >
            <option value="">
              {!make
                ? isUa
                  ? "Спочатку марка"
                  : "Pick make first"
                : isUa
                  ? "Будь-яка"
                  : "Any"}
            </option>
            {models.map((entry) => (
              <option key={entry.name} value={entry.name}>
                {entry.name}
              </option>
            ))}
          </select>
          <svg
            className="adro__hf-chev"
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

        <div className={`adro__hf-field ${!model ? "is-disabled" : ""}`}>
          <label className="adro__hf-label" htmlFor="adro-hero-category">
            {isUa ? "Категорія" : "Category"}
          </label>
          <select
            id="adro-hero-category"
            value={categoryKey}
            onChange={(event) => setCategoryKey(event.target.value)}
            className="adro__hf-select"
            disabled={!model}
            aria-disabled={!model}
          >
            <option value="">
              {!model
                ? isUa
                  ? "Спочатку модель"
                  : "Pick model first"
                : isUa
                  ? "Будь-яка"
                  : "Any"}
            </option>
            {categories.map((category) => (
              <option key={category.key} value={category.key}>
                {isUa ? category.labelUa : category.labelEn}
              </option>
            ))}
          </select>
          <svg
            className="adro__hf-chev"
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
          className="adro__hf-submit"
          disabled={submitting}
          aria-label={isUa ? "Підібрати аерокіт" : "Find aero kit"}
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
