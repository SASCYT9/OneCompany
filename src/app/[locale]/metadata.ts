import type { Metadata } from "next";
import { buildPageMetadata, resolveLocale, type SupportedLocale } from "@/lib/seo";

const homeMetaCopy: Record<SupportedLocale, { title: string; description: string }> = {
  en: {
    title: "Auto & Moto Tuning in Kyiv | OneCompany",
    description:
      "Official importer of premium auto and motorcycle tuning parts: exhaust, suspension, OEM, electronics, carbon. Expert sourcing and delivery.",
  },
  ua: {
    title: "Тюнінг авто та мото в Києві | OneCompany",
    description:
      "Офіційний імпортер преміум тюнінгу авто та мото: вихлоп, підвіска, OEM, електрика, карбон. Підбір, гарантія, доставка по Україні.",
  },
};

const homepageKeywords: Record<SupportedLocale, string[]> = {
  ua: [
    "OneCompany",
    "One Company Global",
    "тюнінг Київ",
    "тюнінг авто Україна",
    "мото тюнінг Україна",
    "преміум тюнінг",
    "вихлопні системи",
    "спортивна підвіска",
    "диски ковані",
    "карбонові деталі",
    "чіп тюнінг",
    "Akrapovic Україна",
    "Brabus Україна",
    "Mansory Україна",
    "HRE Wheels",
    "KW Suspension",
  ],
  en: [
    "OneCompany",
    "One Company Global",
    "premium auto tuning",
    "premium moto tuning",
    "performance parts Ukraine",
    "exhaust systems",
    "suspension upgrade",
    "forged wheels",
    "carbon fiber parts",
    "ECU tuning",
    "Akrapovic",
    "Brabus",
    "Mansory",
    "HRE Wheels",
    "KW Suspension",
    "Eventuri",
  ],
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  const meta = homeMetaCopy[resolvedLocale];

  return {
    ...buildPageMetadata(resolvedLocale, "", meta),
    keywords: homepageKeywords[resolvedLocale],
  };
}
