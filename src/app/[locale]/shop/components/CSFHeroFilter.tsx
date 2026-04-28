"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { SupportedLocale } from "@/lib/seo";
import type { CsfHeroSummary } from "@/lib/csfHeroCatalog";

type Props = {
  locale: SupportedLocale;
  summary?: CsfHeroSummary;
};

export default function CSFHeroFilter({ locale, summary }: Props) {
  const totalProducts = summary?.totalProducts ?? 0;
  const data = summary?.makes ?? [];
  const isUa = locale === "ua";
  const router = useRouter();

  const [makeKey, setMakeKey] = useState("");
  const [modelLabel, setModelLabel] = useState("");
  const [categoryKey, setCategoryKey] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const make = useMemo(
    () => data.find((entry) => entry.key === makeKey),
    [data, makeKey]
  );

  const models = make?.models ?? [];
  const model = useMemo(
    () => models.find((entry) => entry.label === modelLabel),
    [models, modelLabel]
  );

  const categories = useMemo(() => {
    if (!make) return [];
    if (model) return model.categories;
    return make.categories;
  }, [make, model]);

  const liveCount = useMemo(() => {
    if (categoryKey) {
      const entry = categories.find((cat) => cat.key === categoryKey);
      return entry?.count ?? 0;
    }
    if (model) return model.count;
    if (make) return make.count;
    return totalProducts;
  }, [categories, categoryKey, model, make, totalProducts]);

  function buildHref() {
    const params = new URLSearchParams();
    if (makeKey) params.set("make", makeKey);
    if (modelLabel) params.set("model", modelLabel);
    if (categoryKey) params.set("category", categoryKey);
    const qs = params.toString();
    return qs
      ? `/${locale}/shop/csf/collections?${qs}`
      : `/${locale}/shop/csf/collections`;
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    router.push(buildHref());
  }

  function onMakeChange(value: string) {
    setMakeKey(value);
    setModelLabel("");
    setCategoryKey("");
  }

  function onModelChange(value: string) {
    setModelLabel(value);
    setCategoryKey("");
  }

  return (
    <form
      className="csf-hf"
      onSubmit={onSubmit}
      aria-label={isUa ? "Швидкий підбір CSF" : "CSF quick finder"}
    >
      <header className="csf-hf__head">
        <div className="csf-hf__brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/shop/csf/checkered-flag.svg"
            alt=""
            className="csf-hf__brand-flag"
            aria-hidden="true"
          />
          <div className="csf-hf__brand-text">
            <span className="csf-hf__brand-eyebrow">CSF Racing</span>
            <span className="csf-hf__brand-line">
              {isUa ? "підбір системи охолодження" : "find your cooling system"}
            </span>
          </div>
        </div>
        <div className="csf-hf__counter" aria-live="polite">
          <span className="csf-hf__counter-num">{liveCount.toLocaleString("en-US")}</span>
          <span className="csf-hf__counter-label">
            {isUa ? "товарів у наявності" : liveCount === 1 ? "match available" : "matches available"}
          </span>
        </div>
      </header>

      <div className="csf-hf__row">
        <Field
          index="01"
          label={isUa ? "Марка" : "Make"}
          isActive={!!makeKey}
        >
          <select
            id="csf-hero-make"
            value={makeKey}
            onChange={(event) => onMakeChange(event.target.value)}
            className="csf-hf__select"
          >
            <option value="">{isUa ? "Будь-яка" : "Any"}</option>
            {data.map((entry) => (
              <option key={entry.key} value={entry.key}>
                {entry.label} · {entry.count}
              </option>
            ))}
          </select>
        </Field>

        <Field
          index="02"
          label={isUa ? "Модель" : "Model"}
          isActive={!!modelLabel}
          isDisabled={!makeKey}
        >
          <select
            id="csf-hero-model"
            value={modelLabel}
            onChange={(event) => onModelChange(event.target.value)}
            className="csf-hf__select"
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
              <option key={entry.label} value={entry.label}>
                {entry.label} · {entry.count}
              </option>
            ))}
          </select>
        </Field>

        <Field
          index="03"
          label={isUa ? "Категорія" : "Category"}
          isActive={!!categoryKey}
          isDisabled={!makeKey}
        >
          <select
            id="csf-hero-category"
            value={categoryKey}
            onChange={(event) => setCategoryKey(event.target.value)}
            className="csf-hf__select"
            disabled={!makeKey || categories.length === 0}
            aria-disabled={!makeKey || categories.length === 0}
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
            {categories.map((category) => (
              <option key={category.key} value={category.key}>
                {(isUa ? category.labelUa : category.labelEn)} · {category.count}
              </option>
            ))}
          </select>
        </Field>

        <button
          type="submit"
          className="csf-hf__submit"
          disabled={submitting || liveCount === 0}
          aria-label={isUa ? "Підібрати охолодження" : "Find cooling"}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/shop/csf/checkered-flag.svg"
            alt=""
            className="csf-hf__submit-flag"
            aria-hidden="true"
          />
          <span className="csf-hf__submit-text">
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
            strokeWidth="2.4"
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

type FieldProps = {
  index: string;
  label: string;
  isActive: boolean;
  isDisabled?: boolean;
  children: React.ReactNode;
};

function Field({ index, label, isActive, isDisabled, children }: FieldProps) {
  return (
    <div
      className={`csf-hf__field ${isActive ? "is-active" : ""} ${
        isDisabled ? "is-disabled" : ""
      }`}
    >
      <div className="csf-hf__field-head">
        <span className="csf-hf__field-index">{index}</span>
        <span className="csf-hf__field-label">{label}</span>
      </div>
      <div className="csf-hf__field-body">
        {children}
        <svg
          className="csf-hf__chev"
          viewBox="0 0 24 24"
          width="11"
          height="11"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>
    </div>
  );
}
