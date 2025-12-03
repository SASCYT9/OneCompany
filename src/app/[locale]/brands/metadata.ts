import type { Metadata } from "next";
import { buildPageMetadata, resolveLocale, type SupportedLocale } from "@/lib/seo";

const brandsMetaCopy: Record<SupportedLocale, { title: string; description: string }> = {
  en: {
    title: "200+ Premium Tuning Brands · Auto & Moto Partners | onecompany",
    description:
      "Complete catalog of 200+ premium auto and motorcycle tuning brands. Official importer programs for Akrapovic, Brabus, HRE, KW, Brembo and more. Global logistics & expert support.",
  },
  ua: {
    title: "200+ Преміум Брендів Тюнінгу · Авто та Мото Партнери | onecompany",
    description:
      "Повний каталог 200+ преміум брендів авто та мото тюнінгу. Офіційні імпортерські програми Akrapovic, Brabus, HRE, KW, Brembo та інших. Глобальна логістика та експертна підтримка.",
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  const meta = brandsMetaCopy[resolvedLocale];

  return {
    ...buildPageMetadata(resolvedLocale, "brands", meta),
    keywords: [
      "tuning brands",
      "auto parts brands",
      "moto parts brands",
      "Akrapovic",
      "Brabus",
      "Mansory",
      "HRE wheels",
      "KW suspension",
      "Brembo",
      "premium automotive",
      "бренди тюнінгу",
      "преміум автозапчастини",
    ],
  };
}
