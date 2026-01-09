import type { Metadata } from "next";
import { buildPageMetadata, resolveLocale, type SupportedLocale } from "@/lib/seo";

const choiceMetaCopy: Record<SupportedLocale, { title: string; description: string }> = {
  en: {
    title: "Choose Your Direction · Auto or Moto Tuning | OneCompany",
    description:
      "Select your tuning path: automotive performance parts or motorcycle upgrades. 200+ premium brands. Akrapovic, Brabus, Ohlins, Brembo. Official distributor worldwide.",
  },
  ua: {
    title: "Оберіть напрям · Авто чи Мото Тюнінг | OneCompany",
    description:
      "Оберіть свій напрям тюнінгу: автомобільні запчастини або мотоапгрейди. 200+ преміум брендів. Akrapovic, Brabus, Ohlins, Brembo. Офіційний дистриб'ютор.",
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
