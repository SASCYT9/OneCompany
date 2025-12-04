import Link from "next/link";
import Image from "next/image";
import clsx from "clsx";
import { getTranslations } from "next-intl/server";
import { Globe } from "lucide-react";

type ExperienceSplit = {
  label: string;
  title: string;
  description: string;
  href: string;
  accent: string;
  bgImage: string;
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
      bgImage: "/images/hero-auto.png",
      stats: [
        { value: "160+", note: t('autoBrands') },
        { value: "11", note: t('autoCategories') },
      ],
    },
    {
      label: t('moto'),
      title: t('factoryRacePackages'),
      description: t('factoryRaceDescription'),
      href: `/${locale}/moto`,
      accent: "from-blue-400/25 via-purple-500/15 to-transparent",
      bgImage: "/images/hero-moto.png",
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
    { value: <span className="font-semibold">{t('statsBestConditions')}</span>, label: t('statsBestConditionsSub') },
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
      <section className="relative flex min-h-[70vh] flex-col justify-center pt-8">
        <div className="px-4 pt-24 text-center text-[8px] uppercase tracking-[0.4em] text-white/55 sm:px-6 md:pt-36 sm:text-[10px] sm:tracking-[0.5em]">
          <p>{heroBadgeCopy}</p>
        </div>

        <div className="relative isolate flex flex-1 flex-col gap-3 px-4 pb-4 pt-4 sm:gap-4 sm:px-6 sm:pb-6 sm:pt-6 md:flex-row md:gap-4 md:px-8 max-w-[1400px] mx-auto w-full">
          
          <div className="relative flex flex-1 flex-col gap-4 md:flex-row md:gap-4">
            {experiences.map((experience, index) => (
              <Link
                key={experience.label}
                href={experience.href}
                className={clsx(
                  "group relative flex flex-1 min-h-[280px] flex-col justify-between gap-4 overflow-hidden p-4 text-left text-white sm:min-h-[320px] sm:gap-6 sm:p-5",
                  "border border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.3)] transition-all duration-500 hover:border-white/20 hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)]",
                  "rounded-2xl",
                  index === 0 ? "md:mr-2" : "md:ml-2"
                )}
              >
                {/* Background Image - grayscale with blue tint */}
                <Image
                  src={experience.bgImage}
                  alt={experience.label}
                  fill
                  className="object-cover grayscale group-hover:grayscale-0 group-hover:scale-105 transition-all duration-700"
                  style={{ filter: 'grayscale(100%) brightness(0.9) sepia(20%) hue-rotate(180deg) saturate(0.5)' }}
                  priority
                  quality={90}
                />
                {/* Blue tint overlay */}
                <div className="absolute inset-0 bg-blue-950/20 mix-blend-overlay group-hover:opacity-0 transition-opacity duration-700" />
                {/* Subtle gradient for text readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                
                <div className="relative flex flex-col items-center justify-center space-y-3 text-center flex-1">
                  <div>
                    <span className="inline-block font-display rounded-full border border-white/50 bg-white/10 backdrop-blur-md px-6 py-2.5 text-xs tracking-[0.3em] text-white shadow-[0_0_20px_rgba(255,255,255,0.4)] transition-all duration-300 group-hover:bg-white group-hover:text-black group-hover:shadow-[0_0_40px_rgba(255,255,255,0.7)] sm:px-8 sm:py-3 sm:text-sm sm:tracking-[0.35em]">
                      {experience.label}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-white/80 text-pretty sm:text-sm tracking-wide max-w-xs mx-auto">
                    {experience.description}
                  </p>
                </div>
                <div className="relative flex w-full items-end justify-between gap-2 pt-2 sm:gap-4 sm:pt-3">
                  <div className="flex flex-wrap gap-2 text-white/80 sm:gap-4">
                    {experience.stats.map((stat) => (
                      <div key={stat.note}>
                        <p className="text-lg font-display tracking-tight text-white sm:text-xl">{stat.value}</p>
                        <p className="text-[8px] uppercase tracking-[0.2em] text-white/55 sm:text-[9px] sm:tracking-[0.3em]">{stat.note}</p>
                      </div>
                    ))}
                  </div>
                  <span className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-white/30 bg-white/5 backdrop-blur-sm text-sm text-white transition-all duration-500 group-hover:scale-110 group-hover:border-white group-hover:bg-white group-hover:text-black group-hover:shadow-[0_0_20px_rgba(255,255,255,0.4)] sm:h-12 sm:w-12">
                    →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
      <section className="border-t border-white/10 bg-black/40 backdrop-blur-xl px-4 sm:px-6 md:px-8">
        <div className="mx-auto grid max-w-[1400px] grid-cols-2 gap-4 py-8 text-center text-white md:grid-cols-4 sm:gap-6">
          {statHighlights.map((stat) => (
            <div key={stat.label} className="flex flex-col items-center justify-center gap-2 p-3 h-full min-h-[120px] rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-3xl shadow-[0_10px_30px_rgba(0,0,0,0.3)] hover:bg-white/[0.05] hover:border-white/20 hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)] transition-all duration-300 sm:min-h-[140px] sm:p-4 sm:gap-3">
              <div className="text-2xl font-display sm:text-3xl tracking-tight text-center text-balance">{stat.value}</div>
              <p className="text-[9px] uppercase tracking-[0.3em] text-white/60 text-center sm:text-[10px] sm:tracking-[0.35em]">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Hidden for now - duplicates hero cards functionality
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
      */}

      <section className="relative overflow-hidden px-6 py-20 text-white">
        <div className="relative mx-auto max-w-6xl">
          <div className="flex flex-col gap-4 text-center md:flex-row md:items-end md:justify-between md:text-left">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-white/50">{t('b2bPrograms')}</p>
              <h3 className="mt-3 text-4xl text-balance">{t('partnerWithLeading')}</h3>
              <p className="mt-3 text-sm text-white/60 text-pretty">{t('partnerTypes')}</p>
            </div>
            <Link
              href={`/${locale}/contact`}
              className="mx-auto md:mx-0 w-fit inline-flex font-display items-center gap-3 rounded-full border border-white/30 bg-white/10 backdrop-blur-xl px-6 py-3 text-xs uppercase tracking-[0.35em] text-white transition-all duration-300 hover:border-white hover:bg-white hover:text-black hover:shadow-[0_8px_32px_rgba(255,255,255,0.2)]"
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
                <h4 className="mt-4 text-2xl text-white">{service.title}</h4>
                <p className="mt-3 text-sm text-white/70">{service.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>


    </main>
  );
}
