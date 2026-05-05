/**
 * GET /api/shop/feed/products
 * Google Merchant Center product feed (RSS 2.0 + g: namespace).
 * Query: locale=ua|en (default: en), currency=EUR|USD|UAH (default: EUR).
 *
 * In Merchant Center: Products → Feeds → Add feed → Scheduled fetch → enter this URL.
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getShopProductsServer } from '@/lib/shopCatalogServer';
import { buildShopProductPath } from '@/lib/urbanCollectionMatcher';
import type { ShopProduct } from '@/lib/shopCatalog';
import { localizeShopDescription, localizeShopProductTitle } from '@/lib/shopText';
import { expandShopPrices } from '@/lib/shopPriceConversion';
import { getOrCreateShopSettings, getShopSettingsRuntime } from '@/lib/shopAdminSettings';

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://onecompany.global');

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function localize(product: ShopProduct, locale: 'ua' | 'en'): { title: string; description: string } {
  const title = localizeShopProductTitle(locale, product);
  const description = localizeShopDescription(locale, product.shortDescription);
  return {
    title: (title || product.slug).trim().slice(0, 150),
    description: (description || '').trim().slice(0, 5000),
  };
}

function formatPrice(amount: number, currency: string): string {
  return `${Number(amount).toFixed(2)} ${currency}`;
}

function getAvailability(product: ShopProduct): string {
  if (product.stock === 'preOrder') return 'preorder';
  return 'in stock';
}

function buildItemXml(
  product: ShopProduct,
  locale: 'ua' | 'en',
  currency: 'EUR' | 'USD' | 'UAH',
  rates: Record<'EUR' | 'USD' | 'UAH', number>
): string {
  const id = (product.sku || product.slug).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50) || product.slug;
  const { title, description } = localize(product, locale);
  const path = buildShopProductPath(locale, product, true);
  const link = `${SITE_URL}${path}`;
  const imageUrl = product.image.startsWith('http') ? product.image : `${SITE_URL}${product.image}`;

  // Cross-currency expansion: use whatever currency is set on the product
  // (USD for iPE, EUR for Brabus, UAH for some) and convert to the requested
  // feed currency via the same rate table the storefront uses.
  const variantPrice = product.variants?.find((v) => v.isDefault)?.price ?? product.variants?.[0]?.price;
  const expanded = expandShopPrices(product.price ?? variantPrice ?? null, rates);
  const compareExpanded = expandShopPrices(product.compareAt ?? null, rates);
  const currencyKey = currency.toLowerCase() as 'usd' | 'eur' | 'uah';
  const priceValue = expanded[currencyKey];
  if (!priceValue || priceValue <= 0) {
    return ''; // Skip items with no resolvable price (Merchant rejects 0).
  }
  const price = formatPrice(priceValue, currency);
  const compareValue = compareExpanded[currencyKey];
  const salePrice = compareValue && compareValue > priceValue ? formatPrice(priceValue, currency) : null;
  const listPrice = salePrice ? formatPrice(compareValue!, currency) : null;
  const availability = getAvailability(product);

  return [
    '<item>',
    `<g:id>${escapeXml(id)}</g:id>`,
    `<title>${escapeXml(title)}</title>`,
    `<link>${escapeXml(link)}</link>`,
    `<description>${escapeXml(description)}</description>`,
    `<g:image_link>${escapeXml(imageUrl)}</g:image_link>`,
    `<g:availability>${availability}</g:availability>`,
    listPrice ? `<g:price>${escapeXml(listPrice)}</g:price>` : `<g:price>${escapeXml(price)}</g:price>`,
    salePrice ? `<g:sale_price>${escapeXml(salePrice)}</g:sale_price>` : '',
    '<g:condition>new</g:condition>',
    '<g:identifier_exists>false</g:identifier_exists>',
    product.brand ? `<g:brand>${escapeXml(product.brand)}</g:brand>` : '',
    product.sku ? `<g:mpn>${escapeXml(product.sku)}</g:mpn>` : '',
    '<g:google_product_category>Vehicles &amp; Parts &gt; Vehicle Parts &amp; Accessories</g:google_product_category>',
    '<g:shipping><g:country>UA</g:country><g:service>Standard</g:service><g:price>0.00 EUR</g:price></g:shipping>',
    '</item>',
  ]
    .filter(Boolean)
    .join('\n');
}

export async function GET(request: NextRequest) {
  const locale = (request.nextUrl.searchParams.get('locale') || 'en').toLowerCase() === 'ua' ? 'ua' : 'en';
  const currencyParam = (request.nextUrl.searchParams.get('currency') || 'EUR').toUpperCase();
  const currency: 'EUR' | 'USD' | 'UAH' =
    currencyParam === 'UAH' ? 'UAH' : currencyParam === 'USD' ? 'USD' : 'EUR';

  let products: ShopProduct[];
  let rates: Record<'EUR' | 'USD' | 'UAH', number>;
  try {
    const [productsResult, settingsRecord] = await Promise.all([
      getShopProductsServer(),
      getOrCreateShopSettings(prisma),
    ]);
    products = productsResult;
    rates = getShopSettingsRuntime(settingsRecord).currencyRates;
  } catch (e) {
    console.error('Shop feed: failed to load products', e);
    return new Response('Failed to generate feed', { status: 500 });
  }

  const itemsXml = products
    .filter((p) => p.image && ((p.price?.eur ?? 0) > 0 || (p.price?.usd ?? 0) > 0 || (p.price?.uah ?? 0) > 0 ||
      (p.variants?.some((v) => (v.price?.eur ?? 0) > 0 || (v.price?.usd ?? 0) > 0 || (v.price?.uah ?? 0) > 0) ?? false)))
    .map((p) => buildItemXml(p, locale, currency, rates))
    .filter(Boolean)
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${escapeXml('One Company Shop – Products')}</title>
    <link>${escapeXml(SITE_URL)}</link>
    <description>Product feed for Google Merchant Center</description>
    ${itemsXml}
  </channel>
</rss>`;

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=1800',
    },
  });
}
