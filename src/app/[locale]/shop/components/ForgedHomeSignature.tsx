"use client";

import Link from "next/link";
import type { SupportedLocale } from "@/lib/seo";
import type { ForgedDesign } from "@/data/forgedDesigns";

const HERO_IMAGE = "/forged/hero.jpg";

type Props = {
  locale: SupportedLocale;
  designs: ForgedDesign[];
};

function L(isUa: boolean, en: string, ua: string) {
  return isUa ? ua : en;
}

export default function ForgedHomeSignature({ locale, designs }: Props) {
  const isUa = locale === "ua";

  return (
    <div className="forged-home bg-background text-foreground">
      {/* Back to all stores */}
      <div className="px-6 pt-6 md:px-12 md:pt-10">
        <Link
          href={`/${locale}/shop`}
          className="text-xs uppercase tracking-[0.2em] text-white/50 transition hover:text-white"
        >
          ← {L(isUa, "All our stores", "Усі наші магазини")}
        </Link>
      </div>

      {/* Hero */}
      <section className="relative isolate overflow-hidden px-6 pb-24 pt-20 md:px-12 md:pb-32 md:pt-32">
        <div className="absolute inset-x-0 top-0 -z-10 h-[70vh] bg-[radial-gradient(ellipse_at_top,rgba(196,142,76,0.18),transparent_60%)]" />
        <div
          className="pointer-events-none absolute right-[-15%] top-[5%] -z-0 hidden h-[70vh] w-[70vh] bg-cover bg-center opacity-50 md:block"
          style={{
            backgroundImage: `url(${HERO_IMAGE})`,
            maskImage: "radial-gradient(circle at 50% 50%, rgba(0,0,0,1) 50%, rgba(0,0,0,0) 75%)",
            WebkitMaskImage:
              "radial-gradient(circle at 50% 50%, rgba(0,0,0,1) 50%, rgba(0,0,0,0) 75%)",
          }}
        />
        <div className="relative z-10 mx-auto max-w-5xl">
          <p className="mb-6 text-xs uppercase tracking-[0.32em] text-[#c48e4c]">
            {L(isUa, "One Company Forged", "One Company Forged")}
          </p>
          <h1 className="text-balance text-5xl font-light leading-[1.05] tracking-tight md:text-7xl">
            {L(
              isUa,
              "Forged wheels, made to order. Any design. Any size. Any material.",
              "Ковані диски на замовлення. Будь-який дизайн. Будь-який розмір. Будь-який матеріал."
            )}
          </h1>
          <p className="mt-8 max-w-2xl text-base leading-relaxed text-white/70 md:text-lg">
            {L(
              isUa,
              "Our forge in-house produces aluminium, magnesium and carbon-composite wheel sets to your specification. Pick a starting design from the catalog or describe your own. We render it on your car, you approve, we make it.",
              "Власне виробництво — кований алюміній, магнієвий сплав, карбон-композит. Оберіть стартовий дизайн з каталогу або опишіть свій. Ми покажемо як він виглядає на вашому авто, ви підтвердите, ми виготовимо."
            )}
          </p>

          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              href={`/${locale}/shop/forged/configurator`}
              className="inline-flex items-center justify-center rounded-full bg-[#c48e4c] px-8 py-4 text-sm font-medium uppercase tracking-[0.18em] text-[#08090b] transition hover:bg-[#d8a361]"
            >
              {L(isUa, "Open the configurator", "Відкрити конфігуратор")}
            </Link>
            <Link
              href={`/${locale}/shop/forged/products`}
              className="inline-flex items-center justify-center rounded-full border border-white/20 px-8 py-4 text-sm font-medium uppercase tracking-[0.18em] text-white transition hover:border-white/60"
            >
              {L(isUa, "Browse designs", "Каталог дизайнів")}
            </Link>
          </div>

          <dl className="mt-16 grid grid-cols-2 gap-8 border-t border-white/10 pt-12 md:grid-cols-4">
            <div>
              <dt className="text-xs uppercase tracking-[0.18em] text-white/40">
                {L(isUa, "Materials", "Матеріали")}
              </dt>
              <dd className="mt-2 text-lg text-white/90">Al · Mg · C</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.18em] text-white/40">
                {L(isUa, "Diameters", "Діаметри")}
              </dt>
              <dd className="mt-2 text-lg text-white/90">15″ – 24″</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.18em] text-white/40">
                {L(isUa, "Lead time", "Виробництво")}
              </dt>
              <dd className="mt-2 text-lg text-white/90">{L(isUa, "8–14 weeks", "8–14 тижнів")}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.18em] text-white/40">
                {L(isUa, "Designs", "Дизайнів")}
              </dt>
              <dd className="mt-2 text-lg text-white/90">{designs.length}+</dd>
            </div>
          </dl>
        </div>
      </section>

      {/* Designs preview strip */}
      <section className="border-t border-white/5 px-6 py-20 md:px-12 md:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 flex items-end justify-between gap-6">
            <h2 className="text-balance text-3xl font-light tracking-tight md:text-4xl">
              {L(isUa, "Starting points", "Стартові дизайни")}
            </h2>
            <Link
              href={`/${locale}/shop/forged/products`}
              className="text-xs uppercase tracking-[0.18em] text-white/50 transition hover:text-white"
            >
              {L(isUa, "All designs →", "Усі дизайни →")}
            </Link>
          </div>

          <ul className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {designs.slice(0, 3).map((d) => (
              <li key={d.slug}>
                <Link href={`/${locale}/shop/forged/products/${d.slug}`} className="group block">
                  <div className="relative aspect-square overflow-hidden rounded-2xl border border-white/10 bg-[#0c0d10]">
                    {/* Placeholder hero — real image lives at d.heroImage in /public/forged/designs/<slug>/hero.jpg */}
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
                      <p className="mt-1 text-xs text-white/50">
                        {L(isUa, "From", "Від")} €{d.basePriceEur}
                      </p>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Process strip */}
      <section className="border-t border-white/5 px-6 py-20 md:px-12 md:py-28">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-12 text-balance text-3xl font-light tracking-tight md:text-4xl">
            {L(isUa, "How it works", "Як це працює")}
          </h2>
          <ol className="grid gap-10 md:grid-cols-3">
            {[
              [
                L(isUa, "Configure", "Конфігурація"),
                L(
                  isUa,
                  "Pick a starting design, dial in the diameter, width, offset, material and finish. See it render in real time.",
                  "Оберіть дизайн, налаштуйте діаметр, ширину, виліт, матеріал і фініш. Спостерігайте за змінами в реальному часі."
                ),
              ],
              [
                L(isUa, "Preview on your car", "Примірка на ваше авто"),
                L(
                  isUa,
                  "Pick your model from our library or upload your own photo. Drag the wheel into place to confirm stance.",
                  "Оберіть свою модель з нашої бібліотеки або завантажте своє фото. Перетягніть диск у потрібну позицію."
                ),
              ],
              [
                L(isUa, "Quote & manufacture", "Прорахунок і виробництво"),
                L(
                  isUa,
                  "Submit. We verify the configuration with our engineering team and send a fixed quote within 24 hours, valid for 14 days.",
                  "Сабміт. Інженер перевіряє конфігурацію та надсилає фіксований прорахунок протягом 24 годин — дійсний 14 днів."
                ),
              ],
            ].map(([title, body], i) => (
              <li key={i} className="border-t border-white/10 pt-6">
                <p className="mb-3 text-xs font-mono uppercase tracking-[0.2em] text-[#c48e4c]">
                  0{i + 1}
                </p>
                <h3 className="text-xl text-white">{title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-white/60">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Footer band with legal link */}
      <section className="border-t border-white/5 px-6 py-16 md:px-12">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 text-xs uppercase tracking-[0.18em] text-white/40 md:flex-row md:items-center md:justify-between">
          <p>One Company Forged · Київ · {new Date().getFullYear()}</p>
          <Link href={`/${locale}/shop/forged/legal`} className="transition hover:text-white">
            {L(isUa, "Legal & replica policy", "Правила та політика реплік")}
          </Link>
        </div>
      </section>
    </div>
  );
}
