"use client";

import { estimateFromConfig, priceBreakdownEur } from "@/lib/forged/pricing";
import { formatLeadTime, leadTimeFromConfig } from "@/lib/forged/leadTime";
import { findForgedDesign } from "@/data/forgedDesigns";
import type { SupportedLocale } from "@/lib/seo";
import { useForgedConfig } from "./store";

type Props = {
  locale: SupportedLocale;
  /** When true, renders submit CTA + replica acknowledgement. */
  showSubmit?: boolean;
  onSubmit?: () => void;
};

export default function ConfigSummary({ locale, showSubmit = true, onSubmit }: Props) {
  const isUa = locale === "ua";
  const config = useForgedConfig((s) => s.config);
  const submitting = useForgedConfig((s) => s.submitting);
  const consent = config.replicaConsent;
  const design = findForgedDesign(config.designSlug);

  const priceEur = estimateFromConfig(config);
  const lead = leadTimeFromConfig(config);
  const breakdown = priceBreakdownEur(config);

  const canSubmit = !!consent?.acceptedAt && !submitting;

  return (
    <aside className="rounded-2xl border border-white/10 bg-[#0c0d10] p-6">
      <p className="text-xs uppercase tracking-[0.18em] text-white/40">
        {isUa ? "Орієнтовно" : "Estimate"}
      </p>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-3xl font-light text-white">
          {priceEur ? `€${priceEur.toLocaleString("en-US")}` : "—"}
        </span>
        <span className="text-xs text-white/50">{isUa ? "/ комплект" : "/ set"}</span>
      </div>

      {lead && (
        <p className="mt-1 text-xs text-white/50">
          {isUa ? "Виробництво: " : "Lead time: "}
          {formatLeadTime(lead, locale)}
        </p>
      )}

      <details className="mt-4 text-xs text-white/60">
        <summary className="cursor-pointer text-white/50 transition hover:text-white">
          {isUa ? "Як рахується ціна" : "How the price is built"}
        </summary>
        <ul className="mt-3 space-y-1.5">
          {breakdown.map((row, i) => (
            <li key={i} className="flex items-baseline justify-between gap-3">
              <span className="text-white/50">{row.label}</span>
              <span className="font-mono text-white/80">
                {row.valueEur > 0
                  ? `+€${row.valueEur}`
                  : row.valueEur < 0
                    ? `-€${Math.abs(row.valueEur)}`
                    : "—"}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 leading-relaxed text-white/40">
          {isUa
            ? "Це орієнтовна базова вартість для типового розміру. Складність дизайну, ширина, особливі кольори або стаггер сильніший за стандартний можуть впливати. Точну вартість підтвердить інженер."
            : "Starting estimate for a typical size. Design complexity, width, special colours or staggered fitments can move the number. The final figure is confirmed by an engineer."}
        </p>
      </details>

      {design?.isReplicaStyle && showSubmit && <ReplicaConsentRow locale={locale} />}

      {showSubmit && (
        <div className="mt-6 space-y-2">
          <button
            type="button"
            disabled={!canSubmit}
            onClick={onSubmit}
            className={`block w-full rounded-full px-6 py-4 text-sm font-medium uppercase tracking-[0.18em] transition ${
              canSubmit
                ? "bg-[#c48e4c] text-[#08090b] hover:bg-[#d8a361]"
                : "cursor-not-allowed bg-white/5 text-white/30"
            }`}
          >
            {submitting
              ? isUa
                ? "Надсилаю…"
                : "Submitting…"
              : isUa
                ? "Запросити прорахунок"
                : "Request a quote"}
          </button>
          {!consent?.acceptedAt && design?.isReplicaStyle && (
            <p className="text-center text-xs text-white/40">
              {isUa
                ? "Підтвердіть умови нижче, щоб надіслати"
                : "Accept the terms below to enable submit"}
            </p>
          )}
        </div>
      )}
    </aside>
  );
}

function ReplicaConsentRow({ locale }: { locale: SupportedLocale }) {
  const isUa = locale === "ua";
  const consent = useForgedConfig((s) => s.config.replicaConsent);
  const accept = useForgedConfig((s) => s.acceptReplicaConsent);
  const clear = useForgedConfig((s) => s.clearReplicaConsent);
  const accepted = !!consent?.acceptedAt;

  return (
    <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-lg border border-white/10 bg-white/[0.02] p-3 text-xs leading-relaxed text-white/70">
      <input
        type="checkbox"
        checked={accepted}
        onChange={(e) => (e.target.checked ? accept() : clear())}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[#c48e4c]"
      />
      <span>
        {isUa ? (
          <>
            Я розумію, що замовляю кастомний комплект кованих дисків One Company Forged. Якщо
            обраний дизайн — репродукція існуючого силуету, на дисках буде логотип One Company
            Forged, не оригінального бренду. Це не контрафактний продукт.{" "}
            <a
              href={`/${locale}/shop/forged/legal`}
              target="_blank"
              rel="noreferrer"
              className="underline transition hover:text-white"
            >
              Детальніше
            </a>
            .
          </>
        ) : (
          <>
            I understand I am ordering a custom-made set of One Company Forged wheels. If the chosen
            design is a reproduction of an existing silhouette, the wheels carry the One Company
            Forged logo, not the original brand&apos;s. This is not a counterfeit product.{" "}
            <a
              href={`/${locale}/shop/forged/legal`}
              target="_blank"
              rel="noreferrer"
              className="underline transition hover:text-white"
            >
              Read more
            </a>
            .
          </>
        )}
      </span>
    </label>
  );
}
