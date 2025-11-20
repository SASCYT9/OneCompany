import Link from "next/link";
import clsx from "clsx";
import { getTranslations } from "next-intl/server";
import { Globe } from "lucide-react";

type ExperienceSplit = {
  label: string;
  title: string;
  description: string;
  href: string;
  accent: string;
  stats: { value: string; note: string }[];
};

type LocalizedHomePageProps = {
  params: Promise<{ locale: string }>;
};

export default async function LocalizedHomePage({
  params,
}: LocalizedHomePageProps) {
  const { locale } = await params;
  const t = await getTranslations("home");

  const experiences: ExperienceSplit[] = [
    {
      label: t('automotive'),
      title: t('hypercarPrograms'),
      description: t('hypercarDescription'),
      href: `/${locale}/auto`,
      accent: "from-amber-400/20 via-orange-500/10 to-transparent",
      stats: [
        { value: "120+", note: t('autoBrands') },
        { value: "11", note: t('autoCategories') },
      ],
    },
    {
      label: t('moto'),
      title: t('factoryRacePackages'),
      description: t('factoryRaceDescription'),
      href: `/${locale}/moto`,
      accent: "from-blue-400/25 via-purple-500/15 to-transparent",
      stats: [
        { value: "40+", note: t('motoPartners') },
        { value: "6", note: t('motoSeries') },
      ],
    },
  ];

  const heroBadgeCopy = t('badge');

  const statHighlights = [
    { value: "18", label: t('statsExperience') },
    { value: "200+", label: t('statsBrands') },
    { value: "160+", label: t('statsContinents') },
    { value: <Globe className="w-9 h-9 mx-auto" strokeWidth={1.5} />, label: t('logisticsTitle') },
  ];

  const b2bServices = [
    {
      title: t('wholesaleTitle'),
      copy: t('wholesaleDescription'),
    },
    {
      title: t('logisticsTitle'),
      copy: t('logisticsDescription'),
    },
  ];

  return (
    <main className="text-white">
      <section className="relative flex min-h-screen flex-col justify-between pt-12">
        <div className="px-4 pt-12 text-center text-[8px] uppercase tracking-[0.4em] text-white/55 sm:px-6 sm:pt-16 sm:text-[10px] sm:tracking-[0.5em]">
          <p>{heroBadgeCopy}</p>
        </div>

        <div className="relative isolate flex flex-1 flex-col gap-4 px-3 pb-3 pt-6 sm:gap-6 sm:px-4 sm:pb-4 sm:pt-8 md:flex-row md:gap-0 md:px-0">
          <div className="pointer-events-none absolute inset-y-0 left-1/2 hidden w-[1px] -translate-x-1/2 bg-gradient-to-b from-transparent via-white/20 to-transparent md:block" />
          
          <div className="relative flex flex-1 flex-col gap-6 md:flex-row md:gap-0">
            {experiences.map((experience, index) => (
              <Link
                key={experience.label}
                href={experience.href}
                className={clsx(
                  "group relative flex flex-1 min-h-[380px] flex-col justify-between gap-6 overflow-hidden p-6 text-left text-white sm:min-h-[420px] sm:gap-10 sm:p-8",
                  "border border-white/10 bg-white/[0.02] backdrop-blur-3xl shadow-[0_20px_40px_rgba(0,0,0,0.4)] transition-all duration-500 hover:bg-white/[0.05] hover:border-white/20 hover:shadow-[0_30px_60px_rgba(0,0,0,0.5)]",
                  "rounded-3xl",
                  index === 0 ? "md:mr-3" : "md:ml-3 md:text-right md:items-end"
                )}
              >
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent" />
                <div
                  aria-hidden
                  className={clsx(
                    "pointer-events-none absolute inset-0 opacity-0 transition duration-500 group-hover:opacity-40",
                    "bg-gradient-to-br",
                    experience.accent
                  )}
                />
                <div className="relative flex w-full items-center justify-between text-[9px] uppercase tracking-[0.25em] text-white/60 sm:text-[11px] sm:tracking-[0.35em]">
                  <span className="rounded-full border border-white/50 bg-white/10 backdrop-blur-md px-4 py-1.5 text-[9px] font-bold tracking-[0.35em] text-white shadow-[0_0_25px_rgba(255,255,255,0.4)] transition-all duration-300 group-hover:bg-white group-hover:text-black group-hover:shadow-[0_0_35px_rgba(255,255,255,0.6)] sm:px-5 sm:text-[11px] sm:tracking-[0.45em]">
                    {experience.label}
                  </span>
                  <span className="hidden text-white/40 sm:inline">{t('programAccess')}</span>
                </div>
                <div className={clsx("relative space-y-2 text-left sm:space-y-4", index === 1 && "md:text-right")}>
                  <h2 className="text-2xl font-light leading-tight text-white text-balance sm:text-3xl md:text-4xl lg:text-5xl uppercase tracking-wide">
                    {experience.title}
                  </h2>
                  <p className="text-sm leading-relaxed text-white/80 text-pretty sm:text-base font-light tracking-wide">
                    {experience.description}
                  </p>
                </div>
                <div className="relative flex w-full items-end justify-between gap-3 pt-4 sm:gap-6 sm:pt-6">
                  <div className="flex flex-wrap gap-3 text-white/80 sm:gap-6">
                    {experience.stats.map((stat) => (
                      <div key={stat.note}>
                        <p className="text-xl tracking-tight text-white sm:text-2xl md:text-3xl font-light">{stat.value}</p>
                        <p className="text-[9px] uppercase tracking-[0.25em] text-white/55 sm:text-[11px] sm:tracking-[0.35em]">{stat.note}</p>
                      </div>
                    ))}
                  </div>
                  <span className="inline-flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full border border-white/30 bg-white/5 backdrop-blur-sm text-lg text-white transition-all duration-500 group-hover:scale-110 group-hover:border-white group-hover:bg-white group-hover:text-black group-hover:shadow-[0_0_30px_rgba(255,255,255,0.5)] sm:h-20 sm:w-20">
                    →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
        
        <div className="flex flex-col items-center gap-4 px-4 pb-10 text-center">
          <Link
            href="#expert-programs"
            className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 backdrop-blur-xl px-5 py-2.5 text-[9px] uppercase tracking-[0.3em] text-white transition-all duration-300 hover:border-white hover:bg-white hover:text-black hover:shadow-[0_8px_32px_rgba(255,255,255,0.2)] sm:gap-3 sm:px-6 sm:py-3 sm:text-[11px] sm:tracking-[0.4em]"
          >
            {t('conciergeService')}
            <span className="text-sm sm:text-base">↘</span>
          </Link>
          {/* Address moved to footer; hero no longer displays physical address */}
        </div>
      </section>
      <section className="border-t border-white/10 bg-black/40 backdrop-blur-xl">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-6 py-12 text-center text-white md:grid-cols-4">
          {statHighlights.map((stat) => (
            <div key={stat.label} className="space-y-3 p-4 rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-3xl shadow-[0_10px_30px_rgba(0,0,0,0.3)] hover:bg-white/[0.05] hover:border-white/20 hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)] transition-all duration-300">
              <div className="text-4xl font-light tracking-tight flex justify-center">{stat.value}</div>
              <p className="text-[11px] uppercase tracking-[0.35em] text-white/60">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="expert-programs" className="relative overflow-hidden py-20 text-white">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-transparent" aria-hidden />
        <div className="relative mx-auto max-w-4xl px-6 text-center">
          <p className="text-xs uppercase tracking-[0.4em] text-white/50">{t('ourSites')}</p>
          <h3 className="mt-3 text-4xl font-light text-balance">{t('automotiveMotoBrands')}</h3>
          <p className="mt-4 text-base text-white/75 text-pretty">
            {t('exclusiveAllocations')}
          </p>
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6">
            <Link
              href={`/${locale}/auto`}
              className="group rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-8 text-white backdrop-blur-3xl shadow-[0_20px_40px_rgba(0,0,0,0.4)] hover:bg-white/[0.05] hover:border-white/20 hover:shadow-[0_30px_60px_rgba(0,0,0,0.5)] transition-all duration-300"
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
              className="group rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-8 text-white backdrop-blur-3xl shadow-[0_20px_40px_rgba(0,0,0,0.4)] hover:bg-white/[0.05] hover:border-white/20 hover:shadow-[0_30px_60px_rgba(0,0,0,0.5)] transition-all duration-300"
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

      <section className="relative overflow-hidden px-6 py-20 text-white">
        <div className="relative mx-auto max-w-6xl">
          <div className="flex flex-col gap-4 text-center md:flex-row md:items-end md:justify-between md:text-left">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-white/50">{t('b2bPrograms')}</p>
              <h3 className="mt-3 text-4xl font-light text-balance">{t('partnerWithLeading')}</h3>
              <p className="mt-3 text-sm text-white/60 text-pretty">{t('partnerTypes')}</p>
            </div>
            <Link
              href={`/${locale}/contact`}
              className="mx-auto md:mx-0 w-fit inline-flex items-center gap-3 rounded-full border border-white/30 bg-white/10 backdrop-blur-xl px-6 py-3 text-xs uppercase tracking-[0.35em] text-white transition-all duration-300 hover:border-white hover:bg-white hover:text-black hover:shadow-[0_8px_32px_rgba(255,255,255,0.2)]"
            >
              {t('arrangeConsult')} ↗
            </Link>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {b2bServices.map((service) => (
              <div
                key={service.title}
                className="rounded-3xl border border-white/10 bg-white/[0.02] backdrop-blur-3xl shadow-[0_20px_40px_rgba(0,0,0,0.4)] p-6 hover:bg-white/[0.05] hover:border-white/20 hover:shadow-[0_30px_60px_rgba(0,0,0,0.5)] transition-all duration-300"
              >
                <p className="text-sm uppercase tracking-[0.3em] text-white/50">{heroBadgeCopy}</p>
                <h4 className="mt-4 text-2xl font-light text-white">{service.title}</h4>
                <p className="mt-3 text-sm text-white/70">{service.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>


    </main>
  );
}
