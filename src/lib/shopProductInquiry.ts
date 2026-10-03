import type { ShopProduct } from "@/lib/shopCatalog";
import { localizeShopProductTitle } from "@/lib/shopText";

export function buildProductInquiryHref(locale: string, slug: string, variantId?: string | null) {
  const params = new URLSearchParams({ product: slug });
  if (variantId) params.set("variant", variantId);
  return `/${locale}/contact?${params}`;
}

export function resolveProductInquiry(product: ShopProduct, locale: "ua" | "en", variantId?: string | null) {
  const variant = variantId ? product.variants?.find((item) => item.id === variantId) : null;
  if (variantId && !variant) throw new Error("INQUIRY_VARIANT_NOT_FOUND");
  const clean = (value: string | null | undefined) => (value ?? "").replace(/<[^>]*>/g, "").replace(/[\r\n\t]+/g, " ").trim();
  return {
    productId: product.id ?? null,
    slug: product.slug,
    title: clean(localizeShopProductTitle(locale, product)),
    sku: clean(variant?.sku || product.sku),
    variantId: variant?.id ?? null,
    variantTitle: /^(?:Default|Default Title)$/i.test(variant?.title ?? "") ? "" : clean(variant?.title),
    scope: product.scope,
  };
}

export function productInquiryMessage(context: ReturnType<typeof resolveProductInquiry>, locale: "ua" | "en") {
  return [
    `${locale === "ua" ? "Товар" : "Product"}: ${context.title}`,
    context.sku ? `SKU: ${context.sku}` : "",
    context.variantTitle ? `${locale === "ua" ? "Варіант" : "Variant"}: ${context.variantTitle}` : "",
    `https://onecompany.global/${locale}/shop/${encodeURIComponent(context.slug)}`,
  ].filter(Boolean).join("\n");
}
