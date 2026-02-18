import type { Metadata } from "next";
import { buildPageMetadata, resolveLocale, type SupportedLocale } from "@/lib/seo";

const choiceMetaCopy: Record<SupportedLocale, { title: string; description: string }> = {
  en: {
    title: "Choose Auto or Moto Tuning Direction | OneCompany",
    description:
      "Choose your direction: auto tuning or moto tuning. Performance parts, OEM solutions, and commercial support from official import channels.",
  },
  ua: {
    title: "Оберіть напрям: авто чи мото тюнінг | OneCompany",
    description:
      "Оберіть свій напрям: авто тюнінг або мото тюнінг. Performance деталі, OEM рішення та комерційна підтримка через офіційний імпорт.",
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  const meta = choiceMetaCopy[resolvedLocale];

  return buildPageMetadata(resolvedLocale, "choice", meta);
}
