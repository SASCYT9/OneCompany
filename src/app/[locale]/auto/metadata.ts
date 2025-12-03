import type { Metadata } from "next";
import { buildPageMetadata, resolveLocale, type SupportedLocale } from "@/lib/seo";

const autoMetaCopy: Record<SupportedLocale, { title: string; description: string }> = {
  en: {
    title: "Auto Tuning · 160+ Premium Brands · Akrapovic, Brabus, HRE | onecompany",
    description:
      "Official importer of premium auto tuning: Akrapovic exhausts, Brabus, Mansory, HRE wheels, KW suspension, Eventuri intakes. Expert sourcing, global logistics & warranty since 2007.",
  },
  ua: {
    title: "Авто Тюнінг · 160+ Преміум Брендів · Akrapovic, Brabus, HRE | onecompany",
    description:
      "Офіційний імпортер преміум авто тюнінгу: вихлопні системи Akrapovic, Brabus, Mansory, диски HRE, підвіска KW, впуск Eventuri. Експертний підбір, глобальна логістика та гарантія з 2007.",
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
