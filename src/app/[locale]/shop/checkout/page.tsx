import { resolveLocale } from "@/lib/seo";
import { buildNoIndexPageMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import ShopCheckoutClient from "./ShopCheckoutClient";
import { isLocalStorefrontMode } from "@/lib/localStorefront";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ preview?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const l = resolveLocale(locale);
  return buildNoIndexPageMetadata(l, "shop/checkout", {
    title: l === "ua" ? "Оформлення замовлення | One Company" : "Checkout | One Company",
    description:
      l === "ua" ? "Оформіть замовлення в One Company." : "Complete your order at One Company.",
  });
}

export default async function ShopCheckoutPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  const query = await searchParams;
  const preview = isLocalStorefrontMode() && (query.preview === "1" || query.preview === "images");
  return (
    <ShopCheckoutClient
      locale={resolvedLocale}
      preview={preview}
      imagePreview={preview && query.preview === "images"}
    />
  );
}
