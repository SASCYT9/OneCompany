import type { Metadata } from "next";
import { buildPageMetadata, resolveLocale, type SupportedLocale } from "@/lib/seo";

const shopMetaCopy: Record<SupportedLocale, { title: string; description: string }> = {
  en: {
    title: "Shop | One Company Premium Catalog",
    description:
      "Unified One Company shop page with brand selection, product catalog browsing, and multi-category filtering for auto and moto tuning parts.",
  },
  ua: {
    title: "Магазин | One Company Premium Catalog",
    description:
      "Єдина сторінка магазину One Company: вибір брендів, каталог товарів і фільтри для авто та мото тюнінгу.",
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  const meta = shopMetaCopy[resolvedLocale];

  return buildPageMetadata(resolvedLocale, "shop", meta);
}

