import type { Metadata } from "next";
import { buildPageMetadata, resolveLocale, type SupportedLocale } from "@/lib/seo";

const categoriesMetaCopy: Record<SupportedLocale, { title: string; description: string }> = {
  en: {
    title: "Categories · Auto & Moto Tuning Parts | OneCompany",
    description:
      "Browse all tuning categories: exhaust systems, suspension, wheels, brakes, carbon fiber, electronics. Premium brands: Akrapovic, KW, HRE, Brembo. Official distributor.",
  },
  ua: {
    title: "Категорії · Авто та Мото Тюнінг | OneCompany",
    description:
      "Переглядайте всі категорії тюнінгу: вихлопні системи, підвіска, диски, гальма, карбон, електроніка. Преміум бренди: Akrapovic, KW, HRE, Brembo. Офіційний дистриб'ютор.",
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  const meta = categoriesMetaCopy[resolvedLocale];

  return buildPageMetadata(resolvedLocale, "categories", meta);
}
