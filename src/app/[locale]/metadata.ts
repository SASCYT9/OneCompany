import type { Metadata } from "next";
import { buildPageMetadata, resolveLocale, type SupportedLocale } from "@/lib/seo";

const homeMetaCopy: Record<SupportedLocale, { title: string; description: string }> = {
  en: {
    title: "One Company Global — Premium Auto & Moto Tuning Ukraine | Akrapovic, Brabus, Eventuri | Kyiv",
    description:
      "Official distributor of 200+ premium tuning brands in Ukraine: Akrapovic, Brabus, Eventuri, HRE Wheels, KW, Ohlins. Auto tuning Kyiv. Exhaust systems, suspension, wheels, carbon fiber. Worldwide shipping.",
  },
  ua: {
    title: "One Company Global — Тюнінг Авто та Мото Київ | Akrapovic, Brabus, Eventuri | Україна",
    description:
      "Тюнінг Київ — офіційний дистриб'ютор 200+ преміум брендів: Akrapovic, Brabus, Eventuri, HRE, KW, Ohlins. Тюнінг авто Україна. Вихлопні системи, підвіска, диски, карбон. Доставка по Україні.",
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
