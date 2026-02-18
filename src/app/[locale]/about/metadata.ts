import type { Metadata } from "next";
import { buildPageMetadata, resolveLocale, type SupportedLocale } from "@/lib/seo";

const aboutMetaCopy: Record<SupportedLocale, { title: string; description: string }> = {
  en: {
    title: "About OneCompany | Auto & Moto Tuning Expertise",
    description:
      "OneCompany team, expertise and workflow: importer support for auto and moto tuning, OEM sourcing, logistics and technical consultation.",
  },
  ua: {
    title: "Про OneCompany | Експертиза авто та мото тюнінгу",
    description:
      "Команда OneCompany та досвід у авто і мото тюнінгу: імпортерська підтримка, OEM підбір, логістика та технічний супровід проєктів.",
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
