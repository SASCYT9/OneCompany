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
    <main className="relative min-h-screen overflow-hidden text-white">
      <div className="absolute inset-0 -z-10">
        <video
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          className="h-full w-full object-cover"
        >
          <source src={heroVideo} type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/80" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_0%,rgba(255,179,71,0.25),transparent_45%)]" />
      </div>
      <section className="relative flex min-h-screen flex-col">
        <div className="px-6 pt-16 text-center text-[10px] uppercase tracking-[0.5em] text-white/55">
          <p>{heroBadgeCopy}</p>
        </div>
        <div className="mt-4 flex flex-col items-center gap-1 px-6 text-center text-[11px] uppercase tracking-[0.4em] text-white/60">
          <p>{heroMeta.globalPresence}</p>
          <p className="text-white/70">{heroMeta.brandPromise}</p>
        </div>

  <div className="relative isolate flex flex-1 flex-col gap-6 px-4 pb-4 pt-8 md:flex-row md:gap-0 md:px-0">
          <div className="pointer-events-none absolute inset-y-0 left-1/2 hidden w-[1px] -translate-x-1/2 bg-gradient-to-b from-transparent via-white/60 to-transparent md:block" />
          <div className="pointer-events-none absolute inset-y-0 left-1/2 hidden w-40 -translate-x-1/2 bg-gradient-to-r from-black/40 via-black/5 to-transparent blur-3xl md:block" />
          <div className="relative flex flex-1 flex-col gap-6 md:flex-row md:gap-0">
            {experiences.map((experience, index) => (
              <Link
                key={experience.label}
                href={experience.href}
                className={clsx(
                  "group relative flex flex-1 min-h-[420px] flex-col justify-between gap-10 overflow-hidden px-8 py-10 text-left text-white",
                  "backdrop-blur-md bg-black/30 shadow-[0_40px_120px_rgba(0,0,0,0.45)] transition duration-500 hover:bg-black/15 hover:backdrop-blur-xl",
                  index === 0 ? "md:pr-20" : "md:pl-20 md:text-right md:items-end"
                )}
              >
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/5 via-transparent to-black/30 opacity-60" />
                <div
                  aria-hidden
                  className={clsx(
                    "pointer-events-none absolute inset-0 opacity-0 transition duration-500 group-hover:opacity-100",
                    "bg-gradient-to-br",
                    experience.accent
                  )}
                />
                <div className="relative flex w-full items-center justify-between text-[11px] uppercase tracking-[0.35em] text-white/60">
                  <span className="rounded-full border border-white/30 px-4 py-1 text-[10px] tracking-[0.45em]">
                    {experience.label}
                  </span>
                  <span className="text-white/40">program access</span>
                </div>
                <div className={clsx("relative space-y-4 text-left", index === 1 && "md:text-right")}>
                  <h2 className="text-4xl font-light leading-tight text-white md:text-5xl">
                    {experience.title}
                  </h2>
                  <p className="text-base text-white/80">
                    {experience.description}
                  </p>
                </div>
                <div className="relative flex w-full items-end justify-between gap-6 pt-6">
                  <div className="flex flex-wrap gap-6 font-mono text-white/80">
                    {experience.stats.map((stat) => (
                      <div key={stat.note}>
                        <p className="text-3xl tracking-tight text-white">{stat.value}</p>
                        <p className="text-[11px] uppercase tracking-[0.35em] text-white/55">{stat.note}</p>
                      </div>
                    ))}
                  </div>
                  <span className="inline-flex h-16 w-16 items-center justify-center rounded-full border border-white/30 text-sm uppercase tracking-[0.3em] text-white/70 transition group-hover:border-white group-hover:bg-white group-hover:text-black">
                    →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
        <div className="mb-6 flex justify-center px-6">
          <Link
            href="#signature-programs"
            className="inline-flex items-center gap-3 rounded-full border border-white/20 bg-white/10 px-6 py-3 text-[11px] uppercase tracking-[0.4em] text-white transition hover:border-white/70 hover:bg-white hover:text-black"
          >
            Signature Programs
            <span className="text-base">↘</span>
          </Link>
        </div>
        <div className="px-6 pb-10 text-center text-[11px] uppercase tracking-[0.35em] text-white/60">
          <p className="font-semibold text-white/70">{heroMeta.atelierAddress}</p>
        </div>
      </section>
      <section className="border-t border-white/10 bg-black/70">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-6 py-12 text-center text-white md:grid-cols-4">
          {statHighlights.map((stat) => (
            <div key={stat.label} className="space-y-3">
              <p className="text-4xl font-light tracking-tight">{stat.value}</p>
              <p className="text-[11px] uppercase tracking-[0.35em] text-white/60">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="relative overflow-hidden bg-gradient-to-b from-black via-black/90 to-[#050505] py-20 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,179,71,0.12),_transparent_45%)]" aria-hidden />
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
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-white"
              >
                {brand}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-[#050505] px-6 py-20 text-white">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#050505] to-[#040404]" aria-hidden />
        <div className="relative mx-auto max-w-6xl">
          <div className="flex flex-col gap-4 text-center md:flex-row md:items-end md:justify-between md:text-left">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-white/50">Signature atelier</p>
              <h3 className="mt-3 text-4xl font-light">Programs engineered for collectors</h3>
            </div>
            <Link
              href={`/${locale}/contact`}
              className="inline-flex items-center gap-3 rounded-full border border-white/20 px-6 py-3 text-xs uppercase tracking-[0.35em] text-white transition hover:border-white hover:bg-white hover:text-black"
            >
              Arrange consult ↗
            </Link>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {atelierServices.map((service) => (
              <div
                key={service.title}
                className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/5 via-transparent to-black/40 p-6 backdrop-blur"
              >
                <p className="text-sm uppercase tracking-[0.3em] text-white/50">{heroBadgeCopy}</p>
                <h4 className="mt-4 text-2xl font-light text-white">{service.title}</h4>
                <p className="mt-3 text-sm text-white/70">{service.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-[#040404] px-6 pb-24 text-white">
        <div className="absolute inset-0 bg-gradient-to-b from-[#040404] via-[#050505] to-transparent" aria-hidden />
        <div className="absolute inset-x-0 -top-24 h-32 bg-gradient-to-b from-transparent via-[#050505] to-[#040404] blur-3xl" aria-hidden />
        <div className="relative mx-auto max-w-4xl rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.08),_rgba(5,5,5,0.85))] p-10 text-center md:text-left shadow-[0_40px_120px_rgba(0,0,0,0.6)]">
          <p className="text-xs uppercase tracking-[0.5em] text-white/50">Kyiv command studio</p>
          <h3 className="mt-4 text-4xl font-light">21B Baseina St · concierge@onecompany.com</h3>
          <p className="mt-4 text-base text-white/70">
            Private fittings, remote video approvals, and deployment within 36 hours globally.
          </p>
          <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-center">
            <a
              href="tel:+380442781234"
              className="flex-1 rounded-full border border-white/20 px-6 py-3 text-sm uppercase tracking-[0.35em] text-white transition hover:border-white hover:bg-white hover:text-black"
            >
              +380 (44) 278 12 34
            </a>
            <Link
              href={`/${locale}/showcase`}
              className="flex-1 rounded-full border border-white/0 bg-white px-6 py-3 text-sm uppercase tracking-[0.35em] text-black shadow-[0_10px_40px_rgba(255,255,255,0.25)]"
            >
              View showcase
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
