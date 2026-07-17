import type { Metadata } from "next";

import { buildPageMetadata, resolveLocale, type SupportedLocale } from "@/lib/seo";

const catalogMetaCopy: Record<SupportedLocale, { title: string; description: string }> = {
  ua: {
    title: "Каталог товарів | OneCompany",
    description:
      "Загальний каталог товарів OneCompany для авто та мото: пошук за брендом, категорією, маркою, моделлю та кузовом.",
  },
  en: {
    title: "Product catalog | OneCompany",
    description:
      "Browse the OneCompany auto and moto product catalog by brand, category, vehicle make, model, and chassis.",
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);

  return buildPageMetadata(resolvedLocale, "shop/catalog", catalogMetaCopy[resolvedLocale]);
}
