import type { Metadata } from "next";
import { buildPageMetadata, resolveLocale, type SupportedLocale } from "@/lib/seo";

const aboutMetaCopy: Record<SupportedLocale, { title: string; description: string }> = {
  en: {
    title: "About onecompany · Premium performance atelier",
    description:
      "Since 2007 onecompany curates bespoke automotive and motorcycle programs with homologation, logistics, and atelier support worldwide.",
  },
  ua: {
    title: "Про onecompany · Преміум ательє тюнінгу",
    description:
      "З 2007 року onecompany створює індивідуальні авто та мото програми з гомологацією, логістикою та підтримкою ательє по всьому світу.",
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  const meta = aboutMetaCopy[resolvedLocale];

  return buildPageMetadata(resolvedLocale, "about", meta);
}
