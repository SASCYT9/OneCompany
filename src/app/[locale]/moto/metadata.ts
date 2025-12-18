import type { Metadata } from "next";
import { buildPageMetadata, resolveLocale, type SupportedLocale } from "@/lib/seo";

const motoMetaCopy: Record<SupportedLocale, { title: string; description: string }> = {
  en: {
    title: "Moto Tuning · 60+ Premium Brands · Akrapovic, SC-Project, Brembo | onecompany",
    description:
      "Official importer of premium motorcycle parts: Akrapovic exhausts, SC-Project, Termignoni, Brembo brakes, Rotobox carbon wheels. Race-proven components with global logistics since 2007.",
  },
  ua: {
    title: "Мото Тюнінг · 60+ Преміум Брендів · Akrapovic, SC-Project, Brembo | onecompany",
    description:
      "Офіційний імпортер преміум мото деталей: вихлопи Akrapovic, SC-Project, Termignoni, гальма Brembo, карбонові диски Rotobox. Трекові компоненти з глобальною логістикою з 2007.",
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  const meta = motoMetaCopy[resolvedLocale];

  return {
    ...buildPageMetadata(resolvedLocale, "moto", meta),
    keywords: [
      "motorcycle tuning Ukraine",
      "Akrapovic exhaust moto",
      "SC-Project exhaust",
      "Termignoni",
      "Brembo brakes",
      "Rotobox wheels",
      "carbon motorcycle parts",
      "race exhaust",
      "мото тюнінг Україна",
      "вихлоп мотоцикла",
      "карбонові деталі",
      "гоночний вихлоп",
    ],
  };
}
