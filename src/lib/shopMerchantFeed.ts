import type { ShopProduct } from "@/lib/shopCatalog";
import { siteConfig } from "@/lib/seo";
import { buildLocalizedProductSeoTitle } from "@/lib/seoProductMeta";
import { localizeShopDescription, localizeShopProductTitle } from "@/lib/shopText";
import { expandShopPrices } from "@/lib/shopPriceConversion";
import { buildShopStorefrontProductPathForProduct } from "@/lib/shopStorefrontRouting";
import { isWheelForceWheel, wheelForceSetMoney } from "@/lib/wheelforceFamily";
import { googleMerchantAvailability } from "@/lib/shopGoogleAvailability";
import { resolveShopShippingClass, SHOP_SHIPPING_CLASS_PRICE_UAH } from "@/lib/shopShippingClass";

/** Nova Poshta in Ukraine: ships the same or next business day, 1–2 days on the road. */
const UA_SHIPPING_DAYS = { handling: [0, 1], transit: [1, 2] } as const;
import { isShopInStockProduct, SHOP_DIGITAL_IN_STOCK_SKUS } from "@/lib/shopWarehouseInventory";

export type MerchantFeedCurrency = "EUR" | "USD" | "UAH";

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Google's length limit for g:title. */
const MERCHANT_TITLE_MAX_LENGTH = 150;

function localize(
  product: ShopProduct,
  locale: "ua" | "en"
): { title: string; description: string } {
  const name = localizeShopProductTitle(locale, product);
  // The product page's title: Ukrainian for untranslated supplier imports in
  // the ua feed, with the SKU and brand, within Google's title limit.
  const title = name
    ? buildLocalizedProductSeoTitle(locale, product, name, MERCHANT_TITLE_MAX_LENGTH)
    : "";
  const description = localizeShopDescription(locale, product.shortDescription);
  return {
    title: (title || product.slug).trim().slice(0, MERCHANT_TITLE_MAX_LENGTH),
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
 * g:id for one product, derived from that product alone so it never changes
 * when other products enter or leave the feed (Merchant Center ties an item's
 * history to its ID). With a SKU, the ID is the SKU prefix plus a hash of the
 * slug, which is unique per product page: RaceChip SKUs repeat across car
 * models and run past 50 characters, so the bare SKU cannot identify a page.
 * Without a SKU, the slug itself (hashed when it is too long).
 */
export function buildMerchantFeedId(product: Pick<ShopProduct, "sku" | "slug">): string {
  const sku = sanitizeMerchantId(product.sku?.trim() ?? "");
  const slug = sanitizeMerchantId(product.slug);
  if (!sku && slug.length <= MERCHANT_ID_MAX_LENGTH) return slug;
  const suffix = `-${slugHash(product.slug)}`;
  return `${(sku || slug).slice(0, MERCHANT_ID_MAX_LENGTH - suffix.length)}${suffix}`;
}

/** g:id for each product, aligned with the input order (see buildMerchantFeedId). */
export function buildMerchantFeedIds(products: Array<Pick<ShopProduct, "sku" | "slug">>): string[] {
  return products.map(buildMerchantFeedId);
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
  const id = options.id ?? buildMerchantFeedId(product);
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
  // In stock only when the warehouse confirms it, as on the product page.
  // Supplier stock imported into the database ships on order, not today.
  const stock = isShopInStockProduct(product.sku, product.slug, product.storefrontDisplay)
    ? "inStock"
    : "preOrder";
  const { availability, availabilityDate } = googleMerchantAvailability(
    stock,
    product.availabilityDate,
    product.leadTime,
    options.now
  );

  const mpn = product.sku?.trim();
  const brand = product.brand?.trim();
  const shippingClass = resolveShopShippingClass(product);

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
    // Made-to-order items are not returnable (/refund, section 2). Merchant
    // Center applies its "no returns" exception to this label.
    availability === "backorder"
      ? "<g:return_policy_label>made_to_order</g:return_policy_label>"
      : "",
    listPrice
      ? `<g:price>${escapeXml(listPrice)}</g:price>`
      : `<g:price>${escapeXml(price)}</g:price>`,
    salePrice ? `<g:sale_price>${escapeXml(salePrice)}</g:sale_price>` : "",
    "<g:condition>new</g:condition>",
    `<g:shipping_label>${shippingClass}</g:shipping_label>`,
    // Item-level Nova Poshta shipping for Ukraine (owner-approved class prices,
    // 1–3 business days). It overrides the account's shipping settings for UA,
    // which cannot price by label until Merchant Center has accepted products.
    currency === "UAH"
      ? [
          "<g:shipping>",
          "<g:country>UA</g:country>",
          "<g:service>Нова пошта</g:service>",
          `<g:price>${formatPrice(SHOP_SHIPPING_CLASS_PRICE_UAH[shippingClass], "UAH")}</g:price>`,
          `<g:min_handling_time>${UA_SHIPPING_DAYS.handling[0]}</g:min_handling_time>`,
          `<g:max_handling_time>${UA_SHIPPING_DAYS.handling[1]}</g:max_handling_time>`,
          `<g:min_transit_time>${UA_SHIPPING_DAYS.transit[0]}</g:min_transit_time>`,
          `<g:max_transit_time>${UA_SHIPPING_DAYS.transit[1]}</g:max_transit_time>`,
          "</g:shipping>",
        ].join("")
      : "",
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

/**
 * Brands with their own storefront and curated product pages, in the order the
 * core feed takes them. Mass-imported families (KW, Remus, BMC, RaceChip…) stay
 * out: thousands of near-identical items are what pushed the account over its
 * product limit.
 */
const MERCHANT_CORE_BRANDS = [
  "eventuri",
  "akrapovic",
  "brabus",
  "urban",
  "ohlins",
  "ipe",
  "adro",
  "csf",
  "do88",
  "girodisc",
  "burger",
  "ilmberger",
] as const;

export const MERCHANT_CORE_FEED_DEFAULT_LIMIT = 150;
const DIGITAL_SKUS = new Set<string>(SHOP_DIGITAL_IN_STOCK_SKUS.map((sku) => sku.toUpperCase()));
export const MERCHANT_CORE_FEED_MAX_LIMIT = 5000;

function merchantBrandKey(brand: string | null | undefined) {
  return (brand ?? "")
    .normalize("NFD")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * A short feed that fits a small Merchant Center product limit: every
 * warehouse-confirmed item first, then the curated brands in turn (one item
 * each round) until `limit` items are picked.
 */
export function selectMerchantCoreProducts<
  T extends Pick<ShopProduct, "sku" | "slug" | "brand" | "storefrontDisplay">,
>(products: readonly T[], limit: number = MERCHANT_CORE_FEED_DEFAULT_LIMIT): T[] {
  // Physical stock only: digital licences stay in the full feed, not the core.
  const picked = new Set<T>(
    products
      .filter(
        (product) =>
          isShopInStockProduct(product.sku, product.slug, product.storefrontDisplay) &&
          !DIGITAL_SKUS.has((product.sku ?? "").trim().toUpperCase())
      )
      .slice(0, limit)
  );
  const queues = MERCHANT_CORE_BRANDS.map((key) =>
    products.filter(
      (product) => !picked.has(product) && merchantBrandKey(product.brand).startsWith(key)
    )
  );
  let cursor = 0;
  while (picked.size < limit && queues.some((queue) => cursor < queue.length)) {
    for (const queue of queues) {
      if (picked.size >= limit) break;
      if (cursor < queue.length) picked.add(queue[cursor]);
    }
    cursor += 1;
  }
  return [...picked];
}
