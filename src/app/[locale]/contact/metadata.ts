import type { Metadata } from "next";
import { buildPageMetadata, resolveLocale, type SupportedLocale } from "@/lib/seo";

const contactMetaCopy: Record<SupportedLocale, { title: string; description: string }> = {
  en: {
    title: "Contact OneCompany | Auto & Moto Tuning Support",
    description:
      "Contact OneCompany for commercial tuning requests: auto and moto parts sourcing, OEM solutions, logistics, and technical assistance.",
  },
  ua: {
    title: "Контакти OneCompany | Підбір тюнінгу авто та мото",
    description:
      "Зв'яжіться з OneCompany для комерційного підбору тюнінгу авто та мото: OEM рішення, логістика, технічна консультація, підтримка замовлення.",
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  const meta = contactMetaCopy[resolvedLocale];

  return buildPageMetadata(resolvedLocale, "contact", meta);
}
