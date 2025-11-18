import type { Metadata } from "next";
import { buildPageMetadata, resolveLocale, type SupportedLocale } from "@/lib/seo";

const contactMetaCopy: Record<SupportedLocale, { title: string; description: string }> = {
  en: {
    title: "Contact onecompany · Bespoke performance concierge",
    description:
      "Speak with our importer team for curated automotive and motorcycle programs, sourcing, homologation and global logistics.",
  },
  ua: {
    title: "onecompany · Контакти імпортера преміум",
    description:
      "Зв'яжіться з нашою командою для індивідуального підбору авто та мото програм, логістики, гомологації та супроводу імпортера.",
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
