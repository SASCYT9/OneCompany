import type { Metadata } from "next";

import { buildPageMetadata, resolveLocale, type SupportedLocale } from "@/lib/seo";
import {
  hasStockCatalogFilters,
  parseStockPage,
  stockPageSearchParams,
  type StockPageSearchParams,
} from "@/lib/shopStockInitialSearch";

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
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<StockPageSearchParams>;
}): Promise<Metadata> {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);

  const query = stockPageSearchParams((await searchParams) ?? {});
  const filtered = hasStockCatalogFilters(query);
  const page = parseStockPage(query.get("page"));
  const slug = !filtered && page > 1 ? `shop/catalog?page=${page}` : "shop/catalog";
  const metadata = buildPageMetadata(resolvedLocale, slug, catalogMetaCopy[resolvedLocale]);
  return filtered ? { ...metadata, robots: { index: false, follow: true } } : metadata;
}
