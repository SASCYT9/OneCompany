import type { Metadata } from "next";
import { buildPageMetadata, resolveLocale, type SupportedLocale } from "@/lib/seo";

const motoMetaCopy: Record<SupportedLocale, { title: string; description: string }> = {
  en: {
    title: "Motorcycle Tuning: Exhaust, Suspension, ECU | OneCompany",
    description:
      "Motorcycle tuning for street and track: exhaust, suspension, brakes, electronics and OEM solutions. Official supply and expert selection.",
  },
  ua: {
    title: "Мото тюнінг в Україні: вихлоп, підвіска, ECU | OneCompany",
    description:
      "Мото тюнінг для дороги й треку: вихлоп, підвіска, гальма, електроніка та OEM рішення. Офіційні поставки і професійний підбір.",
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
