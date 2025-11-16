import Link from "next/link";
import clsx from "clsx";

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

  const experiences: ExperienceSplit[] = [
    {
      label: "Automotive",
      title: "Hypercar & GT programs",
      description:
        "Forged wheels, carbon aero, suspension, intake and exhaust systems with OEM-level validation and support.",
      href: `/${locale}/auto`,
      accent: "from-amber-400/20 via-orange-500/10 to-transparent",
      stats: [
        { value: "120+", note: "curated marques" },
        { value: "11", note: "upgrade disciplines" },
      ],
    },
    {
      label: "Moto",
      title: "Factory race packages",
      description:
        "WorldSBK-grade exhausts, ECU calibrations, carbon protection and track-ready ergonomics for litre bikes.",
      href: `/${locale}/moto`,
      accent: "from-blue-400/25 via-purple-500/15 to-transparent",
      stats: [
        { value: "80+", note: "specialist partners" },
        { value: "6", note: "exclusive series" },
      ],
    },
  ];

  const heroVideo = "/videos/hero-background.mp4";
  const heroBadgeCopy = "onecompany · dual signature programs";
  const heroMeta = {
    globalPresence: "services worldwide since 2007",
    brandPromise: "200+ brands premium tuning parts",
    atelierAddress: "21B Baseina St · Kyiv atelier",
  };

  const statHighlights = [
    { value: "18", label: "years of atelier heritage" },
    { value: "200+", label: "performance marques curated" },
    { value: "36h", label: "door-to-door logistics" },
    { value: "4", label: "continents served weekly" },
  ];

  const marqueeBrands = [
    "Aston Martin Racing",
    "Brabus",
    "Akrapovič",
    "KW Suspensions",
    "Novitec",
    "Eventuri",
    "ABT Sportsline",
    "Mansory",
    "Ruf Automobile",
    "Techart",
    "Z Performance",
    "Capristo",
  ];

  const atelierServices = [
    {
      title: "Concierge homologation",
      copy: "ECE / TÜV documentation, customs coordination, and OEM liaison for limited allocations.",
    },
    {
      title: "Tailored install studios",
      copy: "On-site master technicians for carbon aero, suspension, and ECU calibrations across auto & moto.",
    },
    {
      title: "Global logistics command",
      copy: "Priority air cargo lanes, climate packaging, and bonded storage with live tracking dashboards.",
    },
  ];

  return (
    <main className="text-white">
      <section className="relative flex min-h-screen flex-col justify-between pt-12">
        <div>
          <div className="px-4 pt-12 text-center text-[8px] uppercase tracking-[0.4em] text-white/55 sm:px-6 sm:pt-16 sm:text-[10px] sm:tracking-[0.5em]">
            <p>{heroBadgeCopy}</p>
          </div>
          <div className="mt-2 flex flex-col items-center gap-1 px-4 text-center text-[9px] uppercase tracking-[0.3em] text-white/60 sm:mt-4 sm:px-6 sm:text-[11px] sm:tracking-[0.4em]">
            <p>{heroMeta.globalPresence}</p>
            <p className="text-white/70">{heroMeta.brandPromise}</p>
          </div>
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
                  "border border-white/20 bg-white/[0.08] backdrop-blur-2xl transition-all duration-500 hover:bg-white/[0.15] hover:border-white/30 hover:shadow-[0_8px_32px_rgba(255,255,255,0.1)]",
                  "rounded-3xl",
                  index === 0 ? "md:mr-3" : "md:ml-3 md:text-right md:items-end"
                )}
              >
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.05] to-transparent" />
                <div
                  aria-hidden
                  className={clsx(
                    "pointer-events-none absolute inset-0 opacity-0 transition duration-500 group-hover:opacity-40",
                    "bg-gradient-to-br",
                    experience.accent
                  )}
                />
                <div className="relative flex w-full items-center justify-between text-[9px] uppercase tracking-[0.25em] text-white/60 sm:text-[11px] sm:tracking-[0.35em]">
                  <span className="rounded-full border border-white/20 bg-black/10 px-3 py-1 text-[8px] tracking-[0.35em] sm:px-4 sm:text-[10px] sm:tracking-[0.45em]">
                    {experience.label}
                  </span>
                  <span className="hidden text-white/40 sm:inline">program access</span>
                </div>
                <div className={clsx("relative space-y-2 text-left sm:space-y-4", index === 1 && "md:text-right")}>
                  <h2 className="text-2xl font-light leading-tight text-white sm:text-3xl md:text-4xl lg:text-5xl">
                    {experience.title}
                  </h2>
                  <p className="text-sm leading-relaxed text-white/80 sm:text-base">
                    {experience.description}
                  </p>
                </div>
                <div className="relative flex w-full items-end justify-between gap-3 pt-4 sm:gap-6 sm:pt-6">
                  <div className="flex flex-wrap gap-3 font-mono text-white/80 sm:gap-6">
                    {experience.stats.map((stat) => (
                      <div key={stat.note}>
                        <p className="text-xl tracking-tight text-white sm:text-2xl md:text-3xl">{stat.value}</p>
                        <p className="text-[9px] uppercase tracking-[0.25em] text-white/55 sm:text-[11px] sm:tracking-[0.35em]">{stat.note}</p>
                      </div>
                    ))}
                  </div>
                  <span className="inline-flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full border border-white/20 bg-black/20 text-sm uppercase tracking-[0.3em] text-white/70 transition group-hover:border-white group-hover:bg-white group-hover:text-black sm:h-16 sm:w-16">
                    →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
        
        <div className="flex flex-col items-center gap-4 px-4 pb-10 text-center">
          <Link
            href="#signature-programs"
            className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 backdrop-blur-xl px-5 py-2.5 text-[9px] uppercase tracking-[0.3em] text-white transition-all duration-300 hover:border-white hover:bg-white hover:text-black hover:shadow-[0_8px_32px_rgba(255,255,255,0.2)] sm:gap-3 sm:px-6 sm:py-3 sm:text-[11px] sm:tracking-[0.4em]"
          >
            Signature Programs
            <span className="text-sm sm:text-base">↘</span>
          </Link>
          <div className="text-[11px] uppercase tracking-[0.35em] text-white/60">
            <p className="font-semibold text-white/70">{heroMeta.atelierAddress}</p>
          </div>
        </div>
      </section>
      <section className="border-t border-white/20 bg-white/5 backdrop-blur-xl">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-6 py-12 text-center text-white md:grid-cols-4">
          {statHighlights.map((stat) => (
            <div key={stat.label} className="space-y-3 p-4 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-lg hover:bg-white/[0.08] hover:border-white/20 transition-all duration-300">
              <p className="text-4xl font-light tracking-tight">{stat.value}</p>
              <p className="text-[11px] uppercase tracking-[0.35em] text-white/60">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="signature-programs" className="relative overflow-hidden py-20 text-white">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-transparent" aria-hidden />
        <div className="relative mx-auto max-w-4xl px-6 text-center">
          <p className="text-xs uppercase tracking-[0.4em] text-white/50">Iconic marques</p>
          <h3 className="mt-3 text-4xl font-light">Beyond the GP Products roster</h3>
          <p className="mt-4 text-base text-white/75">
            Deeper allocations, bespoke specs, and dual automotive / moto mastery with atelier accountability.
          </p>
          <div className="mt-10 grid grid-cols-2 gap-4 text-sm uppercase tracking-[0.25em] text-white/70 sm:grid-cols-3">
            {marqueeBrands.map((brand) => (
              <div
                key={brand}
                className="rounded-2xl border border-white/20 bg-white/[0.08] px-4 py-6 text-white backdrop-blur-xl hover:bg-white/[0.12] hover:border-white/30 hover:shadow-[0_8px_32px_rgba(255,255,255,0.08)] transition-all duration-300"
              >
                {brand}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden px-6 py-20 text-white">
        <div className="relative mx-auto max-w-6xl">
          <div className="flex flex-col gap-4 text-center md:flex-row md:items-end md:justify-between md:text-left">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-white/50">Signature atelier</p>
              <h3 className="mt-3 text-4xl font-light">Programs engineered for collectors</h3>
            </div>
            <Link
              href={`/${locale}/contact`}
              className="mx-auto md:mx-0 w-fit inline-flex items-center gap-3 rounded-full border border-white/30 bg-white/10 backdrop-blur-xl px-6 py-3 text-xs uppercase tracking-[0.35em] text-white transition-all duration-300 hover:border-white hover:bg-white hover:text-black hover:shadow-[0_8px_32px_rgba(255,255,255,0.2)]"
            >
              Arrange consult ↗
            </Link>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {atelierServices.map((service) => (
              <div
                key={service.title}
                className="rounded-3xl border border-white/20 bg-white/[0.08] backdrop-blur-2xl p-6 hover:bg-white/[0.12] hover:border-white/30 hover:shadow-[0_8px_32px_rgba(255,255,255,0.08)] transition-all duration-300"
              >
                <p className="text-sm uppercase tracking-[0.3em] text-white/50">{heroBadgeCopy}</p>
                <h4 className="mt-4 text-2xl font-light text-white">{service.title}</h4>
                <p className="mt-3 text-sm text-white/70">{service.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden px-6 pb-24 text-white">
        <div className="relative mx-auto max-w-4xl rounded-[32px] border border-white/30 bg-white/[0.1] p-10 text-center shadow-[0_20px_60px_rgba(255,255,255,0.1)] backdrop-blur-2xl hover:border-white/40 hover:bg-white/[0.12] transition-all duration-500">
          <div className="absolute inset-0 rounded-[32px] bg-gradient-to-br from-white/[0.08] to-transparent pointer-events-none" />
          <div className="relative">
            <p className="text-xs uppercase tracking-[0.5em] text-white/50">Kyiv command studio</p>
            <h3 className="mt-4 text-4xl font-light">21B Baseina St · concierge@onecompany.com</h3>
            <p className="mt-4 text-base text-white/70">
              Private fittings, remote video approvals, and deployment within 36 hours globally.
            </p>
            <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-center">
              <a
                href="tel:+380442781234"
                className="flex-1 rounded-full border border-white/30 bg-white/10 backdrop-blur-xl px-6 py-3 text-sm uppercase tracking-[0.35em] text-white transition-all duration-300 hover:border-white hover:bg-white hover:text-black hover:shadow-[0_8px_32px_rgba(255,255,255,0.2)]"
              >
                +380 (44) 278 12 34
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
