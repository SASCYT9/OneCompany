import type { Metadata } from "next";
import { buildPageMetadata, resolveLocale, type SupportedLocale } from "@/lib/seo";

const categoriesMetaCopy: Record<SupportedLocale, { title: string; description: string }> = {
  en: {
    title: "Auto & Moto Tuning Categories | OneCompany",
    description:
      "Explore all auto and moto tuning categories: exhaust, suspension, wheels, brakes, electronics, carbon and OEM parts with official sourcing support.",
  },
  ua: {
    title: "Категорії авто та мото тюнінгу | OneCompany",
    description:
      "Усі категорії авто та мото тюнінгу: вихлоп, підвіска, диски, гальма, електроніка, карбон та OEM деталі з офіційним постачанням.",
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
