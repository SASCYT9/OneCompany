import Link from "next/link";
import Image from "next/image";
import clsx from "clsx";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { StickyScroll } from "@/components/StickyScroll";
import { getTypography, resolveLocale } from "@/lib/typography";

export { generateMetadata } from "./metadata";

// ISR: cache rendered HTML for 1 hour. Public content, no per-user data on server.
export const dynamic = "force-static";
export const revalidate = 3600;

type ExperienceSplit = {
  label: string;
  title: string;
  description: string;
  href: string;
  accent: string;
  bgImageDark: string;
  bgImageLight: string;
  stats: { value: string; note: string }[];
};

type LocalizedHomePageProps = {
  params: Promise<{ locale: string }>;
};

export default async function LocalizedHomePage({ params }: LocalizedHomePageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");
  const resolvedLocale = resolveLocale(locale);
  const typography = getTypography(resolvedLocale);

  const experiences: ExperienceSplit[] = [
    {
      label: t("automotive"),
      title: t("hypercarPrograms"),
      description: t("hypercarDescription"),
      href: `/${locale}/auto`,
      accent: "from-amber-400/20 via-orange-500/10 to-transparent",
      bgImageDark: "/images/hero-auto-dark.png",
      bgImageLight: "/images/hero-auto-light.png",
      stats: [
        { value: "160+", note: t("autoBrands") },
        { value: "11", note: t("autoCategories") },
      ],
    },
    {
      label: t("moto"),
      title: t("factoryRacePackages"),
      description: t("factoryRaceDescription"),
      href: `/${locale}/moto`,
      accent: "from-blue-400/25 via-purple-500/15 to-transparent",
      bgImageDark: "/images/hero-moto-dark.png",
      bgImageLight: "/images/hero-moto-light.png",
      stats: [
        { value: "60+", note: t("motoPartners") },
        { value: "6", note: t("motoSeries") },
      ],
    },
  ];

  const heroBadgeCopy = t("badge");

  const carouselItems = [
    {
      id: "brands",
      title: locale === "ua" ? "200+ брендів" : "200+ brands",
      description:
        locale === "ua"
          ? "Ми працюємо виключно з провідними світовими виробниками авто та мото тюнінгу."
          : "We work exclusively with leading manufacturers of auto and moto tuning.",
      meta:
        locale === "ua" ? "Гарантія якості та автентичності" : "Quality and authenticity guarantee",
    },
    {
      id: "sourcing",
      title: locale === "ua" ? "Індивідуальний підбір" : "Bespoke selection",
      description:
        locale === "ua"
          ? "Аналізуємо проєкт, перевіряємо сумісність та надаємо рекомендації."
          : "We analyze the project, check compatibility and provide recommendations.",
      meta:
        locale === "ua"
          ? "Перевірка VIN та підтвердження сумісності"
          : "VIN check and compatibility confirmation",
    },
    {
      id: "logistics",
      title: locale === "ua" ? "Глобальна доставка" : "Global delivery",
      description:
        locale === "ua"
          ? "Доставляємо клієнтам по всьому світу. Оптимальні та гнучкі умови."
          : "We deliver to clients worldwide. Optimal and flexible conditions.",
      meta:
        locale === "ua"
          ? "One Company Global · Надійність та безпека"
          : "One Company Global · Reliability and safety",
    },
    {
      id: "experience",
      title: locale === "ua" ? "18 років досвіду" : "18 years experience",
      description:
        locale === "ua"
          ? "Формуємо культуру преміум тюнінгу та забезпечуємо безкомпромісну підтримку."
          : "We create the culture of premium tuning and provide uncompromising support.",
      meta: locale === "ua" ? "Офіційні програми з 2007 року" : "Official programs since 2007",
    },
    {
      id: "authenticity",
      title: locale === "ua" ? "Автентичність" : "Authenticity",
      description:
        locale === "ua"
          ? "Тільки оригінальна продукція з повною документацією та гарантією від виробника."
          : "Only genuine products with full documentation and manufacturer warranty.",
      meta: locale === "ua" ? "Без посередників" : "No intermediaries",
    },
  ];

  const b2bServices = [
    {
      title: t("wholesaleTitle"),
      copy: t("wholesaleDescription"),
    },
    {
      title: t("logisticsTitle"),
      copy: t("logisticsDescription"),
    },
  ];

  const structureLinks = [
    `/${locale}`,
    `/${locale}/shop`,
    `/${locale}/auto`,
    `/${locale}/moto`,
    `/${locale}/brands`,
    `/${locale}/brands/moto`,
    `/${locale}/brands/europe`,
    `/${locale}/brands/usa`,
    `/${locale}/brands/oem`,
    `/${locale}/brands/racing`,
    `/${locale}/blog`,
    `/${locale}/categories`,
    `/${locale}/choice`,
    `/${locale}/contact`,
    `/${locale}/about`,
    `/${locale}/partnership`,
  ];

  return (
    <>
      <main className="text-foreground">
        {/* Hero — photo cards swap dark/light variants per theme. Each variant
            has matching gradient overlay so the label pill + stats read
            correctly. Text uses semantic tokens so it inverts with theme. */}
        <section className="relative flex min-h-[70vh] flex-col justify-center pt-8 text-foreground">
          <div
            className={`px-4 pt-24 text-center uppercase tracking-[0.4em] text-foreground/55 sm:px-6 md:pt-36 sm:tracking-[0.5em] ${typography.heroBadge}`}
          >
            <p>{heroBadgeCopy}</p>
          </div>

          {/* SEO H1 - visually hidden but accessible */}
          <h1 className="sr-only">
            {locale === "ua"
              ? "One Company Global — Тюнінг Авто та Мото Київ, Україна. Офіційний дистриб'ютор Akrapovic, Brabus, Eventuri, HRE, KW, Ohlins. Преміум тюнінг Київ."
              : "One Company Global — Premium Auto & Moto Tuning Ukraine. Official distributor of Akrapovic, Brabus, Eventuri, HRE, KW, Ohlins in Kyiv."}
          </h1>

          <div className="relative isolate flex flex-1 flex-col gap-3 px-4 pb-4 pt-4 sm:gap-4 sm:px-6 sm:pb-6 sm:pt-6 md:flex-row md:gap-4 md:px-8 max-w-[1400px] mx-auto w-full">
            <div className="relative flex flex-1 flex-col gap-4 md:flex-row md:gap-4">
              {experiences.map((experience, index) => (
                <Link
                  key={experience.label}
                  href={experience.href}
                  className={clsx(
                    "group relative flex flex-1 min-h-[280px] flex-col justify-between gap-4 overflow-hidden p-4 text-left text-foreground sm:min-h-[320px] sm:gap-6 sm:p-5",
                    "border border-foreground/10 shadow-[0_20px_50px_rgba(0,0,0,0.18)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.3)] transition-all duration-500 hover:border-foreground/30 hover:shadow-[0_30px_60px_rgba(0,0,0,0.25)] dark:hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)]",
                    "rounded-2xl",
                    index === 0 ? "md:mr-2" : "md:ml-2"
                  )}
                >
                  {/* Photos swap per theme. Tailwind v4's dark:opacity-X
                      variant doesn't apply consistently with this version
                      of @custom-variant, so we use display swap instead. */}
                  <Image
                    src={experience.bgImageDark}
                    alt={
                      experience.label === "AUTO" || experience.label === "АВТО"
                        ? "Преміум авто тюнінг Київ - Akrapovic, Brabus, Eventuri, HRE wheels Україна"
                        : "Мото тюнінг Україна - Akrapovic, Ohlins, Termignoni, SC-Project Київ"
                    }
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-700 hidden dark:block"
                    sizes="(max-width: 768px) 100vw, 50vw"
                    priority
                    fetchPriority="high"
                    quality={85}
                  />
                  <Image
                    src={experience.bgImageLight}
                    alt=""
                    aria-hidden="true"
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-700 dark:hidden"
                    sizes="(max-width: 768px) 100vw, 50vw"
                    priority
                    fetchPriority="high"
                    quality={85}
                  />
                  {/* Bottom-only gradient veil — keeps photo unobstructed in
                      the upper 2/3, darkens the lower 1/3 so the description,
                      stats and arrow CTA all read as light text on dark.
                      Photo composition (car middle, ground bottom) means the
                      gradient lands on the floor area, not the car. */}
                  <div className="absolute inset-x-0 bottom-0 h-2/3 bg-linear-to-t from-black/85 via-black/55 to-transparent" />

                  {/* Top — small label pill, stays out of photo focus */}
                  <div className="relative flex justify-start">
                    <span
                      className={`inline-block font-display rounded-full border border-white/40 bg-black/40 backdrop-blur-md px-5 py-2 tracking-[0.3em] text-white shadow-[0_4px_16px_rgba(0,0,0,0.3)] transition-all duration-300 group-hover:bg-white group-hover:text-black group-hover:border-white sm:px-6 sm:py-2.5 sm:tracking-[0.35em] ${typography.label}`}
                    >
                      {experience.label}
                    </span>
                  </div>

                  {/* Bottom — description + stats + arrow stacked over the dark veil */}
                  <div className="relative flex flex-col gap-4 mt-auto">
                    <p
                      className={`leading-relaxed text-white/90 text-pretty tracking-wide max-w-md ${typography.bodySmall}`}
                    >
                      {experience.description}
                    </p>
                    <div className="flex w-full items-end justify-between gap-2 sm:gap-4">
                      <div className="flex flex-wrap gap-3 sm:gap-5">
                        {experience.stats.map((stat) => (
                          <div key={stat.note}>
                            <p
                              className={`font-display tracking-tight text-white ${typography.statValue}`}
                            >
                              {stat.value}
                            </p>
                            <p
                              className={`uppercase tracking-[0.2em] text-white/65 sm:tracking-[0.3em] ${typography.statLabel}`}
                            >
                              {stat.note}
                            </p>
                          </div>
                        ))}
                      </div>
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/40 bg-black/40 backdrop-blur-md text-sm text-white transition-all duration-500 group-hover:scale-110 group-hover:border-white group-hover:bg-white group-hover:text-black sm:h-12 sm:w-12">
                        →
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <StickyScroll items={carouselItems} />

        {/* Hidden for now - duplicates hero cards functionality
      <section id="expert-programs" className="relative overflow-hidden py-20 text-white">
        <div className="absolute inset-0 bg-linear-to-b from-transparent via-black/20 to-transparent" aria-hidden />
        <div className="relative mx-auto max-w-4xl px-6 text-center">
          <p className="text-xs uppercase tracking-[0.4em] text-white/50">{t('ourSites')}</p>
          <h3 className="mt-3 text-4xl font-light text-balance">{t('automotiveMotoBrands')}</h3>
          <p className="mt-4 text-base text-white/75 text-pretty">
            {t('exclusiveAllocations')}
          </p>
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6">
            <Link
              href={`/${locale}/auto`}
              className="group rounded-2xl border border-white/10 bg-black/80 px-6 py-8 text-white shadow-lg hover:bg-black/70 hover:border-white/20 transition-colors duration-200"
            >
              <h4 className="text-2xl font-light uppercase tracking-[0.2em]">{t('autoCatalog')}</h4>
              <p className="mt-3 text-sm text-white/70">{t('autoCatalogBrands')}</p>
              <div className="mt-6 flex items-center justify-center gap-2 text-xs uppercase tracking-[0.3em] text-white/60 group-hover:text-white/90 transition-colors">
                <span>{t('viewCatalog')}</span>
                <span className="text-lg">→</span>
              </div>
            </Link>
            <Link
              href={`/${locale}/moto`}
              className="group rounded-2xl border border-white/10 bg-black/80 px-6 py-8 text-white shadow-lg hover:bg-black/70 hover:border-white/20 transition-colors duration-200"
            >
              <h4 className="text-2xl font-light uppercase tracking-[0.2em]">{t('motoCatalog')}</h4>
              <p className="mt-3 text-sm text-white/70">{t('motoCatalogBrands')}</p>
              <div className="mt-6 flex items-center justify-center gap-2 text-xs uppercase tracking-[0.3em] text-white/60 group-hover:text-white/90 transition-colors">
                <span>{t('viewCatalog')}</span>
                <span className="text-lg">→</span>
              </div>
            </Link>
          </div>
        </div>
      </section>
      */}

        <section className="relative overflow-hidden px-6 py-20 text-foreground">
          <div className="relative mx-auto max-w-6xl">
            <div className="flex flex-col gap-4 text-center md:flex-row md:items-end md:justify-between md:text-left">
              <div>
                <p className={`uppercase tracking-[0.4em] text-foreground/50 ${typography.badge}`}>
                  {t("b2bPrograms")}
                </p>
                <h3 className={`mt-3 text-balance ${typography.h2}`}>{t("partnerWithLeading")}</h3>
                <p className={`mt-3 text-foreground/60 text-pretty ${typography.body}`}>
                  {t("partnerTypes")}
                </p>
              </div>
              <Link
                href={`/${locale}/contact`}
                className="mx-auto md:mx-0 w-fit inline-flex font-display items-center gap-3 rounded-full border border-foreground/30 bg-foreground/5 px-6 py-3 text-xs uppercase tracking-[0.35em] text-foreground transition-colors duration-200 hover:border-foreground hover:bg-foreground hover:text-background"
              >
                {t("arrangeConsult")} ↗
              </Link>
            </div>
            <div className="mt-12 grid gap-6 md:grid-cols-2">
              {b2bServices.map((service) => (
                <div
                  key={service.title}
                  className="rounded-3xl border border-foreground/10 bg-card/60 dark:bg-black/60 shadow-lg p-6 hover:bg-card/80 dark:hover:bg-black/50 hover:border-foreground/20 transition-colors duration-200"
                >
                  <p
                    className={`uppercase tracking-[0.3em] text-foreground/50 ${typography.badge}`}
                  >
                    {heroBadgeCopy}
                  </p>
                  <h4 className={`mt-4 text-foreground ${typography.h3}`}>{service.title}</h4>
                  <p className={`mt-3 text-foreground/70 ${typography.body}`}>{service.copy}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <nav
          className="sr-only"
          aria-label={locale === "ua" ? "Структурна навігація сайту" : "Site structural navigation"}
        >
          <ul>
            {structureLinks.map((href) => (
              <li key={href}>
                <Link
                  href={href}
                  aria-label={locale === "ua" ? `Перейти до ${href}` : `Open ${href}`}
                >
                  {href}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </main>
    </>
  );
}
