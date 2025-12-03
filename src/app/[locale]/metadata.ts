import type { Metadata } from "next";
import { buildPageMetadata, resolveLocale, type SupportedLocale } from "@/lib/seo";

const homeMetaCopy: Record<SupportedLocale, { title: string; description: string }> = {
  en: {
    title: "onecompany · Premium Auto & Moto Tuning Importer Ukraine | Since 2007",
    description:
      "Official B2B importer of 200+ premium auto & moto tuning brands in Ukraine. Akrapovic, Brabus, HRE, KW, Brembo. Expert sourcing, global logistics, warranty support since 2007. Kyiv, Baseina 21B.",
  },
  ua: {
    title: "onecompany · Офіційний Імпортер Преміум Авто та Мото Тюнінгу Україна | З 2007",
    description:
      "Офіційний B2B дистриб'ютор 200+ преміум брендів авто та мото тюнінгу в Україні. Akrapovic, Brabus, HRE, KW, Brembo. Експертний підбір, глобальна логістика, гарантійна підтримка з 2007. Київ, Басейна 21Б.",
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  const meta = homeMetaCopy[resolvedLocale];

  return {
    ...buildPageMetadata(resolvedLocale, "", meta),
    keywords: [
      "onecompany",
      "auto tuning Ukraine",
      "moto tuning Ukraine", 
      "premium car parts",
      "Akrapovic Ukraine",
      "Brabus Ukraine",
      "HRE wheels Ukraine",
      "KW suspension",
      "tuning importer",
      "авто тюнінг Україна",
      "мото тюнінг Київ",
      "преміум запчастини",
      "імпортер тюнінгу",
    ],
  };
}
