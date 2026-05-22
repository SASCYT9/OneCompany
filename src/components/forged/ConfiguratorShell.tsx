"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { SupportedLocale } from "@/lib/seo";
import { useForgedConfig } from "./store";
import { validateQuoteRequest } from "@/lib/forged/configSchema";
import DesignPicker from "./DesignPicker";
import SizePanel from "./SizePanel";
import MaterialPanel from "./MaterialPanel";
import CarPreviewSwitcher from "./CarPreviewSwitcher";
import CustomerForm from "./CustomerForm";
import ConfigSummary from "./ConfigSummary";
import ConfiguratorPreview from "./ConfiguratorPreview";

type Props = {
  locale: SupportedLocale;
  initialDesignSlug?: string;
};

export default function ConfiguratorShell({ locale, initialDesignSlug }: Props) {
  const isUa = locale === "ua";
  const router = useRouter();
  const setDesign = useForgedConfig((s) => s.setDesign);
  const designChosen = useForgedConfig((s) => s.designChosen);
  const config = useForgedConfig((s) => s.config);
  const customerName = useForgedConfig((s) => s.customerName);
  const customerEmail = useForgedConfig((s) => s.customerEmail);
  const customerPhone = useForgedConfig((s) => s.customerPhone);
  const setSubmitting = useForgedConfig((s) => s.setSubmitting);
  const setSubmitError = useForgedConfig((s) => s.setSubmitError);
  const setSubmittedQuoteToken = useForgedConfig((s) => s.setSubmittedQuoteToken);
  const submitError = useForgedConfig((s) => s.submitError);

  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Hydrate design from URL param if not yet chosen
  useEffect(() => {
    if (initialDesignSlug && !designChosen) {
      setDesign(initialDesignSlug);
    }
  }, [initialDesignSlug, designChosen, setDesign]);

  async function onSubmit() {
    setValidationErrors([]);
    setSubmitError(null);

    const payload = {
      config,
      customer: {
        fullName: customerName,
        email: customerEmail,
        phone: customerPhone || undefined,
      },
      locale,
    };
    const errs = validateQuoteRequest(payload);
    if (errs.length > 0) {
      setValidationErrors(errs.map((e) => e.message));
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/shop/forged/quote-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      const j = (await res.json()) as { draftQuoteToken: string };
      setSubmittedQuoteToken(j.draftQuoteToken);
      setSubmitting(false);
      router.push(`/${locale}/shop/forged/quote/${j.draftQuoteToken}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Submit failed";
      setSubmitError(msg);
    }
  }

  return (
    <div className="bg-background text-foreground">
      <div className="px-6 pt-6 md:px-12 md:pt-10">
        <Link
          href={`/${locale}/shop/forged`}
          className="text-xs uppercase tracking-[0.2em] text-white/50 transition hover:text-white"
        >
          ← {isUa ? "Forged home" : "Forged home"}
        </Link>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-10 md:px-12 md:py-16">
        <div className="mb-10">
          <p className="mb-3 text-xs uppercase tracking-[0.32em] text-[#c48e4c]">
            {isUa ? "Конфігуратор" : "Configurator"}
          </p>
          <h1 className="text-balance text-3xl font-light leading-[1.1] tracking-tight md:text-5xl">
            {isUa ? "Зберіть свій комплект" : "Build your set"}
          </h1>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
          {/* Preview pane */}
          <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
            <ConfiguratorPreview locale={locale} />
            <ConfigSummary locale={locale} onSubmit={onSubmit} />
            {(validationErrors.length > 0 || submitError) && (
              <div className="rounded-lg border border-rose-400/30 bg-rose-400/5 p-4 text-xs text-rose-200">
                <p className="mb-2 uppercase tracking-[0.18em] text-rose-300/90">
                  {isUa ? "Виправте перед відправкою" : "Fix before submit"}
                </p>
                <ul className="list-disc space-y-1 pl-5">
                  {validationErrors.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                  {submitError && <li>{submitError}</li>}
                </ul>
              </div>
            )}
          </div>

          {/* Right column — panels */}
          <div className="space-y-10">
            <Section title={isUa ? "Дизайн" : "Design"}>
              <DesignPicker locale={locale} />
            </Section>
            <Section title={isUa ? "Розмір та посадка" : "Size & fitment"}>
              <SizePanel locale={locale} />
            </Section>
            <Section title={isUa ? "Матеріал" : "Material"}>
              <MaterialPanel locale={locale} />
            </Section>
            <Section title={isUa ? "Примірка на авто" : "Preview on car"}>
              <CarPreviewSwitcher locale={locale} />
            </Section>
            <Section title={isUa ? "Контакти" : "Contacts"}>
              <CustomerForm locale={locale} />
            </Section>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.015] p-6">
      <h2 className="mb-5 text-sm uppercase tracking-[0.18em] text-white/50">{title}</h2>
      {children}
    </section>
  );
}
