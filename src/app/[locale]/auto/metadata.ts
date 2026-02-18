import type { Metadata } from "next";
import { buildPageMetadata, resolveLocale, type SupportedLocale } from "@/lib/seo";

const autoMetaCopy: Record<SupportedLocale, { title: string; description: string }> = {
  en: {
    title: "Auto Tuning & Performance Parts | OneCompany",
    description:
      "Auto tuning in Ukraine: exhaust systems, suspension, brakes, OEM parts and electronics. Commercial sourcing, warranty, official supply.",
  },
  ua: {
    title: "Авто тюнінг та сервісні рішення | OneCompany",
    description:
      "Тюнінг авто в Україні: вихлопні системи, підвіска, гальма, OEM деталі та електрика. Комерційний підбір, гарантія, офіційні поставки.",
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  const meta = autoMetaCopy[resolvedLocale];

  return {
    ...buildPageMetadata(resolvedLocale, "auto", meta),
    keywords: [
      "auto tuning Ukraine",
      "Akrapovic exhaust",
      "Brabus tuning",
      "Mansory body kit",
      "HRE wheels",
      "KW suspension",
      "Eventuri intake",
      "premium car parts",
      "performance parts",
      "авто тюнінг Україна",
      "тюнінг преміум",
      "вихлоп Акрапович",
      "диски HRE",
      "підвіска KW",
    ],
  };
}
