"use client";

import Link from "next/link";
import type { SupportedLocale } from "@/lib/seo";
import type { ForgedDesign } from "@/data/forgedDesigns";

type Props = {
  locale: SupportedLocale;
  designs: ForgedDesign[];
};

function L(isUa: boolean, en: string, ua: string) {
  return isUa ? ua : en;
}

export default function ForgedDesignGrid({ locale, designs }: Props) {
  const isUa = locale === "ua";
  return (
    <div className="forged-products bg-background text-foreground">
      <div className="px-6 pt-6 md:px-12 md:pt-10">
        <Link
          href={`/${locale}/shop/forged`}
          className="text-xs uppercase tracking-[0.2em] text-white/50 transition hover:text-white"
        >
          ← {L(isUa, "Forged home", "До головної Forged")}
        </Link>
      </div>

      <header className="mx-auto max-w-6xl px-6 pb-16 pt-12 md:px-12 md:pb-24 md:pt-16">
        <p className="mb-4 text-xs uppercase tracking-[0.32em] text-[#c48e4c]">
          {L(isUa, "Catalog", "Каталог")}
        </p>
        <h1 className="text-balance text-4xl font-light leading-[1.05] tracking-tight md:text-6xl">
          {L(isUa, "Starting designs", "Стартові дизайни")}
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-white/70 md:text-lg">
          {L(
            isUa,
            "Each design is a configurable platform — pick the silhouette you like, then dial in size, material, finish and colour in the configurator.",
            "Кожен дизайн — конфігурована основа. Оберіть силует, далі в конфігураторі задайте розмір, матеріал, фініш і колір."
          )}
        </p>
      </header>

      <section className="px-6 pb-24 md:px-12 md:pb-32">
        <ul className="mx-auto grid max-w-6xl gap-8 md:grid-cols-2 lg:grid-cols-3">
          {designs.map((d) => (
            <li key={d.slug}>
              <Link href={`/${locale}/shop/forged/products/${d.slug}`} className="group block">
                <div className="relative aspect-square overflow-hidden rounded-2xl border border-white/10 bg-[#0c0d10]">
                  <div
                    className="absolute inset-0 bg-cover bg-center transition duration-700 group-hover:scale-[1.04]"
                    style={{
                      backgroundImage: `url(${d.heroImage})`,
                      backgroundColor: "#1a1c20",
                    }}
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#08090b] via-[#08090b]/70 to-transparent p-6">
                    <p className="text-xs uppercase tracking-[0.18em] text-[#c48e4c]">
                      {d.family.replace(/-/g, " ")}
                    </p>
                    <p className="mt-2 text-xl text-white">{isUa ? d.nameUa : d.nameEn}</p>
                    <div className="mt-3 flex items-center justify-between text-xs text-white/50">
                      <span>
                        {L(isUa, "From", "Від")} €{d.basePriceEur}
                      </span>
                      <span>
                        {d.leadTimeWeeksAl}
                        {L(isUa, "w", "т")}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
