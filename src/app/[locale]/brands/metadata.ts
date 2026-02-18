import type { Metadata } from "next";
import { buildPageMetadata, resolveLocale, type SupportedLocale } from "@/lib/seo";

const brandsMetaCopy: Record<SupportedLocale, { title: string; description: string }> = {
  en: {
    title: "Auto & Moto Tuning Brands (OEM, Racing) | OneCompany",
    description:
      "Catalog of tuning brands for auto and moto: OEM parts, racing solutions, exhaust, suspension, electronics and premium fitment support.",
  },
  ua: {
    title: "Бренди авто та мото тюнінгу (OEM, Racing) | OneCompany",
    description:
      "Каталог брендів для авто та мото тюнінгу: OEM деталі, racing рішення, вихлоп, підвіска, електрика та експертний підбір під проєкт.",
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
