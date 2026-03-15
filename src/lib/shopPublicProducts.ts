import type { ShopProduct } from '@/lib/shopCatalog';
import {
  resolveShopPriceBands,
  resolveShopProductPricing,
  type ShopViewerPricingContext,
} from '@/lib/shopPricingAudience';

export function serializePublicShopProduct(
  product: ShopProduct,
  context: ShopViewerPricingContext
) {
  const pricing = resolveShopProductPricing(product, context);

  return {
    id: product.id ?? null,
    slug: product.slug,
    sku: product.sku,
    scope: product.scope,
    brand: product.brand,
    vendor: product.vendor ?? null,
    productType: product.productType ?? null,
    tags: product.tags ?? [],
    title: product.title,
    category: product.category,
    categoryNode: product.categoryNode ?? null,
    shortDescription: product.shortDescription,
    longDescription: product.longDescription,
    leadTime: product.leadTime,
    stock: product.stock,
    collection: product.collection,
    collections: product.collections ?? [],
    bundle: product.bundle
      ? {
          id: product.bundle.id,
          availableQuantity: product.bundle.availableQuantity,
          items: product.bundle.items.map((item) => ({
            id: item.id,
            quantity: item.quantity,
            availableQuantity: item.availableQuantity,
            variantId: item.variantId ?? null,
            variantTitle: item.variantTitle ?? null,
            product: item.product,
          })),
        }
      : null,
    image: product.image,
    gallery: product.gallery ?? [product.image],
    highlights: product.highlights,
    pricing: {
      audience: pricing.audience,
      source: pricing.source,
      b2bVisible: pricing.b2bVisible,
      requestQuote: pricing.requestQuote,
      discountPercent: pricing.discountPercent,
      effectivePrice: pricing.effectivePrice,
      effectiveCompareAt: pricing.effectiveCompareAt,
      bands: pricing.bands,
    },
    variants:
      product.variants?.map((variant) => {
        const variantPricing = resolveShopPriceBands({
          b2cPrice: variant.price,
          b2cCompareAt: variant.compareAt ?? null,
          b2bPrice: variant.b2bPrice ?? null,
          b2bCompareAt: variant.b2bCompareAt ?? null,
          context,
        });

        return {
          id: variant.id ?? null,
          title: variant.title ?? null,
          sku: variant.sku ?? null,
          position: variant.position ?? null,
          optionValues: variant.optionValues ?? [],
          inventoryQty: variant.inventoryQty ?? 0,
          image: variant.image ?? null,
          isDefault: variant.isDefault ?? false,
          pricing: {
            audience: variantPricing.audience,
            source: variantPricing.source,
            b2bVisible: variantPricing.b2bVisible,
            requestQuote: variantPricing.requestQuote,
            discountPercent: variantPricing.discountPercent,
            effectivePrice: variantPricing.effectivePrice,
            effectiveCompareAt: variantPricing.effectiveCompareAt,
            bands: variantPricing.bands,
          },
        };
      }) ?? [],
  };
}
