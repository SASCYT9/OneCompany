import type { ShopProduct } from '@/lib/shopCatalog';

const EXHAUST_PATTERN =
  /\b(?:exhaust|tailpipe|muffler|sportxhaust|abgas(?:anlage)?|endrohr(?:e)?)\b|вихлоп|глушник|випуск(?:на)?\s+систем|патрубк/i;

export function isBrabusExhaustProduct(product: Pick<ShopProduct, 'title' | 'sku' | 'category'>) {
  const haystack = [
    product.title?.en ?? '',
    product.title?.ua ?? '',
    product.category?.en ?? '',
    product.category?.ua ?? '',
    product.sku ?? '',
  ]
    .join(' ')
    .toLowerCase();
  return EXHAUST_PATTERN.test(haystack);
}
