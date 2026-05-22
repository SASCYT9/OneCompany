"use client";

import Link from "next/link";
import type { SupportedLocale } from "@/lib/seo";
import type { ForgedDesign } from "@/data/forgedDesigns";

type Props = {
  locale: SupportedLocale;
  design: ForgedDesign;
};

function L(isUa: boolean, en: string, ua: string) {
  return isUa ? ua : en;
}

export default function ForgedDesignDetail({ locale, design }: Props) {
  const isUa = locale === "ua";
  const name = isUa ? design.nameUa : design.nameEn;
  const tagline = isUa ? design.taglineUa : design.taglineEn;

  return (
    <div className="forged-pdp bg-background text-foreground">
      <div className="px-6 pt-6 md:px-12 md:pt-10">
        <Link
          href={`/${locale}/shop/forged/products`}
          className="text-xs uppercase tracking-[0.2em] text-white/50 transition hover:text-white"
        >
          ← {L(isUa, "Back to catalog", "До каталогу")}
        </Link>
      </div>

      <article className="mx-auto grid max-w-6xl gap-12 px-6 py-16 md:grid-cols-[1.1fr,1fr] md:px-12 md:py-24">
        {/* Hero image */}
        <div className="relative aspect-square overflow-hidden rounded-3xl border border-white/10 bg-[#0c0d10]">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: `url(${design.heroImage})`,
              backgroundColor: "#1a1c20",
            }}
          />
          {design.isReplicaStyle && (
            <div className="absolute right-4 top-4 rounded-full bg-[#08090b]/70 px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-white/70 backdrop-blur">
              {L(isUa, "Replica-style design", "Дизайн-репродукція")}
            </div>
          )}
        </div>

        {/* Detail panel */}
        <div className="self-center">
          <p className="mb-4 text-xs uppercase tracking-[0.32em] text-[#c48e4c]">
            {design.family.replace(/-/g, " ")}
          </p>
          <h1 className="text-balance text-4xl font-light leading-[1.05] tracking-tight md:text-5xl">
            {name}
          </h1>
          <p className="mt-6 text-base leading-relaxed text-white/70 md:text-lg">{tagline}</p>

          <dl className="mt-10 grid grid-cols-2 gap-x-8 gap-y-6 border-t border-white/10 pt-8 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-[0.18em] text-white/40">
                {L(isUa, "From", "Від")}
              </dt>
              <dd className="mt-1 text-2xl text-white">€{design.basePriceEur}</dd>
              <p className="mt-1 text-xs text-white/40">
                {L(isUa, "for an 18″ aluminium set", "за 18″ алюмінієвий комплект")}
              </p>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.18em] text-white/40">
                {L(isUa, "Lead time", "Виробництво")}
              </dt>
              <dd className="mt-1 text-2xl text-white">
                {design.leadTimeWeeksAl}–{design.leadTimeWeeksAl + 3}
              </dd>
              <p className="mt-1 text-xs text-white/40">
                {L(isUa, "weeks (aluminium)", "тижнів (алюміній)")}
              </p>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.18em] text-white/40">
                {L(isUa, "Available materials", "Матеріали")}
              </dt>
              <dd className="mt-1 text-base text-white/80">Al · Mg · Carbon</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.18em] text-white/40">
                {L(isUa, "Diameter range", "Діаметри")}
              </dt>
              <dd className="mt-1 text-base text-white/80">15″ – 24″</dd>
            </div>
          </dl>

          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href={`/${locale}/shop/forged/configurator?design=${design.slug}`}
              className="inline-flex items-center justify-center rounded-full bg-[#c48e4c] px-8 py-4 text-sm font-medium uppercase tracking-[0.18em] text-[#08090b] transition hover:bg-[#d8a361]"
            >
              {L(isUa, "Configure your set", "Конфігурувати комплект")}
            </Link>
            <Link
              href={`/${locale}/shop/forged/legal`}
              className="inline-flex items-center justify-center rounded-full border border-white/15 px-6 py-4 text-xs font-medium uppercase tracking-[0.18em] text-white/60 transition hover:border-white/40 hover:text-white"
            >
              {L(isUa, "Legal", "Правила")}
            </Link>
          </div>

          <p className="mt-6 text-xs leading-relaxed text-white/40">
            {L(
              isUa,
              "Final price is confirmed by our engineering team after configuration is reviewed (within 24 hours). The estimate above is for a baseline 18″ aluminium gloss-black set; size, width, material and finish all affect price.",
              "Фінальна вартість підтверджується інженером після перегляду конфігурації (протягом 24 годин). Цифра вище — для базового 18″ алюмінієвого комплекту в gloss-чорному; розмір, ширина, матеріал і фініш впливають на ціну."
            )}
          </p>
        </div>
      </article>

      {/* Gallery strip */}
      {design.gallery.length > 0 && (
        <section className="border-t border-white/5 px-6 py-16 md:px-12 md:py-24">
          <div className="mx-auto max-w-6xl">
            <p className="mb-8 text-xs uppercase tracking-[0.18em] text-white/40">
              {L(isUa, "Gallery", "Галерея")}
            </p>
            <ul className="grid gap-4 md:grid-cols-3">
              {design.gallery.map((src, i) => (
                <li
                  key={i}
                  className="aspect-[4/3] overflow-hidden rounded-2xl border border-white/10 bg-[#0c0d10]"
                >
                  <div
                    className="h-full w-full bg-cover bg-center"
                    style={{ backgroundImage: `url(${src})`, backgroundColor: "#1a1c20" }}
                  />
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}
