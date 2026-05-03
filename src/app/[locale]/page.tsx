import Link from "next/link";
import type { Metadata } from "next";
import { absoluteUrl, buildLocalizedPath, buildPageMetadata, resolveLocale, type SupportedLocale } from "@/lib/seo";
import { readSiteContent } from "@/lib/siteContentServer";

const homeMetaCopy: Record<SupportedLocale, { title: string; description: string }> = {
  en: {
    title: "onecompany · Global Auto & Moto Performance Atelier",
    description:
      "Premium automotive and motorcycle tuning programs with concierge homologation, logistics, and installation partners across four continents.",
  },
  ua: {
    title: "onecompany · Преміум ательє автотюнінгу",
    description:
      "Преміальні програми автота мототюнінгу з логістикою, гомологацією та партнерами з встановлення по всьому світу.",
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  const meta = homeMetaCopy[resolvedLocale];

  return buildPageMetadata(resolvedLocale, "", meta);
}

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
  const resolvedLocale = resolveLocale(locale);
  const schemaUrl = absoluteUrl(buildLocalizedPath(resolvedLocale));
  const siteContent = await readSiteContent();

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "AutomotiveBusiness",
    name: "onecompany",
    url: schemaUrl,
    image: absoluteUrl("/branding/one-company-logo.svg"),
    telephone: "+380123456789",
    sameAs: [
      "https://kwsuspension.shop/",
      "https://fiexhaust.shop/",
      "https://eventuri.shop/",
    ],
    address: {
      "@type": "PostalAddress",
      streetAddress: "21B Baseina St",
      addressLocality: "Kyiv",
      addressCountry: "UA",
    },
    areaServed: ["Europe", "North America", "Middle East", "Asia"],
    makesOffer: [
      "Performance exhaust systems",
      "Suspension programs",
      "Carbon aero kits",
      "Moto race packages",
    ],
  };

  const experiences: ExperienceSplit[] = [
    {
      label: "Automotive",
      title: "Hypercar & GT programs",
      description:
        "Forged wheels, carbon aero, suspension, intake and exhaust systems with OEM-level validation and support.",
      href: `/${resolvedLocale}/auto`,
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
      href: `/${resolvedLocale}/moto`,
      accent: "from-blue-400/25 via-purple-500/15 to-transparent",
      stats: [
        { value: "80+", note: "specialist partners" },
        { value: "6", note: "exclusive series" },
      ],
    },
  ];

  const heroBadgeCopy = siteContent.hero.badge;
  const heroMeta = {
    globalPresence: siteContent.hero.globalPresence,
    brandPromise: siteContent.hero.brandPromise,
    atelierAddress: siteContent.hero.atelierAddress,
  };

  const statHighlights = siteContent.statHighlights;
  const marqueeBrands = siteContent.marqueeBrands;

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
    <main className="relative text-white">
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      {/* Full-screen video will be handled in layout.tsx */}
      <section className="relative flex min-h-dvh flex-col justify-center px-4 pb-16 pt-24 sm:px-6 lg:pt-32">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/50 via-black/20 to-black/60" />
        <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_18%_0%,rgba(255,179,71,0.4),transparent_58%)]" />

        <div className="relative mx-auto flex w/full max-w-6xl flex-col items-center text-center">
          <p className="text-[10px] uppercase tracking-[0.45em] text-white/60 sm:text-[11px]">{heroBadgeCopy}</p>
          <p className="mt-3 text-[11px] uppercase tracking-[0.35em] text-white/70 sm:text-xs">{heroMeta.globalPresence}</p>

          <h1 className="mt-8 text-balance text-4xl font-light uppercase leading-tight text-white sm:text-6xl lg:text-7xl">
            <span className="text-white/70">Hypercar & Moto</span>{" "}
            <span className="bg-gradient-to-r from-amber-200 via-white to-amber-400 bg-clip-text text-transparent">Signature Atelier</span>
          </h1>
          <p className="mx-auto mt-6 max-w-3xl text-base text-white/80 sm:text-xl">{heroMeta.brandPromise}</p>

          <div className="mt-10 flex flex-wrap justify-center gap-4">
            {experiences.map((experience) => (
              <Link
                key={experience.label}
                href={experience.href}
                className="group inline-flex items-center gap-3 rounded-full border border-white/25 bg-white/10 px-7 py-3 text-[11px] font-semibold uppercase tracking-[0.35em] text-white transition duration-300 hover:border-white hover:bg-white/20"
              >
                {experience.label}
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-white transition group-hover:bg-white/20">
                  ↗
                </span>
              </Link>
            ))}
          </div>

          <div className="mt-10 grid gap-6 text-left text-white/80 sm:grid-cols-2">
            {experiences.map((experience) => (
              <div key={`${experience.label}-detail`} className="space-y-2 border-l border-white/15 pl-4">
                <p className="text-[10px] uppercase tracking-[0.3em] text-white/60">{experience.label}</p>
                <p className="text-lg font-light uppercase text-white">{experience.title}</p>
                <p className="text-sm text-white/70">{experience.description}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 grid w-full grid-cols-2 gap-8 text-center text-white sm:grid-cols-4">
            {statHighlights.map((stat) => (
              <div key={stat.label} className="space-y-2">
                <p className="text-4xl font-light sm:text-5xl">{stat.value}</p>
                <p className="text-[10px] uppercase tracking-[0.3em] text-white/60 sm:text-[11px] sm:tracking-[0.35em]">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>

          <p className="mt-12 text-[10px] uppercase tracking-[0.35em] text-white/60 sm:text-[11px]">
            {heroMeta.atelierAddress}
          </p>
        </div>
      </section>
      <section className="relative px-4 py-20 text-white" id="signature-programs">
        <div className="relative mx-auto w-full max-w-6xl space-y-12 text-center md:text-left">
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.4em] text-white/55 sm:text-sm">Iconic marques</p>
            <h3 className="text-balance text-3xl font-light sm:text-4xl md:text-5xl">Beyond the GP Products roster</h3>
            <p className="text-pretty text-base text-white/75 sm:text-lg">
              Deeper allocations, bespoke specs, and dual automotive / moto mastery with atelier accountability.
            </p>
          </div>
          <div className="grid gap-4 text-xs uppercase tracking-[0.25em] text-white/70 sm:grid-cols-3 sm:text-sm">
            {marqueeBrands.map((brand) => (
              <span
                key={brand}
                className="border-b border-white/10 pb-3 text-center text-white/65 transition-colors hover:text-white sm:text-left"
              >
                {brand}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="relative px-4 py-20 text-white" id="atelier-programs">
        <div className="relative mx-auto w-full max-w-6xl space-y-10">
          <div className="flex flex-col gap-6 text-center md:flex-row md:items-end md:justify-between md:text-left">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.35em] text-white/55 sm:text-sm">Signature atelier</p>
              <h3 className="text-balance text-3xl font-light sm:text-4xl md:text-5xl">Programs engineered for collectors</h3>
            </div>
            <Link
              href={`/${resolvedLocale}/contact`}
              className="mx-auto inline-flex flex-shrink-0 items-center gap-3 rounded-full border border-white/25 px-6 py-3 text-[11px] uppercase tracking-[0.3em] text-white transition duration-300 hover:border-white md:mx-0 sm:gap-4 sm:px-8 sm:py-4 sm:text-xs"
            >
              Arrange consult ↗
            </Link>
          </div>
          <div className="divide-y divide-white/10 border-y border-white/10">
            {atelierServices.map((service) => (
              <div key={service.title} className="grid gap-6 py-8 text-left md:grid-cols-3">
                <p className="text-[11px] uppercase tracking-[0.3em] text-white/50 sm:text-sm">{heroBadgeCopy}</p>
                <div className="md:col-span-2 space-y-3">
                  <h4 className="text-2xl font-light text-white sm:text-3xl">{service.title}</h4>
                  <p className="text-base text-white/70">{service.copy}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative px-4 pb-24 pt-10 text-white">
        <div className="mx-auto w-full max-w-5xl space-y-6 text-center md:text-left">
          <p className="text-xs uppercase tracking-[0.35em] text-white/55 sm:text-sm">Kyiv command studio</p>
          <h3 className="text-balance text-3xl font-light sm:text-4xl md:text-5xl">{siteContent.contactCta.heading}</h3>
          <p className="text-pretty text-base text-white/70 sm:text-lg">{siteContent.contactCta.body}</p>
          <div className="mt-8 flex flex-col gap-4 md:flex-row md:items-center">
            <a
              href="tel:+380442781234"
              className="flex-1 rounded-full border border-white/30 px-6 py-4 text-center text-[11px] uppercase tracking-[0.25em] text-white transition-colors hover:border-white sm:px-8 sm:text-sm sm:tracking-[0.35em]"
            >
              +380 (44) 278 12 34
            </a>
            <Link
              href={`/${resolvedLocale}${siteContent.contactCta.buttonHref}`}
              className="flex-1 rounded-full border border-white bg-white px-6 py-4 text-center text-[11px] uppercase tracking-[0.25em] text-black transition-colors hover:bg-white/90 sm:px-8 sm:text-sm sm:tracking-[0.35em]"
            >
              {siteContent.contactCta.buttonLabel}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
