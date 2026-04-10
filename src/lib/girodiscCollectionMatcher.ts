import type { ShopProduct } from '@/lib/shopCatalog';

export function buildShopProductPathGirodisc(locale: string, product: ShopProduct) {
  return `/${locale}/shop/girodisc/products/${product.slug}`;
}
