import type { ShopProduct } from "@/lib/shopCatalog";
import { siteConfig } from "@/lib/seo";
import { localizeShopDescription, localizeShopProductTitle } from "@/lib/shopText";
import { expandShopPrices } from "@/lib/shopPriceConversion";
import { buildShopStorefrontProductPathForProduct } from "@/lib/shopStorefrontRouting";
import { isWheelForceWheel, wheelForceSetMoney } from "@/lib/wheelforceFamily";
import { googleMerchantAvailability } from "@/lib/shopGoogleAvailability";
import { resolveShopConfirmedStock } from "@/lib/shopWarehouseInventory";

export type MerchantFeedCurrency = "EUR" | "USD" | "UAH";

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function localize(
  product: ShopProduct,
  locale: "ua" | "en"
): { title: string; description: string } {
  const title = localizeShopProductTitle(locale, product);
  const description = localizeShopDescription(locale, product.shortDescription);
  return {
    title: (title || product.slug).trim().slice(0, 150),
    description: (description || "").trim().slice(0, 5000),
  };
}

function formatPrice(amount: number, currency: string): string {
  return `${Number(amount).toFixed(2)} ${currency}`;
}

/** Google's length limit for g:id. */
const MERCHANT_ID_MAX_LENGTH = 50;

function sanitizeMerchantId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}

/** FNV-1a 32-bit hash of the slug in base36: short, stable, dependency-free. */
function slugHash(slug: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < slug.length; index += 1) {
    hash ^= slug.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
}

/**
 * g:id for each product, aligned with the input order. The sanitized SKU is
 * kept when it fits Google's 50-character limit and no other product in the
 * feed shares it. Otherwise (RaceChip SKUs repeat across car models and run
 * past 50 characters) the SKU is cut to fit next to a hash of the product's
 * slug, which is unique per product page, so no item collapses into another.
 */
export function buildMerchantFeedIds(products: Array<Pick<ShopProduct, "sku" | "slug">>): string[] {
  const bases = products.map((product) => sanitizeMerchantId(product.sku || product.slug));
  const counts = new Map<string, number>();
  for (const base of bases) counts.set(base, (counts.get(base) ?? 0) + 1);
  return products.map((product, index) => {
    const base = bases[index];
    if (base && base.length <= MERCHANT_ID_MAX_LENGTH && counts.get(base) === 1) return base;
    const suffix = `-${slugHash(product.slug)}`;
    return `${base.slice(0, MERCHANT_ID_MAX_LENGTH - suffix.length)}${suffix}`;
  });
}

/**
 * One `<item>` of the Google Merchant Center feed, or "" when the product
 * cannot be listed (internal test product, no resolvable price).
 *
 * The product page is the source of truth, so the feed mirrors it: the link is
 * the page's canonical URL (a redirecting link is reported as a landing page
 * problem), and availability uses the same warehouse-confirmed stock the page
 * puts into its structured data.
 */
export function buildMerchantFeedItemXml(
  product: ShopProduct,
  locale: "ua" | "en",
  currency: MerchantFeedCurrency,
  rates: Record<MerchantFeedCurrency, number>,
  /** `id` from buildMerchantFeedIds over the whole feed; `now` for tests. */
  options: { id?: string; now?: Date } = {}
): string {
  if (product.tags?.includes("internal-test")) return "";
  const id = options.id ?? buildMerchantFeedIds([product])[0];
  const { title, description } = localize(product, locale);
  const link = `${siteConfig.url}${buildShopStorefrontProductPathForProduct(locale, product)}`;
  const imageUrl = product.image.startsWith("http")
    ? product.image
    : `${siteConfig.url}${product.image}`;

  // Cross-currency expansion: use whatever currency is set on the product
  // (USD for iPE, EUR for Brabus, UAH for some) and convert to the requested
  // feed currency via the same rate table the storefront uses.
  const variantPrice =
    product.variants?.find((v) => v.isDefault)?.price ?? product.variants?.[0]?.price;
  const wheelSet = isWheelForceWheel(product);
  const unitExpanded = expandShopPrices(product.price ?? variantPrice ?? null, rates);
  const unitCompareExpanded = expandShopPrices(product.compareAt ?? null, rates);
  const expanded = wheelSet ? wheelForceSetMoney(unitExpanded) : unitExpanded;
  const compareExpanded = wheelSet ? wheelForceSetMoney(unitCompareExpanded) : unitCompareExpanded;
  const currencyKey = currency.toLowerCase() as "usd" | "eur" | "uah";
  const priceValue = expanded[currencyKey];
  if (!priceValue || priceValue <= 0) {
    return ""; // Skip items with no resolvable price (Merchant rejects 0).
  }
  const price = formatPrice(priceValue, currency);
  const compareValue = compareExpanded[currencyKey];
  const salePrice =
    compareValue && compareValue > priceValue ? formatPrice(priceValue, currency) : null;
  const listPrice = salePrice ? formatPrice(compareValue!, currency) : null;
  const stock = resolveShopConfirmedStock(
    product.sku,
    product.slug,
    product.stock,
    product.storefrontDisplay
  );
  const { availability, availabilityDate } = googleMerchantAvailability(
    stock,
    product.availabilityDate,
    product.leadTime,
    options.now
  );

  const mpn = product.sku?.trim();
  const brand = product.brand?.trim();

  return [
    "<item>",
    `<g:id>${escapeXml(id)}</g:id>`,
    `<title>${escapeXml(title)}</title>`,
    `<link>${escapeXml(link)}</link>`,
    `<description>${escapeXml(description)}</description>`,
    `<g:image_link>${escapeXml(imageUrl)}</g:image_link>`,
    `<g:availability>${availability}</g:availability>`,
    availabilityDate
      ? `<g:availability_date>${escapeXml(availabilityDate)}</g:availability_date>`
      : "",
    listPrice
      ? `<g:price>${escapeXml(listPrice)}</g:price>`
      : `<g:price>${escapeXml(price)}</g:price>`,
    salePrice ? `<g:sale_price>${escapeXml(salePrice)}</g:sale_price>` : "",
    "<g:condition>new</g:condition>",
    brand ? `<g:brand>${escapeXml(brand)}</g:brand>` : "",
    mpn ? `<g:mpn>${escapeXml(mpn)}</g:mpn>` : "",
    // Brand plus MPN is a valid identifier pair; only declare "no identifier"
    // when the item really has neither, otherwise Merchant Center treats the
    // flag as contradicting the data.
    brand && mpn ? "" : "<g:identifier_exists>false</g:identifier_exists>",
    "<g:google_product_category>Vehicles &amp; Parts &gt; Vehicle Parts &amp; Accessories</g:google_product_category>",
    "</item>",
  ]
    .filter(Boolean)
    .join("\n");
}
